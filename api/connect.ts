import { createHash, randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import type {
    ConnectPlaybackSnapshot,
    ConnectRemoteCommand,
    ConnectRemoteCommandInput,
    ConnectSessionState,
    ConnectTrack,
} from "../src/lib/youtubeConnect.js";

interface ConnectApiRequest {
    method?: string;
    query?: Record<string, string | string[] | undefined>;
    body?: unknown;
}

interface ConnectApiResponse {
    status: (code: number) => ConnectApiResponse;
    json: (body: unknown) => void;
    setHeader: (name: string, value: string) => void;
}

type ConnectAction = "create" | "publish" | "claim" | "command";

interface ConnectRequestBody {
    action?: ConnectAction;
    code?: string;
    deviceId?: string;
    deviceName?: string;
    snapshot?: ConnectPlaybackSnapshot;
    command?: ConnectRemoteCommandInput;
    ackCommandId?: string;
}

const SESSION_TTL_SECONDS = 60 * 60 * 24;
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{16}$/;
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{6,32}$/;
const PUBLISH_IF_OWNER_SCRIPT = `
local current = redis.call("GET", KEYS[1])
if not current then return -1 end
local decoded = cjson.decode(current)
if decoded.activeDeviceId ~= ARGV[1] then return 0 end
local proposed = cjson.decode(ARGV[2])
if decoded.commands then
  local remaining = {}
  local acknowledged = ARGV[4] == ''
  local found = false
  for _, command in ipairs(decoded.commands) do
    if acknowledged then
      table.insert(remaining, command)
    elseif command.id == ARGV[4] then
      acknowledged = true
      found = true
    end
  end
  if ARGV[4] ~= '' and not found then remaining = decoded.commands end
  if #remaining > 0 then proposed.commands = remaining end
end
redis.call("SET", KEYS[1], cjson.encode(proposed), "EX", ARGV[3])
return 1
`;
const COMMAND_IF_REMOTE_SCRIPT = `
local current = redis.call("GET", KEYS[1])
if not current then return -1 end
local decoded = cjson.decode(current)
if decoded.activeDeviceId == ARGV[1] then return 0 end
if not decoded.commands then decoded.commands = {} end
table.insert(decoded.commands, cjson.decode(ARGV[2]))
while #decoded.commands > 20 do table.remove(decoded.commands, 1) end
decoded.version = decoded.version + 1
redis.call("SET", KEYS[1], cjson.encode(decoded), "EX", ARGV[3])
return 1
`;

const getRedis = () => {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (!url || !token) throw new Error("Dev Hub Connect storage is not configured");
    return new Redis({ url, token });
};

const normalizeCode = (value = "") => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
const cleanText = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const finiteNumber = (value: unknown, min: number, max: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : min;
};

const cleanTrack = (value: unknown): ConnectTrack | null => {
    if (!value || typeof value !== "object") return null;
    const candidate = value as Partial<ConnectTrack>;
    const videoId = cleanText(candidate.videoId, 32);
    if (!VIDEO_ID_PATTERN.test(videoId)) return null;
    const durationMs = finiteNumber(candidate.durationMs, 0, 1000 * 60 * 60 * 24);
    return {
        id: `yt-${videoId}`,
        videoId,
        uri: `https://www.youtube.com/watch?v=${videoId}`,
        title: cleanText(candidate.title, 200) || "YouTube track",
        artist: cleanText(candidate.artist, 160) || "YouTube",
        image: cleanText(candidate.image, 1000),
        durationMs,
        duration: cleanText(candidate.duration, 20),
    };
};

const cleanSnapshot = (value: unknown): ConnectPlaybackSnapshot => {
    const candidate = value && typeof value === "object" ? value as Partial<ConnectPlaybackSnapshot> : {};
    const queue = Array.isArray(candidate.queue)
        ? candidate.queue.slice(0, 100).map(cleanTrack).filter((track): track is ConnectTrack => Boolean(track))
        : [];
    const track = cleanTrack(candidate.track);
    const queueIndex = Math.floor(finiteNumber(candidate.queueIndex, -1, Math.max(-1, queue.length - 1)));
    const durationMs = finiteNumber(candidate.durationMs ?? track?.durationMs, 0, 1000 * 60 * 60 * 24);
    return {
        track,
        queue,
        queueIndex,
        positionMs: finiteNumber(candidate.positionMs, 0, durationMs || 1000 * 60 * 60 * 24),
        durationMs,
        isPlaying: candidate.isPlaying === true,
        shuffleMode: candidate.shuffleMode === "smart" || candidate.shuffleMode === "shuffle" ? candidate.shuffleMode : "off",
        repeatMode: candidate.repeatMode === 1 || candidate.repeatMode === 2 ? candidate.repeatMode : 0,
        volume: finiteNumber(candidate.volume ?? 1, 0, 1),
    };
};

const cleanCommand = (value: unknown, deviceName: string): ConnectRemoteCommand | null => {
    if (!value || typeof value !== "object") return null;
    const candidate = value as Partial<ConnectRemoteCommandInput>;
    const id = randomUUID();
    const common = { id, issuedAt: Date.now(), issuedBy: deviceName };
    if (candidate.type === "toggle-play" || candidate.type === "next" || candidate.type === "previous" || candidate.type === "cycle-shuffle" || candidate.type === "cycle-repeat") {
        return { ...common, type: candidate.type };
    }
    if (candidate.type === "seek") return { ...common, type: candidate.type, value: finiteNumber(candidate.value, 0, 100) };
    if (candidate.type === "volume") return { ...common, type: candidate.type, value: finiteNumber(candidate.value, 0, 1) };
    if (candidate.type === "play-track") {
        const track = cleanTrack(candidate.track);
        return track ? { ...common, type: candidate.type, track } : null;
    }
    if (candidate.type === "play-queue-index") {
        return { ...common, type: candidate.type, queueIndex: Math.floor(finiteNumber(candidate.queueIndex, 0, 99)) };
    }
    if (candidate.type === "replace-queue") {
        const queue = Array.isArray(candidate.queue)
            ? candidate.queue.slice(0, 100).map(cleanTrack).filter((track): track is ConnectTrack => Boolean(track))
            : [];
        if (!queue.length) return null;
        return {
            ...common,
            type: candidate.type,
            queue,
            queueIndex: Math.floor(finiteNumber(candidate.queueIndex, 0, queue.length - 1)),
        };
    }
    return null;
};

const parseBody = (body: unknown): ConnectRequestBody => {
    if (typeof body === "string") return JSON.parse(body) as ConnectRequestBody;
    return body && typeof body === "object" ? body as ConnectRequestBody : {};
};

const sessionKey = (code: string) => `devhub:connect:${createHash("sha256").update(code).digest("hex")}`;

const advancePosition = (state: ConnectSessionState, now: number) => {
    if (!state.isPlaying) return state.positionMs;
    const next = state.positionMs + Math.max(0, now - state.updatedAt);
    return Math.min(state.durationMs || next, next);
};

export default async function handler(request: ConnectApiRequest, response: ConnectApiResponse) {
    response.setHeader("Cache-Control", "no-store, max-age=0");
    response.setHeader("Pragma", "no-cache");

    try {
        const redis = getRedis();
        if (request.method === "GET") {
            const rawCode = Array.isArray(request.query?.code) ? request.query?.code[0] : request.query?.code;
            const code = normalizeCode(rawCode);
            if (!CODE_PATTERN.test(code)) {
                response.status(400).json({ error: "El código de conexión no es válido." });
                return;
            }
            const state = await redis.get<ConnectSessionState>(sessionKey(code));
            if (!state) {
                response.status(404).json({ error: "La sesión ya no existe o el código es incorrecto." });
                return;
            }
            response.status(200).json(state);
            return;
        }

        if (request.method !== "POST") {
            response.setHeader("Allow", "GET, POST");
            response.status(405).json({ error: "Method not allowed" });
            return;
        }

        const body = parseBody(request.body);
        const code = normalizeCode(body.code);
        const deviceId = cleanText(body.deviceId, 100);
        const deviceName = cleanText(body.deviceName, 80) || "Otro dispositivo";
        if (!CODE_PATTERN.test(code) || deviceId.length < 12) {
            response.status(400).json({ error: "Faltan los datos seguros del dispositivo." });
            return;
        }

        const key = sessionKey(code);
        const existing = await redis.get<ConnectSessionState>(key);
        const now = Date.now();

        if (body.action === "create") {
            const state: ConnectSessionState = {
                ...cleanSnapshot(body.snapshot),
                version: 1,
                activeDeviceId: deviceId,
                activeDeviceName: deviceName,
                updatedAt: now,
            };
            const created = await redis.set(key, state, { ex: SESSION_TTL_SECONDS, nx: true });
            if (!created) {
                response.status(409).json({ error: "Ese código ya está en uso." });
                return;
            }
            response.status(201).json(state);
            return;
        }

        if (!existing) {
            response.status(404).json({ error: "La sesión ya no existe o el código es incorrecto." });
            return;
        }

        if (body.action === "claim") {
            const state: ConnectSessionState = {
                ...existing,
                positionMs: advancePosition(existing, now),
                activeDeviceId: deviceId,
                activeDeviceName: deviceName,
                version: existing.version + 1,
                updatedAt: now,
            };
            await redis.set(key, state, { ex: SESSION_TTL_SECONDS });
            response.status(200).json(state);
            return;
        }

        if (body.action === "command") {
            const command = cleanCommand(body.command, deviceName);
            if (!command) {
                response.status(400).json({ error: "El comando remoto no es válido." });
                return;
            }
            const result = await redis.eval<[string, string, number], number>(
                COMMAND_IF_REMOTE_SCRIPT,
                [key],
                [deviceId, JSON.stringify(command), SESSION_TTL_SECONDS]
            );
            if (result === -1) {
                response.status(404).json({ error: "La sesión ya no existe o el código es incorrecto." });
                return;
            }
            if (result !== 1) {
                response.status(409).json({ error: "Este dispositivo ya controla la reproducción." });
                return;
            }
            response.status(202).json(await redis.get<ConnectSessionState>(key));
            return;
        }

        if (body.action === "publish") {
            const state: ConnectSessionState = {
                ...cleanSnapshot(body.snapshot),
                activeDeviceId: deviceId,
                activeDeviceName: deviceName,
                version: existing.version + 1,
                updatedAt: now,
            };
            const result = await redis.eval<[string, string, number, string], number>(
                PUBLISH_IF_OWNER_SCRIPT,
                [key],
                [deviceId, JSON.stringify(state), SESSION_TTL_SECONDS, cleanText(body.ackCommandId, 100)]
            );
            if (result === -1) {
                response.status(404).json({ error: "La sesión ya no existe o el código es incorrecto." });
                return;
            }
            if (result !== 1) {
                const latest = await redis.get<ConnectSessionState>(key);
                response.status(409).json({
                    error: `La reproducción está activa en ${latest?.activeDeviceName || "otro dispositivo"}.`,
                    state: latest || existing,
                });
                return;
            }
            response.status(200).json(await redis.get<ConnectSessionState>(key) || state);
            return;
        }

        response.status(400).json({ error: "Acción de conexión no válida." });
    } catch (error) {
        console.error("Dev Hub Connect error", error);
        response.status(500).json({ error: "Dev Hub Connect no está disponible por el momento." });
    }
}
