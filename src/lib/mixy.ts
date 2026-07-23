export type MixyProvider = "spotify" | "youtube" | "soundcloud" | "local";

export interface MixySource {
    provider: MixyProvider;
    id: string;
    uri: string;
    title: string;
    artist: string;
    image: string;
    durationMs: number;
    offsetMs: number;
}

export interface MixyTrack {
    id: string;
    title: string;
    artist: string;
    image: string;
    durationMs: number;
    preferredProvider: MixyProvider;
    sources: Partial<Record<MixyProvider, MixySource>>;
    addedBy: string;
    addedByName: string;
    addedAt: number;
}

export interface MixyParticipant {
    id: string;
    name: string;
    isHost: boolean;
    ready: boolean;
    providers: MixyProvider[];
    activeProvider: MixyProvider | null;
    syncOffsetMs: number | null;
    lastSeen: number;
}

export interface MixyPlayback {
    trackId: string | null;
    queueIndex: number;
    isPlaying: boolean;
    positionMs: number;
    durationMs: number;
    effectiveAt: number;
    updatedAt: number;
    revision: number;
}

export interface MixyRoom {
    version: number;
    hostDeviceId: string;
    participants: MixyParticipant[];
    queue: MixyTrack[];
    playback: MixyPlayback;
    createdAt: number;
    updatedAt: number;
}

export interface MixyRoomResponse {
    room: MixyRoom;
    serverNow: number;
}

export interface MixySearchCandidate extends MixySource {
    available: boolean;
}

export type MixyControl =
    | { type: "play" | "pause" | "next" | "previous" }
    | { type: "seek"; positionMs: number }
    | { type: "play-index"; queueIndex: number };

export interface MixyApiError {
    error: string;
}

const MIXY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const normalizeMixyCode = (value: string) =>
    value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);

export const formatMixyCode = (value: string) =>
    normalizeMixyCode(value).replace(/(.{4})(?=.)/g, "$1-");

export const createMixyCode = () => {
    const random = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(random, (byte) => MIXY_ALPHABET[byte & 31]).join("");
};

export const extrapolateMixyPosition = (playback: MixyPlayback, now = Date.now()) => {
    if (!playback.isPlaying || now < playback.updatedAt) return playback.positionMs;
    const elapsed = Math.max(0, now - playback.updatedAt);
    return Math.min(playback.durationMs || Number.MAX_SAFE_INTEGER, playback.positionMs + elapsed);
};

const normalizeWords = (value: string) =>
    value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\b(official|audio|video|lyrics?|topic|hd|hq|provided to youtube)\b/g, " ")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

const overlap = (left: string[], right: string[]) => {
    if (!left.length || !right.length) return 0;
    const a = new Set(left);
    const b = new Set(right);
    let shared = 0;
    a.forEach((word) => { if (b.has(word)) shared += 1; });
    return (2 * shared) / (a.size + b.size);
};

const VERSION_PENALTY = /\b(live|remix|cover|nightcore|sped up|slowed|reverb|karaoke|instrumental)\b/i;

export const scoreMixyCandidate = (reference: MixySearchCandidate, candidate: MixySearchCandidate) => {
    const titleScore = overlap(normalizeWords(reference.title), normalizeWords(candidate.title));
    const artistScore = overlap(normalizeWords(reference.artist), normalizeWords(candidate.artist));
    const durationScore = reference.durationMs > 0 && candidate.durationMs > 0
        ? Math.max(0, 1 - Math.abs(reference.durationMs - candidate.durationMs) / 15_000)
        : 0.45;
    const versionPenalty = VERSION_PENALTY.test(candidate.title) !== VERSION_PENALTY.test(reference.title) ? 0.25 : 0;
    return Math.max(0, titleScore * 0.55 + artistScore * 0.3 + durationScore * 0.15 - versionPenalty);
};

export const buildFederatedMixyTrack = (
    selected: MixySearchCandidate,
    candidates: MixySearchCandidate[],
    participantId: string,
    participantName: string,
): MixyTrack => {
    const sources: Partial<Record<MixyProvider, MixySource>> = { [selected.provider]: selected };
    const providers: MixyProvider[] = ["spotify", "youtube", "soundcloud", "local"];

    providers.forEach((provider) => {
        if (provider === selected.provider) return;
        const best = candidates
            .filter((candidate) => candidate.provider === provider && candidate.available)
            .map((candidate) => ({ candidate, score: scoreMixyCandidate(selected, candidate) }))
            .sort((a, b) => b.score - a.score)[0];
        if (best && best.score >= 0.68) sources[provider] = best.candidate;
    });

    const durationMs = selected.durationMs || Object.values(sources).find((source) => source?.durationMs)?.durationMs || 0;
    return {
        id: crypto.randomUUID(),
        title: selected.title,
        artist: selected.artist,
        image: selected.image,
        durationMs,
        preferredProvider: selected.provider,
        sources,
        addedBy: participantId,
        addedByName: participantName,
        addedAt: Date.now(),
    };
};

export const pickMixySource = (
    track: MixyTrack,
    availableProviders: MixyProvider[],
): MixySource | null => {
    const available = new Set(availableProviders);
    const preferred = track.sources[track.preferredProvider];
    if (preferred && available.has(preferred.provider)) return preferred;
    for (const provider of ["spotify", "youtube", "soundcloud", "local"] as MixyProvider[]) {
        const source = track.sources[provider];
        if (source && available.has(provider)) return source;
    }
    return null;
};

const mixyRequest = async <T>(url: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(url, {
        ...init,
        headers: { "Content-Type": "application/json", ...init?.headers },
        cache: "no-store",
    });
    const payload = await response.json().catch(() => ({ error: "Respuesta invalida del servidor." })) as T | MixyApiError;
    if (!response.ok) {
        const message = payload && typeof payload === "object" && "error" in payload ? payload.error : "Mixy no pudo completar la operacion.";
        throw new Error(message);
    }
    return payload as T;
};

export const readMixyRoom = (code: string) =>
    mixyRequest<MixyRoomResponse>(`/api/mixy?code=${encodeURIComponent(normalizeMixyCode(code))}`);

export const mutateMixyRoom = (
    action: string,
    code: string,
    deviceId: string,
    participantName: string,
    payload: Record<string, unknown> = {},
) => mixyRequest<MixyRoomResponse>("/api/mixy", {
    method: "POST",
    body: JSON.stringify({ action, code, deviceId, participantName, ...payload }),
});
