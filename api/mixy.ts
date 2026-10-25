import { createHash, randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import type {
    MixyControl,
    MixyParticipant,
    MixyPlayback,
    MixyProvider,
    MixyRoom,
    MixySource,
    MixyTrack,
} from "../src/lib/mixy.js";

interface ApiRequest {
    method?: string;
    query?: Record<string, string | string[] | undefined>;
    body?: unknown;
}

interface ApiResponse {
    status: (code: number) => ApiResponse;
    json: (body: unknown) => void;
    setHeader: (name: string, value: string) => void;
}

interface MixyRequestBody {
    action?: "create" | "join" | "heartbeat" | "leave" | "add-track" | "remove-track" | "control";
    code?: string;
    deviceId?: string;
    participantName?: string;
    providers?: MixyProvider[];
    ready?: boolean;
    activeProvider?: MixyProvider | null;
    syncOffsetMs?: number | null;
    track?: MixyTrack;
    trackId?: string;
    control?: MixyControl;
}

const ROOM_TTL_SECONDS = 60 * 60 * 6;
const PARTICIPANT_STALE_MS = 30_000;
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{16}$/;
const DEVICE_PATTERN = /^[A-Za-z0-9-]{12,100}$/;
const PROVIDERS: MixyProvider[] = ["spotify", "youtube", "soundcloud", "local"];

const getRedis = () => {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (!url || !token) throw new Error("Mixy storage is not configured");
    return new Redis({ url, token });
};

const parseBody = (body: unknown): MixyRequestBody => {
    if (typeof body === "string") return JSON.parse(body) as MixyRequestBody;
    return body && typeof body === "object" ? body as MixyRequestBody : {};
};

const normalizeCode = (value = "") => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
const cleanText = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const finiteNumber = (value: unknown, min: number, max: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : min;
};
const roomKey = (code: string) => `devhub:mixy:${createHash("sha256").update(code).digest("hex")}`;
const lockKey = (code: string) => `${roomKey(code)}:lock`;

const cleanProviders = (value: unknown): MixyProvider[] =>
    Array.isArray(value) ? value.filter((provider): provider is MixyProvider => PROVIDERS.includes(provider as MixyProvider)) : [];

const cleanSource = (value: unknown, provider: MixyProvider): MixySource | null => {
    if (!value || typeof value !== "object") return null;
    const source = value as Partial<MixySource>;
    const uri = cleanText(source.uri, 1_500);
    const id = cleanText(source.id, 180);
    if (!uri || !id || source.provider !== provider) return null;
    if (provider === "spotify" && !/^spotify:track:[A-Za-z0-9]+$/.test(uri)) return null;
    if (provider === "youtube" && !/^[A-Za-z0-9_-]{6,32}$/.test(id)) return null;
    if (provider === "soundcloud" && !/^https:\/\/(?:on\.)?soundcloud\.com\//i.test(uri)) return null;
    if (provider === "local" && !/^https:\/\//i.test(uri)) return null;
    return {
        provider,
        id,
        uri,
        title: cleanText(source.title, 200) || "Untitled track",
        artist: cleanText(source.artist, 160) || provider,
        image: cleanText(source.image, 1_500),
        durationMs: finiteNumber(source.durationMs, 0, 1000 * 60 * 60 * 12),
        offsetMs: finiteNumber(source.offsetMs, -120_000, 120_000),
    };
};

const cleanTrack = (value: unknown, deviceId: string, participantName: string): MixyTrack | null => {
    if (!value || typeof value !== "object") return null;
    const candidate = value as Partial<MixyTrack>;
    const sources: Partial<Record<MixyProvider, MixySource>> = {};
    PROVIDERS.forEach((provider) => {
        const source = cleanSource(candidate.sources?.[provider], provider);
        if (source) sources[provider] = source;
    });
    const available = Object.values(sources).filter(Boolean);
    if (!available.length) return null;
    const preferredProvider = PROVIDERS.includes(candidate.preferredProvider as MixyProvider)
        ? candidate.preferredProvider as MixyProvider
        : available[0]!.provider;
    const preferred = sources[preferredProvider] || available[0]!;
    return {
        id: cleanText(candidate.id, 100) || randomUUID(),
        title: cleanText(candidate.title, 200) || preferred.title,
        artist: cleanText(candidate.artist, 160) || preferred.artist,
        image: cleanText(candidate.image, 1_500) || preferred.image,
        durationMs: finiteNumber(candidate.durationMs || preferred.durationMs, 0, 1000 * 60 * 60 * 12),
        preferredProvider,
        sources,
        addedBy: deviceId,
        addedByName: participantName,
        addedAt: Date.now(),
    };
};

const currentPosition = (playback: MixyPlayback, now: number) => {
    if (!playback.isPlaying || now < playback.updatedAt) return playback.positionMs;
    return Math.min(playback.durationMs || Number.MAX_SAFE_INTEGER, playback.positionMs + Math.max(0, now - playback.updatedAt));
};

const cleanRoomForRead = (room: MixyRoom, now: number): MixyRoom => ({
    ...room,
    participants: room.participants.filter((participant) => participant.isHost || now - participant.lastSeen <= PARTICIPANT_STALE_MS),
});

const acquireLock = async (redis: Redis, code: string) => {
    const token = randomUUID();
    for (let attempt = 0; attempt < 15; attempt += 1) {
        const acquired = await redis.set(lockKey(code), token, { nx: true, px: 4_000 });
        if (acquired) return token;
        await new Promise((resolve) => setTimeout(resolve, 25 + attempt * 10));
    }
    throw new Error("Mixy room is busy");
};

const releaseLock = async (redis: Redis, code: string, token: string) => {
    await redis.eval(
        "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
        [lockKey(code)],
        [token],
    );
};

const mutateRoom = async (redis: Redis, code: string, mutation: (room: MixyRoom) => MixyRoom) => {
    const token = await acquireLock(redis, code);
    try {
        const room = await redis.get<MixyRoom>(roomKey(code));
        if (!room) return null;
        const next = mutation(room);
        next.version += 1;
        next.updatedAt = Date.now();
        await redis.set(roomKey(code), next, { ex: ROOM_TTL_SECONDS });
        return next;
    } finally {
        await releaseLock(redis, code, token);
    }
};

export default async function handler(request: ApiRequest, response: ApiResponse) {
    response.setHeader("Cache-Control", "no-store, max-age=0");
    response.setHeader("Pragma", "no-cache");
    try {
        const redis = getRedis();
        const now = Date.now();
        if (request.method === "GET") {
            const rawCode = Array.isArray(request.query?.code) ? request.query?.code[0] : request.query?.code;
            const code = normalizeCode(rawCode);
            if (!CODE_PATTERN.test(code)) return response.status(400).json({ error: "El codigo de Mixy no es valido." });
            const room = await redis.get<MixyRoom>(roomKey(code));
            if (!room) return response.status(404).json({ error: "La sala Mixy ya no existe." });
            return response.status(200).json({ room: cleanRoomForRead(room, now), serverNow: now });
        }
        if (request.method !== "POST") {
            response.setHeader("Allow", "GET, POST");
            return response.status(405).json({ error: "Method not allowed" });
        }

        const body = parseBody(request.body);
        const code = normalizeCode(body.code);
        const deviceId = cleanText(body.deviceId, 100);
        const participantName = cleanText(body.participantName, 40) || "Player";
        if (!CODE_PATTERN.test(code) || !DEVICE_PATTERN.test(deviceId)) {
            return response.status(400).json({ error: "Faltan los datos seguros de la sala." });
        }

        if (body.action === "create") {
            const participant: MixyParticipant = {
                id: deviceId,
                name: participantName,
                isHost: true,
                ready: body.ready === true,
                providers: cleanProviders(body.providers),
                activeProvider: null,
                syncOffsetMs: null,
                lastSeen: now,
            };
            const room: MixyRoom = {
                version: 1,
                hostDeviceId: deviceId,
                participants: [participant],
                queue: [],
                playback: {
                    trackId: null,
                    queueIndex: -1,
                    isPlaying: false,
                    positionMs: 0,
                    durationMs: 0,
                    effectiveAt: now,
                    updatedAt: now,
                    revision: 1,
                },
                autoplay: true,
                createdAt: now,
                updatedAt: now,
            };
            const created = await redis.set(roomKey(code), room, { ex: ROOM_TTL_SECONDS, nx: true });
            if (!created) return response.status(409).json({ error: "Ese codigo Mixy ya esta ocupado." });
            return response.status(201).json({ room, serverNow: now });
        }

        const room = await mutateRoom(redis, code, (current) => {
            const next = { ...current, participants: [...current.participants], queue: [...current.queue], playback: { ...current.playback } };
            const existingIndex = next.participants.findIndex((participant) => participant.id === deviceId);
            const isHost = current.hostDeviceId === deviceId;
            const participant: MixyParticipant = {
                id: deviceId,
                name: participantName,
                isHost,
                ready: typeof body.ready === "boolean" ? body.ready : next.participants[existingIndex]?.ready === true,
                providers: cleanProviders(body.providers).length ? cleanProviders(body.providers) : next.participants[existingIndex]?.providers || [],
                activeProvider: body.activeProvider === null || PROVIDERS.includes(body.activeProvider as MixyProvider)
                    ? body.activeProvider as MixyProvider | null
                    : next.participants[existingIndex]?.activeProvider || null,
                syncOffsetMs: body.syncOffsetMs === null ? null : Number.isFinite(Number(body.syncOffsetMs))
                    ? finiteNumber(body.syncOffsetMs, -120_000, 120_000)
                    : next.participants[existingIndex]?.syncOffsetMs || null,
                lastSeen: now,
            };
            if (existingIndex >= 0) next.participants[existingIndex] = participant;
            else next.participants.push(participant);

            if (body.action === "leave") {
                next.participants = next.participants.filter((entry) => entry.id !== deviceId);
                return next;
            }
            if (body.action === "join" || body.action === "heartbeat") return next;
            if (body.action === "add-track") {
                const track = cleanTrack(body.track, deviceId, participantName);
                if (!track || next.queue.length >= 100) return next;
                next.queue.push(track);
                if (next.playback.queueIndex < 0) {
                    next.playback.queueIndex = 0;
                    next.playback.trackId = track.id;
                    next.playback.durationMs = track.durationMs;
                    next.playback.revision += 1;
                }
                return next;
            }
            if (body.action === "remove-track") {
                if (!isHost) return next;
                const index = next.queue.findIndex((track) => track.id === body.trackId);
                if (index < 0) return next;
                next.queue.splice(index, 1);
                if (!next.queue.length) {
                    next.playback = { ...next.playback, trackId: null, queueIndex: -1, isPlaying: false, positionMs: 0, durationMs: 0, revision: next.playback.revision + 1 };
                } else if (index <= next.playback.queueIndex) {
                    next.playback.queueIndex = Math.max(0, next.playback.queueIndex - 1);
                    const active = next.queue[next.playback.queueIndex];
                    next.playback.trackId = active.id;
                    next.playback.durationMs = active.durationMs;
                    next.playback.revision += 1;
                }
                return next;
            }
            if (body.action === "control" && body.control) {
                const control = body.control;
                const playback = next.playback;
                const selectIndex = (index: number) => {
                    if (!next.queue.length) return;
                    const queueIndex = Math.max(0, Math.min(next.queue.length - 1, index));
                    const track = next.queue[queueIndex];
                    next.playback = {
                        ...playback,
                        trackId: track.id,
                        queueIndex,
                        isPlaying: true,
                        positionMs: 0,
                        durationMs: track.durationMs,
                        effectiveAt: now + 1_500,
                        updatedAt: now + 1_500,
                        revision: playback.revision + 1,
                    };
                };
                if (control.type === "play-index") selectIndex(control.queueIndex);
                else if (control.type === "next") selectIndex((playback.queueIndex + 1) % Math.max(1, next.queue.length));
                else if (control.type === "previous") selectIndex(playback.queueIndex <= 0 ? next.queue.length - 1 : playback.queueIndex - 1);
                else if (control.type === "set-autoplay") next.autoplay = control.enabled;
                else if (control.type === "play") {
                    if (playback.queueIndex < 0 && next.queue.length) selectIndex(0);
                    else next.playback = { ...playback, isPlaying: true, effectiveAt: now + 900, updatedAt: now + 900, revision: playback.revision + 1 };
                } else if (control.type === "pause") {
                    next.playback = { ...playback, positionMs: currentPosition(playback, now), isPlaying: false, effectiveAt: now, updatedAt: now, revision: playback.revision + 1 };
                } else if (control.type === "seek") {
                    next.playback = { ...playback, positionMs: finiteNumber(control.positionMs, 0, playback.durationMs || 1000 * 60 * 60 * 12), effectiveAt: now + 500, updatedAt: now + 500, revision: playback.revision + 1 };
                }
            }
            return next;
        });
        if (!room) return response.status(404).json({ error: "La sala Mixy ya no existe." });
        return response.status(200).json({ room: cleanRoomForRead(room, now), serverNow: now });
    } catch (error) {
        console.error("Mixy room error", error);
        return response.status(500).json({ error: "Mixy no esta disponible por el momento." });
    }
}
