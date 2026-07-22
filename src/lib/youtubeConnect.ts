export type ConnectShuffleMode = "off" | "shuffle" | "smart";

export interface ConnectTrack {
    id: string;
    videoId: string;
    uri: string;
    title: string;
    artist: string;
    image: string;
    durationMs: number;
    duration: string;
}

export interface ConnectPlaybackSnapshot {
    track: ConnectTrack | null;
    queue: ConnectTrack[];
    queueIndex: number;
    positionMs: number;
    durationMs: number;
    isPlaying: boolean;
    shuffleMode: ConnectShuffleMode;
    repeatMode: 0 | 1 | 2;
}

export interface ConnectSessionState extends ConnectPlaybackSnapshot {
    version: number;
    activeDeviceId: string;
    activeDeviceName: string;
    updatedAt: number;
}

export interface ConnectApiError {
    error: string;
    state?: ConnectSessionState;
}

const CONNECT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const normalizeConnectCode = (value: string) =>
    value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);

export const formatConnectCode = (value: string) =>
    normalizeConnectCode(value).replace(/(.{4})(?=.)/g, "$1-");

export const createConnectCode = () => {
    const random = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(random, (byte) => CONNECT_ALPHABET[byte & 31]).join("");
};

const connectRequest = async <T>(url: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(url, {
        ...init,
        headers: { "Content-Type": "application/json", ...init?.headers },
        cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({ error: "Respuesta inválida del servidor." }))) as T | ConnectApiError;
    if (!response.ok) {
        const error = new Error("error" in payload ? payload.error : "No se pudo sincronizar el dispositivo.");
        Object.assign(error, { status: response.status, payload });
        throw error;
    }
    return payload as T;
};

export const createConnectSession = (code: string, deviceId: string, deviceName: string, snapshot: ConnectPlaybackSnapshot) =>
    connectRequest<ConnectSessionState>("/api/connect", {
        method: "POST",
        body: JSON.stringify({ action: "create", code, deviceId, deviceName, snapshot }),
    });

export const readConnectSession = (code: string) =>
    connectRequest<ConnectSessionState>(`/api/connect?code=${encodeURIComponent(normalizeConnectCode(code))}`);

export const publishConnectSession = (code: string, deviceId: string, deviceName: string, snapshot: ConnectPlaybackSnapshot) =>
    connectRequest<ConnectSessionState>("/api/connect", {
        method: "POST",
        body: JSON.stringify({ action: "publish", code, deviceId, deviceName, snapshot }),
    });

export const claimConnectSession = (code: string, deviceId: string, deviceName: string) =>
    connectRequest<ConnectSessionState>("/api/connect", {
        method: "POST",
        body: JSON.stringify({ action: "claim", code, deviceId, deviceName }),
    });

export const extrapolateConnectPosition = (state: ConnectSessionState, now = Date.now()) => {
    if (!state.isPlaying) return state.positionMs;
    const elapsed = Math.max(0, now - state.updatedAt);
    return Math.min(state.durationMs || Number.MAX_SAFE_INTEGER, state.positionMs + elapsed);
};
