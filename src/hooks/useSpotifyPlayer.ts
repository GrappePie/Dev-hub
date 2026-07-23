import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import fallbackAlbumArt from "@/assets/album-art-placeholder.svg";
import { getNextShuffleMode } from "@/lib/shuffleMode";
import { getSmartShuffleCandidate, getSpotifyArtistTopTracksPath, getSpotifyRecommendationsPath } from "@/lib/spotifySmartShuffle";

const STORAGE = {
    ACCESS_TOKEN: "spotify_access_token",
    REFRESH_TOKEN: "spotify_refresh_token",
    EXPIRES_AT: "spotify_token_expires_at",
    CODE_VERIFIER: "spotify_code_verifier",
    OAUTH_STATE: "spotify_oauth_state",
    VOLUME: "mh_vol",
} as const;

const normalizeRedirectUri = (uri: string) => {
    try {
        const parsed = new URL(uri.trim());
        if (parsed.hostname === "localhost") {
            parsed.hostname = "127.0.0.1";
        }
        return parsed.toString();
    } catch {
        return uri.trim();
    }
};

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || "70c6ed29b0e84d2ca00a2a9d157520cc";
const DEFAULT_REDIRECT_URI = `${window.location.origin}${window.location.pathname}`;
const REDIRECT_URI = normalizeRedirectUri(import.meta.env.VITE_SPOTIFY_REDIRECT_URI || DEFAULT_REDIRECT_URI);
const SPOTIFY_STATE_PREFIX = "sp_";
const SCOPES = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-library-read",
    "user-read-playback-state",
    "user-modify-playback-state",
    "playlist-read-private",
    "playlist-read-collaborative",
    "user-library-modify",
    "user-read-currently-playing",
].join(" ");

interface TokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
}

interface SpotifyTokenError {
    error?: string;
    error_description?: string;
}

interface OAuthPopupMessage {
    type?: string;
    code?: string;
    state?: string | null;
    error?: string;
}

interface AuthFeedback {
    id: number;
    kind: "success" | "error";
}

interface SpotifyArtist {
    id?: string;
    name: string;
    uri?: string;
}

interface SpotifyImage {
    url: string;
    width?: number;
    height?: number;
}

interface SpotifyAlbum {
    id: string;
    name: string;
    images?: SpotifyImage[];
}

interface SpotifyPlaylist {
    id: string;
    name: string;
    images?: SpotifyImage[];
    owner?: { display_name?: string };
    tracks?: { total?: number };
}

interface SpotifyDevice {
    id: string;
    is_active: boolean;
    is_restricted: boolean;
    name: string;
    type: string;
}

interface SpotifyTrackDetails extends SpotifyWebTrack {
    preview_url?: string | null;
}

interface SpotifySearchResponse {
    tracks?: { items?: SpotifyTrackDetails[] };
    albums?: { items?: SpotifyAlbum[] };
    artists?: { items?: Array<{ id: string; name: string; images?: SpotifyImage[] }> };
}

export interface QueueTrack {
    id: string;
    title: string;
    artist: string;
    duration: string;
    uri: string;
}

export interface CurrentTrack {
    id: string;
    uri: string;
    title: string;
    artist: string;
    artistNames: string[];
    durationMs: number;
    duration: string;
    albumArt: string;
    externalUrl?: string;
    artistId?: string;
}

export interface ArtistTopTrack {
    id: string;
    uri: string;
    title: string;
    artist: string;
    duration: string;
    albumArt: string;
}

export interface ArtistData {
    id: string;
    name: string;
    image: string;
    followers?: number;
    genres?: string[];
    externalUrl?: string;
    topTracks: ArtistTopTrack[];
}

export interface DeviceItem {
    id: string;
    name: string;
    type: string;
    isActive: boolean;
    isRestricted: boolean;
}

export interface PlaylistItem {
    id: string;
    name: string;
    owner: string;
    image: string;
    tracksTotal: number;
}

export interface SearchTrackItem {
    id: string;
    uri: string;
    name: string;
    artist: string;
    image: string;
}

export interface SearchAlbumItem {
    id: string;
    name: string;
    image: string;
}

export interface SearchArtistItem {
    id: string;
    name: string;
    image: string;
}

export interface SearchResults {
    tracks: SearchTrackItem[];
    albums: SearchAlbumItem[];
    artists: SearchArtistItem[];
}

const EMPTY_SEARCH_RESULTS: SearchResults = {
    tracks: [],
    albums: [],
    artists: [],
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const extractTokenErrorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "unknown_error";
};

const formatMs = (ms = 0) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const extractSpotifyErrorMessage = async (response: Response) => {
    try {
        const raw = await response.clone().text();
        if (!raw) return "";
        const parsed = JSON.parse(raw) as { error?: { message?: string; reason?: string } };
        return parsed?.error?.message || parsed?.error?.reason || "";
    } catch {
        return "";
    }
};

const readStoredVolume = () => {
    const raw = localStorage.getItem(STORAGE.VOLUME);
    const parsed = raw ? Number(raw) : 0.5;
    if (!Number.isFinite(parsed)) return 0.5;
    return Math.max(0, Math.min(1, parsed));
};

const generateRandomString = (length: number) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let text = "";
    for (let i = 0; i < length; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
};

const generateCodeChallenge = async (codeVerifier: string) => {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
};

const mapQueue = (tracks: SpotifyWebTrack[] = []): QueueTrack[] =>
    tracks.map((track, index) => ({
        id: track.id || `${track.uri}-${index}`,
        title: track.name || "Unknown track",
        artist: (track.artists || []).map((artist) => artist.name).join(", ") || "Unknown artist",
        duration: formatMs(track.duration_ms || 0),
        uri: track.uri,
    }));

const mapTrack = (track?: SpotifyWebTrack | null): CurrentTrack | null => {
    if (!track) return null;
    const names = (track.artists || []).map((a) => a.name).filter(Boolean);
    return {
        id: track.id,
        uri: track.uri,
        title: track.name || "Sin título",
        artist: names.join(", ") || "Sin artista",
        artistNames: names.length ? names : ["Sin artista"],
        durationMs: track.duration_ms || 0,
        duration: formatMs(track.duration_ms || 0),
        albumArt: track.album?.images?.[0]?.url || fallbackAlbumArt,
        externalUrl: track.external_urls?.spotify,
        artistId: (track.artists || []).find((artist) => artist.id)?.id,
    };
};

const mapDevices = (devices: SpotifyDevice[]): DeviceItem[] =>
    devices.map((device) => ({
        id: device.id,
        name: device.name,
        type: device.type,
        isActive: device.is_active,
        isRestricted: device.is_restricted,
    }));

const mapPlaylists = (items: SpotifyPlaylist[]): PlaylistItem[] =>
    items.map((playlist) => ({
        id: playlist.id,
        name: playlist.name,
        owner: playlist.owner?.display_name || "Unknown owner",
        image: playlist.images?.[0]?.url || fallbackAlbumArt,
        tracksTotal: playlist.tracks?.total || 0,
    }));

const mapSearchResults = (data: SpotifySearchResponse): SearchResults => ({
    tracks: (data.tracks?.items || []).map((track) => ({
        id: track.id,
        uri: track.uri,
        name: track.name || "Sin título",
        artist: (track.artists || []).map((artist) => artist.name).join(", ") || "Sin artista",
        image: track.album?.images?.[2]?.url || track.album?.images?.[0]?.url || fallbackAlbumArt,
    })),
    albums: (data.albums?.items || []).map((album) => ({
        id: album.id,
        name: album.name || "Sin nombre",
        image: album.images?.[2]?.url || album.images?.[0]?.url || fallbackAlbumArt,
    })),
    artists: (data.artists?.items || []).map((artist) => ({
        id: artist.id,
        name: artist.name || "Sin nombre",
        image: artist.images?.[2]?.url || artist.images?.[0]?.url || fallbackAlbumArt,
    })),
});

export const useSpotifyPlayer = () => {
    const playerRef = useRef<SpotifyPlayer | null>(null);
    const deviceIdRef = useRef<string | null>(null);
    const sdkDeviceIdRef = useRef<string | null>(null);
    const accessTokenRef = useRef<string | null>(null);
    const refreshTokenRef = useRef<string | null>(null);
    const tokenExpiresAtRef = useRef<number | null>(null);
    const autoRefreshTriggeredRef = useRef(false);
    const lastLikeTrackIdRef = useRef<string | null>(null);
    const playlistsNextRef = useRef<string | null>(null);
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);
    const sdkAuthRecoveringRef = useRef(false);

    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState<string | null>(null);
    const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);
    const [sdkReady, setSdkReady] = useState(false);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [statusText, setStatusText] = useState("Conecta tu cuenta para empezar.");
    const [sessionCountdown, setSessionCountdown] = useState("—");

    const [isPlaying, setIsPlaying] = useState(false);
    const [shuffleMode, setShuffleMode] = useState<"off" | "shuffle" | "smart">("off");
    const shuffleModeRef = useRef<"off" | "shuffle" | "smart">("off");
    const prevSmartTrackIdRef = useRef<string | null>(null);
    const [repeatMode, setRepeatMode] = useState(0);
    const [volume, setVolume] = useState(readStoredVolume);
    const [positionMs, setPositionMs] = useState(0);
    const [durationMs, setDurationMs] = useState(0);
    const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null);
    const [queue, setQueue] = useState<QueueTrack[]>([]);
    const [isLiked, setIsLiked] = useState(false);

    const [devices, setDevices] = useState<DeviceItem[]>([]);
    const [activeDeviceName, setActiveDeviceName] = useState("Dispositivo");

    const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
    const [playlistsLoading, setPlaylistsLoading] = useState(false);
    const [playlistsHasMore, setPlaylistsHasMore] = useState(false);
    const [libraryLoaded, setLibraryLoaded] = useState(false);

    const [searchResults, setSearchResults] = useState<SearchResults>(EMPTY_SEARCH_RESULTS);
    const [searchLoading, setSearchLoading] = useState(false);
    const [authFeedback, setAuthFeedback] = useState<AuthFeedback | null>(null);

    const emitAuthFeedback = useCallback((kind: AuthFeedback["kind"]) => {
        setAuthFeedback({
            id: Date.now() + Math.floor(Math.random() * 1000),
            kind,
        });
    }, []);

    useEffect(() => {
        previewAudioRef.current = new Audio();
        return () => {
            if (!previewAudioRef.current) return;
            previewAudioRef.current.pause();
            previewAudioRef.current.src = "";
        };
    }, []);

    useEffect(() => {
        accessTokenRef.current = accessToken;
    }, [accessToken]);

    useEffect(() => {
        refreshTokenRef.current = refreshToken;
    }, [refreshToken]);

    useEffect(() => {
        tokenExpiresAtRef.current = tokenExpiresAt;
    }, [tokenExpiresAt]);

    const clearAuthState = useCallback(() => {
        setAccessToken(null);
        setRefreshToken(null);
        setTokenExpiresAt(null);
        localStorage.removeItem(STORAGE.ACCESS_TOKEN);
        localStorage.removeItem(STORAGE.REFRESH_TOKEN);
        localStorage.removeItem(STORAGE.EXPIRES_AT);
        localStorage.removeItem(STORAGE.CODE_VERIFIER);
        localStorage.removeItem(STORAGE.OAUTH_STATE);
    }, []);

    const applyTokenResponse = useCallback((data: TokenResponse) => {
        const expiresAt = Date.now() + data.expires_in * 1000;
        // Update refs synchronously so getOAuthToken reads the new token immediately,
        // without waiting for React to flush the state update via useEffect.
        accessTokenRef.current = data.access_token;
        tokenExpiresAtRef.current = expiresAt;
        setAccessToken(data.access_token);
        setTokenExpiresAt(expiresAt);
        localStorage.setItem(STORAGE.ACCESS_TOKEN, data.access_token);
        localStorage.setItem(STORAGE.EXPIRES_AT, String(expiresAt));
        if (data.refresh_token) {
            refreshTokenRef.current = data.refresh_token;
            setRefreshToken(data.refresh_token);
            localStorage.setItem(STORAGE.REFRESH_TOKEN, data.refresh_token);
        }
    }, []);

    const tokenRequest = useCallback(async (body: Record<string, string>) => {
        const response = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams(body),
        });
        if (!response.ok) {
            let details = "";
            try {
                const payload = (await response.json()) as SpotifyTokenError;
                details = payload.error_description || payload.error || "";
            } catch {
                details = "";
            }
            throw new Error(details ? `Token endpoint error (${response.status}): ${details}` : `Token endpoint error (${response.status})`);
        }
        return (await response.json()) as TokenResponse;
    }, []);

    const refreshAccessToken = useCallback(async () => {
        const currentRefreshToken = refreshTokenRef.current;
        if (!currentRefreshToken) return false;
        try {
            const data = await tokenRequest({
                client_id: SPOTIFY_CLIENT_ID,
                grant_type: "refresh_token",
                refresh_token: currentRefreshToken,
            });
            applyTokenResponse(data);
            toast({ title: "Sesion actualizada", description: "El token se refresco automaticamente." });
            return true;
        } catch (error) {
            const message = extractTokenErrorMessage(error).toLowerCase();
            const isPermanentError = message.includes("invalid_grant") || message.includes("invalid_client");
            if (isPermanentError) {
                clearAuthState();
                setStatusText("Sesion expirada. Vuelve a conectar Spotify.");
            } else {
                setStatusText("No se pudo refrescar la sesion automaticamente. Reintentaremos.");
            }
            console.error(error);
            return false;
        }
    }, [applyTokenResponse, clearAuthState, tokenRequest]);

    const fetchWithRetry = useCallback(
        async (url: string, init: RequestInit = {}, retries = 2, backoffMs = 400): Promise<Response> => {
            try {
                const response = await fetch(url, init);
                if (response.status === 401) {
                    const refreshed = await refreshAccessToken();
                    if (refreshed && retries > 0) {
                        return fetchWithRetry(url, init, retries - 1, backoffMs * 1.6);
                    }
                }
                if ((response.status === 429 || (response.status >= 500 && response.status < 600)) && retries > 0) {
                    const retryAfter = Number(response.headers.get("Retry-After") || "0");
                    await sleep(Math.max(backoffMs, retryAfter * 1000));
                    return fetchWithRetry(url, init, retries - 1, backoffMs * 1.6);
                }
                return response;
            } catch (error) {
                if (retries > 0) {
                    await sleep(backoffMs);
                    return fetchWithRetry(url, init, retries - 1, backoffMs * 1.6);
                }
                throw error;
            }
        },
        [refreshAccessToken]
    );

    const api = useCallback(
        async (path: string, init: RequestInit = {}, opts: { silent?: boolean } = {}) => {
            const token = accessTokenRef.current;
            if (!token) throw new Error("Missing access token");
            const url = path.startsWith("http") ? path : `https://api.spotify.com/v1${path}`;
            const headers = {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                ...(init.headers || {}),
            };
            const response = await fetchWithRetry(url, { ...init, headers });
            if (!opts.silent && !response.ok && response.status !== 204) {
                const msg = await extractSpotifyErrorMessage(response);
                const details = msg ? ` · ${msg}` : "";
                toast({
                    variant: "destructive",
                    title: "Error de Spotify",
                    description: `La API respondio ${response.status}${details}.`,
                });
            }
            return response;
        },
        [fetchWithRetry]
    );

    const updateLikeStatus = useCallback(
        async (trackId?: string | null) => {
            if (!trackId) {
                setIsLiked(false);
                return;
            }
            if (lastLikeTrackIdRef.current === trackId) return;
            lastLikeTrackIdRef.current = trackId;
            const response = await api(`/me/tracks/contains?ids=${trackId}`, {}, { silent: true });
            if (!response.ok) return;
            const data = (await response.json()) as boolean[];
            setIsLiked(Boolean(data?.[0]));
        },
        [api]
    );

    const syncFromPlayerState = useCallback(
        async (state: SpotifyPlayerState | null) => {
            if (!state) return;
            const mappedTrack = mapTrack(state.track_window?.current_track);
            setCurrentTrack(mappedTrack);
            setIsPlaying(!state.paused);
            setPositionMs(state.position || 0);
            setDurationMs(state.duration || mappedTrack?.durationMs || 0);
            setRepeatMode(state.repeat_mode || 0);
            setQueue(mapQueue(state.track_window?.next_tracks || []));
            await updateLikeStatus(mappedTrack?.id);
        },
        [updateLikeStatus]
    );

    const fetchDevices = useCallback(async () => {
        const response = await api("/me/player/devices", {}, { silent: true });
        if (!response.ok) return [] as DeviceItem[];
        const data = (await response.json()) as { devices?: SpotifyDevice[] };
        const mapped = mapDevices(data.devices || []);
        setDevices(mapped);
        const selected =
            mapped.find((device) => device.isActive && !device.isRestricted) ||
            mapped.find((device) => device.id === sdkDeviceIdRef.current && !device.isRestricted) ||
            mapped.find((device) => !device.isRestricted);
        if (selected) {
            deviceIdRef.current = selected.id;
            setActiveDeviceName(selected.name);
        }
        return mapped;
    }, [api]);

    const resolveDeviceIdForPlayback = useCallback(async (_opts: { forceRefresh?: boolean } = {}) => {
        const available = await fetchDevices();
        const selected =
            available.find((device) => device.id === deviceIdRef.current && !device.isRestricted) ||
            available.find((device) => device.isActive && !device.isRestricted) ||
            available.find((device) => device.id === sdkDeviceIdRef.current && !device.isRestricted) ||
            available.find((device) => !device.isRestricted);
        if (!selected?.id) {
            if (sdkDeviceIdRef.current) {
                const transferRes = await api(
                    "/me/player",
                    {
                        method: "PUT",
                        body: JSON.stringify({ device_ids: [sdkDeviceIdRef.current], play: false }),
                    },
                    { silent: true }
                );
                if (transferRes.ok) {
                    deviceIdRef.current = sdkDeviceIdRef.current;
                    setActiveDeviceName("Este navegador");
                    return sdkDeviceIdRef.current;
                }
            }
            toast({
                title: "Sin dispositivo activo",
                description: "Abre Spotify en este navegador o en otro dispositivo y vuelve a intentar.",
            });
            return null;
        }
        deviceIdRef.current = selected.id;
        setActiveDeviceName(selected.name);
        return selected.id;
    }, [api, fetchDevices]);

    const isDeviceNotFoundResponse = useCallback(async (response: Response) => {
        if (response.status !== 404) return false;
        try {
            const data = (await response.clone().json()) as { error?: { message?: string; reason?: string } };
            const value = `${data?.error?.message || ""} ${data?.error?.reason || ""}`.toLowerCase();
            return value.includes("device not found");
        } catch {
            return false;
        }
    }, []);

    const notifyCommandFailure = useCallback(async (response: Response | null, fallback = "No se pudo ejecutar el comando de reproduccion.") => {
        if (!response) return;
        if (response.ok) return;
        const msg = await extractSpotifyErrorMessage(response);
        toast({
            variant: "destructive",
            title: "Error de Spotify",
            description: msg ? `La API respondio ${response.status} · ${msg}.` : fallback,
        });
    }, []);

    const executeWithDeviceRecovery = useCallback(
        async (runner: (deviceId: string) => Promise<Response>) => {
            const deviceId = await resolveDeviceIdForPlayback();
            if (!deviceId) return null;

            let response = await runner(deviceId);
            if (response.ok) return response;
            if (!(await isDeviceNotFoundResponse(response))) return response;

            deviceIdRef.current = null;
            const recoveredDeviceId = await resolveDeviceIdForPlayback({ forceRefresh: true });
            if (!recoveredDeviceId) return response;

            await api(
                "/me/player",
                {
                    method: "PUT",
                    body: JSON.stringify({ device_ids: [recoveredDeviceId], play: false }),
                },
                { silent: true }
            );
            await sleep(250);
            response = await runner(recoveredDeviceId);
            if (response.ok) return response;

            if ((await isDeviceNotFoundResponse(response)) && sdkDeviceIdRef.current && sdkDeviceIdRef.current !== recoveredDeviceId) {
                await api(
                    "/me/player",
                    {
                        method: "PUT",
                        body: JSON.stringify({ device_ids: [sdkDeviceIdRef.current], play: false }),
                    },
                    { silent: true }
                );
                await sleep(250);
                response = await runner(sdkDeviceIdRef.current);
            }
            return response;
        },
        [api, isDeviceNotFoundResponse, resolveDeviceIdForPlayback]
    );

    const transferPlayback = useCallback(
        async (deviceId: string, opts: { notify?: boolean } = {}) => {
            const { notify = true } = opts;
            if (!deviceId) return false;

            for (let attempt = 0; attempt < 4; attempt++) {
                const available = await fetchDevices();
                const exists = available.some((device) => device.id === deviceId && !device.isRestricted);
                if (!exists) {
                    await sleep(300);
                    continue;
                }

                const response = await api(
                    "/me/player",
                    {
                        method: "PUT",
                        body: JSON.stringify({ device_ids: [deviceId], play: false }),
                    },
                    { silent: true }
                );

                if (!response.ok) {
                    if (response.status === 404) {
                        await sleep(300);
                        continue;
                    }
                    return false;
                }

                deviceIdRef.current = deviceId;
                await fetchDevices();
                if (notify) {
                    const target = available.find((device) => device.id === deviceId);
                    toast({
                        title: "Dispositivo actualizado",
                        description: `Reproduccion movida a ${target?.name || "dispositivo seleccionado"}.`,
                    });
                }
                return true;
            }

            return false;
        },
        [api, fetchDevices]
    );

    const loadFavorites = useCallback(async () => {
        setStatusText('Cargando tus "Me Gusta"...');
        const response = await api("/me/tracks?limit=50");
        if (!response.ok) {
            setStatusText("No se pudieron cargar tus favoritos.");
            return [] as SpotifyWebTrack[];
        }
        const data = (await response.json()) as { items?: Array<{ track: SpotifyWebTrack }> };
        const tracks = (data.items || []).map((item) => item.track).filter(Boolean);
        setStatusText(tracks.length ? "Favoritos cargados." : "No tienes favoritos cargados.");
        return tracks;
    }, [api]);

    const playUris = useCallback(
        async (uris: string[]) => {
            if (!uris.length) return;
            const response = await executeWithDeviceRecovery((deviceId) =>
                api(`/me/player/play?device_id=${deviceId}`, {
                    method: "PUT",
                    body: JSON.stringify({ uris }),
                }, { silent: true })
            );
            if (!response) return;
            if (!response.ok) {
                await notifyCommandFailure(response, "No se pudo iniciar la reproduccion.");
                return;
            }
            setStatusText("Reproduciendo...");
        },
        [api, executeWithDeviceRecovery, notifyCommandFailure]
    );

    const refreshQueue = useCallback(async () => {
        const state = await playerRef.current?.getCurrentState();
        if (state) setQueue(mapQueue(state.track_window?.next_tracks || []));
    }, []);

    const addToQueue = useCallback(
        async (uri: string) => {
            if (!uri) return;
            const response = await executeWithDeviceRecovery((deviceId) =>
                api(`/me/player/queue?uri=${encodeURIComponent(uri)}&device_id=${deviceId}`, {
                    method: "POST",
                }, { silent: true })
            );
            if (!response) return;
            if (!response.ok) {
                await notifyCommandFailure(response, "No se pudo agregar a la cola.");
                return;
            }
            toast({ title: "Cola actualizada", description: "Cancion agregada a la cola." });
            await refreshQueue();
        },
        [api, executeWithDeviceRecovery, notifyCommandFailure, refreshQueue]
    );

    const playFavorites = useCallback(async () => {
        const favorites = await loadFavorites();
        if (!favorites.length) {
            toast({ title: "Sin canciones", description: "No se encontraron favoritos para reproducir." });
            return;
        }
        await playUris(favorites.map((track) => track.uri));
    }, [loadFavorites, playUris]);

    const playPlaylist = useCallback(
        async (playlistId: string) => {
            if (!playlistId) return;
            const response = await executeWithDeviceRecovery((deviceId) =>
                api(`/me/player/play?device_id=${deviceId}`, {
                    method: "PUT",
                    body: JSON.stringify({ context_uri: `spotify:playlist:${playlistId}` }),
                }, { silent: true })
            );
            if (!response) return;
            if (!response.ok) {
                await notifyCommandFailure(response, "No se pudo reproducir la playlist.");
                return;
            }
            setStatusText("Reproduciendo playlist...");
        },
        [api, executeWithDeviceRecovery, notifyCommandFailure]
    );

    const playAlbum = useCallback(
        async (albumId: string) => {
            if (!albumId) return;
            const response = await executeWithDeviceRecovery((deviceId) =>
                api(`/me/player/play?device_id=${deviceId}`, {
                    method: "PUT",
                    body: JSON.stringify({ context_uri: `spotify:album:${albumId}` }),
                }, { silent: true })
            );
            if (!response) return;
            if (!response.ok) {
                await notifyCommandFailure(response, "No se pudo reproducir el album.");
                return;
            }
            setStatusText("Reproduciendo album...");
        },
        [api, executeWithDeviceRecovery, notifyCommandFailure]
    );

    const loadPlaylists = useCallback(
        async (mode: "reset" | "append" = "reset") => {
            if (playlistsLoading) return;
            const endpoint = mode === "append" ? playlistsNextRef.current : "/me/playlists?limit=20";
            if (!endpoint) return;

            setPlaylistsLoading(true);
            try {
                const response = await api(endpoint, {}, { silent: true });
                if (!response.ok) return;
                const data = (await response.json()) as { items?: SpotifyPlaylist[]; next?: string | null };
                playlistsNextRef.current = data.next || null;
                setPlaylistsHasMore(Boolean(data.next));
                const mapped = mapPlaylists(data.items || []);
                setPlaylists((prev) => (mode === "append" ? [...prev, ...mapped] : mapped));
                setLibraryLoaded(true);
            } finally {
                setPlaylistsLoading(false);
            }
        },
        [api, playlistsLoading]
    );

    const ensureLibraryLoaded = useCallback(async () => {
        if (libraryLoaded) return;
        await loadPlaylists("reset");
    }, [libraryLoaded, loadPlaylists]);

    const searchCatalog = useCallback(
        async (query: string) => {
            const q = query.trim();
            if (!q) {
                setSearchResults(EMPTY_SEARCH_RESULTS);
                return;
            }
            setSearchLoading(true);
            try {
                const response = await api(
                    `/search?type=track,album,artist&limit=8&q=${encodeURIComponent(q)}`,
                    {},
                    { silent: true }
                );
                if (!response.ok) {
                    setSearchResults(EMPTY_SEARCH_RESULTS);
                    return;
                }
                const data = (await response.json()) as SpotifySearchResponse;
                setSearchResults(mapSearchResults(data));
            } finally {
                setSearchLoading(false);
            }
        },
        [api]
    );

    const clearSearchResults = useCallback(() => {
        setSearchResults(EMPTY_SEARCH_RESULTS);
    }, []);

    const searchAndPlay = useCallback(
        async (query: string) => {
            const q = query.trim();
            if (!q) return;
            const response = await api(`/search?type=track&limit=5&q=${encodeURIComponent(q)}`, {}, { silent: true });
            if (!response.ok) return;
            const data = (await response.json()) as { tracks?: { items?: SpotifyTrackDetails[] } };
            const firstTrack = data.tracks?.items?.[0];
            if (!firstTrack) {
                toast({ title: "Sin resultados", description: "No se encontraron canciones con esa busqueda." });
                return;
            }
            await playUris([firstTrack.uri]);
            toast({
                title: "Reproduciendo busqueda",
                description: `${firstTrack.name} · ${(firstTrack.artists || []).map((a: SpotifyArtist) => a.name).join(", ")}`,
            });
        },
        [api, playUris]
    );

    const playPreviewForTrackId = useCallback(
        async (trackId: string) => {
            if (!trackId || !previewAudioRef.current) return;
            const response = await api(`/tracks/${trackId}`, {}, { silent: true });
            if (!response.ok) return;
            const data = (await response.json()) as SpotifyTrackDetails;
            if (!data.preview_url) return;
            previewAudioRef.current.src = data.preview_url;
            try {
                await previewAudioRef.current.play();
            } catch {
                // Ignore autoplay blocking.
            }
        },
        [api]
    );

    const playSearchTrack = useCallback(
        async (track: SearchTrackItem) => {
            if (!track?.uri) return;
            await playUris([track.uri]);
        },
        [playUris]
    );

    const completeOAuthLogin = useCallback(
        async (code: string, state?: string | null) => {
            const expectedState = localStorage.getItem(STORAGE.OAUTH_STATE);
            if (expectedState && state && expectedState !== state) {
                throw new Error("OAuth state mismatch");
            }

            const codeVerifier = localStorage.getItem(STORAGE.CODE_VERIFIER);
            if (!codeVerifier) {
                throw new Error("Missing PKCE code verifier");
            }

            const data = await tokenRequest({
                client_id: SPOTIFY_CLIENT_ID,
                grant_type: "authorization_code",
                code,
                redirect_uri: REDIRECT_URI,
                code_verifier: codeVerifier,
            });

            applyTokenResponse(data);
            localStorage.removeItem(STORAGE.CODE_VERIFIER);
            localStorage.removeItem(STORAGE.OAUTH_STATE);
            setStatusText("Autenticado con Spotify.");
            emitAuthFeedback("success");
        },
        [applyTokenResponse, emitAuthFeedback, tokenRequest]
    );

    const startLogin = useCallback(async () => {
        const codeVerifier = generateRandomString(128);
        const oauthState = `${SPOTIFY_STATE_PREFIX}${generateRandomString(32)}`;
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        localStorage.setItem(STORAGE.CODE_VERIFIER, codeVerifier);
        localStorage.setItem(STORAGE.OAUTH_STATE, oauthState);
        const authUrl = new URL("https://accounts.spotify.com/authorize");
        authUrl.search = new URLSearchParams({
            response_type: "code",
            client_id: SPOTIFY_CLIENT_ID,
            scope: SCOPES,
            redirect_uri: REDIRECT_URI,
            code_challenge_method: "S256",
            code_challenge: codeChallenge,
            state: oauthState,
        }).toString();
        const width = 520;
        const height = 760;
        const left = Math.max(0, window.screenX + Math.round((window.outerWidth - width) / 2));
        const top = Math.max(0, window.screenY + Math.round((window.outerHeight - height) / 2));
        const popup = window.open(
            authUrl.toString(),
            "spotify_oauth_popup",
            `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );
        if (popup && !popup.closed) {
            popup.focus();
            return;
        }
        window.location.href = authUrl.toString();
    }, []);

    const logout = useCallback(() => {
        playerRef.current?.disconnect();
        playerRef.current = null;
        deviceIdRef.current = null;
        sdkDeviceIdRef.current = null;
        clearAuthState();
        setCurrentTrack(null);
        setQueue([]);
        setIsPlaying(false);
        setPositionMs(0);
        setDurationMs(0);
        setDevices([]);
        setPlaylists([]);
        setSearchResults(EMPTY_SEARCH_RESULTS);
        playlistsNextRef.current = null;
        setLibraryLoaded(false);
        setStatusText("Sesion cerrada. Conectate de nuevo.");
    }, [clearAuthState]);

    const togglePlayPause = useCallback(async () => {
        if (!currentTrack) {
            await playFavorites();
            return;
        }
        await playerRef.current?.togglePlay();
    }, [currentTrack, playFavorites]);

    const nextTrack = useCallback(async () => {
        await playerRef.current?.nextTrack();
    }, []);

    const prevTrack = useCallback(async () => {
        await playerRef.current?.previousTrack();
    }, []);

    const queueRecommendation = useCallback(
        async (track: CurrentTrack) => {
            interface SpotifyRecommendationTrack { id: string; uri?: string }
            interface SpotifyRecommendationsResponse { tracks?: SpotifyRecommendationTrack[] }
            let response = await api(getSpotifyRecommendationsPath(track.id), {}, { silent: true });
            if (!response.ok && track.artistId) {
                response = await api(getSpotifyArtistTopTracksPath(track.artistId), {}, { silent: true });
            }
            if (!response.ok) return;
            const data = (await response.json()) as SpotifyRecommendationsResponse;
            const pick = getSmartShuffleCandidate(data.tracks || [], track.id);
            if (!pick?.uri) return;
            await executeWithDeviceRecovery((deviceId) =>
                api(
                    `/me/player/queue?uri=${encodeURIComponent(pick.uri)}&device_id=${deviceId}`,
                    { method: "POST" },
                    { silent: true }
                )
            );
        },
        [api, executeWithDeviceRecovery]
    );

    useEffect(() => {
        shuffleModeRef.current = shuffleMode;
    }, [shuffleMode]);

    useEffect(() => {
        if (shuffleMode !== "smart" || !currentTrack?.id) return;
        if (currentTrack.id === prevSmartTrackIdRef.current) return;
        prevSmartTrackIdRef.current = currentTrack.id;
        void queueRecommendation(currentTrack);
    }, [currentTrack?.id, shuffleMode, queueRecommendation]);

    const cycleShuffle = useCallback(async () => {
        const next = getNextShuffleMode(shuffleMode, { smart: true });
        const spotifyNative = next === "shuffle";
        const response = await executeWithDeviceRecovery((deviceId) =>
            api(`/me/player/shuffle?state=${spotifyNative}&device_id=${deviceId}`, { method: "PUT" }, { silent: true })
        );
        if (!response?.ok) {
            await notifyCommandFailure(response || null, "No se pudo cambiar el modo shuffle.");
            return;
        }
        setShuffleMode(next);
        shuffleModeRef.current = next;
        if (next !== "smart") prevSmartTrackIdRef.current = null;
    }, [api, executeWithDeviceRecovery, shuffleMode, notifyCommandFailure]);

    const cycleRepeat = useCallback(async () => {
        const modes = ["off", "context", "track"] as const;
        const nextMode = ((repeatMode + 1) % 3) as 0 | 1 | 2;
        const response = await executeWithDeviceRecovery((deviceId) =>
            api(`/me/player/repeat?state=${modes[nextMode]}&device_id=${deviceId}`, { method: "PUT" }, { silent: true })
        );
        if (!response?.ok) {
            await notifyCommandFailure(response || null, "No se pudo cambiar el modo repeat.");
            return;
        }
        setRepeatMode(nextMode);
    }, [api, executeWithDeviceRecovery, notifyCommandFailure, repeatMode]);

    const seekToProgress = useCallback(
        async (pct: number) => {
            const target = Math.max(0, Math.min(100, pct));
            const position = Math.floor((target / 100) * (durationMs || 0));
            await playerRef.current?.seek(position);
            setPositionMs(position);
        },
        [durationMs]
    );

    const setVolumeLevel = useCallback(async (value: number) => {
        const nextVolume = Math.max(0, Math.min(1, value));
        setVolume(nextVolume);
        localStorage.setItem(STORAGE.VOLUME, String(nextVolume));
        await playerRef.current?.setVolume(nextVolume);
    }, []);

    const toggleLike = useCallback(async () => {
        if (!currentTrack?.id) return;
        const method = isLiked ? "DELETE" : "PUT";
        await api(`/me/tracks?ids=${currentTrack.id}`, { method });
        setIsLiked((prev) => !prev);
        toast({
            title: isLiked ? "Quitado de favoritos" : "Guardado en favoritos",
            description: currentTrack.title,
        });
    }, [api, currentTrack, isLiked]);

    const shareCurrent = useCallback(async () => {
        if (!currentTrack?.externalUrl) return;
        await navigator.clipboard.writeText(currentTrack.externalUrl);
        toast({ title: "Enlace copiado", description: currentTrack.title });
    }, [currentTrack]);

    const playQueueTrack = useCallback(
        async (track: QueueTrack) => {
            if (!track.uri) return;
            await playUris([track.uri]);
        },
        [playUris]
    );

    useEffect(() => {
        let mounted = true;
        const initializeAuth = async () => {
            setIsAuthLoading(true);
            const params = new URLSearchParams(window.location.search);
            const code = params.get("code");
            const state = params.get("state");
            const authError = params.get("error");
            const storedToken = localStorage.getItem(STORAGE.ACCESS_TOKEN);
            const storedExpiresAt = Number(localStorage.getItem(STORAGE.EXPIRES_AT) || 0);
            const storedRefreshToken = localStorage.getItem(STORAGE.REFRESH_TOKEN);

            try {
                const isPopup = Boolean(window.opener && window.opener !== window);
                const isSpotifyFlow = !state || state.startsWith(SPOTIFY_STATE_PREFIX);
                if (isPopup && isSpotifyFlow && (code || authError)) {
                    window.opener?.postMessage(
                        {
                            type: "spotify-oauth-callback",
                            code,
                            state,
                            error: authError || undefined,
                        } satisfies OAuthPopupMessage,
                        window.location.origin
                    );
                    window.close();
                    return;
                }

                if (code && isSpotifyFlow) {
                    await completeOAuthLogin(code, state);
                    if (!mounted) return;
                    window.history.replaceState({}, "", REDIRECT_URI);
                } else if (storedToken && storedExpiresAt && Date.now() < storedExpiresAt) {
                    if (!mounted) return;
                    setAccessToken(storedToken);
                    setTokenExpiresAt(storedExpiresAt);
                    setRefreshToken(storedRefreshToken);
                    setStatusText("Sesion restaurada.");
                } else if (storedRefreshToken) {
                    if (!mounted) return;
                    setRefreshToken(storedRefreshToken);
                    const data = await tokenRequest({
                        client_id: SPOTIFY_CLIENT_ID,
                        grant_type: "refresh_token",
                        refresh_token: storedRefreshToken,
                    });
                    if (!mounted) return;
                    applyTokenResponse({ ...data, refresh_token: data.refresh_token || storedRefreshToken });
                    setStatusText("Sesion restaurada con refresh token.");
                } else {
                    clearAuthState();
                }
            } catch (error) {
                clearAuthState();
                emitAuthFeedback("error");
                toast({
                    variant: "destructive",
                    title: "Error de autenticacion",
                    description: "No se pudo iniciar sesion con Spotify.",
                });
                console.error(error);
            } finally {
                if (mounted) setIsAuthLoading(false);
            }
        };

        void initializeAuth();
        return () => {
            mounted = false;
        };
    }, [clearAuthState, completeOAuthLogin, emitAuthFeedback, tokenRequest]);

    useEffect(() => {
        const handlePopupMessage = (event: MessageEvent<OAuthPopupMessage>) => {
            if (event.origin !== window.location.origin) return;
            const payload = event.data;
            if (!payload || payload.type !== "spotify-oauth-callback") return;

            if (payload.error) {
                setIsAuthLoading(false);
                setStatusText("Autorizacion cancelada o rechazada.");
                emitAuthFeedback("error");
                toast({
                    variant: "destructive",
                    title: "Spotify no autorizado",
                    description: "No se completo el permiso en la ventana emergente.",
                });
                return;
            }

            if (!payload.code) return;
            setIsAuthLoading(true);
            void completeOAuthLogin(payload.code, payload.state)
                .catch((error) => {
                    clearAuthState();
                    emitAuthFeedback("error");
                    toast({
                        variant: "destructive",
                        title: "Error de autenticacion",
                        description: "No se pudo iniciar sesion con Spotify.",
                    });
                    console.error(error);
                })
                .finally(() => {
                    setIsAuthLoading(false);
                });
        };

        window.addEventListener("message", handlePopupMessage);
        return () => window.removeEventListener("message", handlePopupMessage);
    }, [clearAuthState, completeOAuthLogin, emitAuthFeedback]);

    useEffect(() => {
        if (window.Spotify) {
            setSdkReady(true);
            return;
        }
        const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://sdk.scdn.co/spotify-player.js"]');
        const previousHandler = window.onSpotifyWebPlaybackSDKReady;
        window.onSpotifyWebPlaybackSDKReady = () => {
            previousHandler?.();
            setSdkReady(true);
        };
        if (!existingScript) {
            const script = document.createElement("script");
            script.src = "https://sdk.scdn.co/spotify-player.js";
            script.async = true;
            document.body.appendChild(script);
        }
    }, []);

    useEffect(() => {
        if (!accessToken || !sdkReady || playerRef.current || !window.Spotify?.Player) return;

        const player = new window.Spotify.Player({
            name: "Dev Hub Web Player",
            getOAuthToken: (cb) => {
                (async () => {
                    try {
                        const token = accessTokenRef.current;
                        const expiresAt = tokenExpiresAtRef.current;
                        const shouldRefresh = !token || (expiresAt && Date.now() >= (expiresAt - 60000));
                        if (shouldRefresh) {
                            await refreshAccessToken();
                        }
                    } catch (err) {
                        console.error("Error refreshing token for Spotify SDK:", err);
                    }
                    cb(accessTokenRef.current || "");
                })();
            },
            volume,
        });
        playerRef.current = player;

        const handleReady = ({ device_id }: { device_id: string }) => {
            sdkDeviceIdRef.current = device_id;
            deviceIdRef.current = device_id;
            setActiveDeviceName("Este navegador");
            void transferPlayback(device_id, { notify: false });
            void loadFavorites();
            void fetchDevices();
            setStatusText("Player conectado.");
        };

        const handleStateChanged = (state: SpotifyPlayerState | null) => {
            void syncFromPlayerState(state);
        };

        const handleAuthError = ({ message }: { message: string }) => {
            console.error(message);
            if (sdkAuthRecoveringRef.current) return;
            sdkAuthRecoveringRef.current = true;
            setStatusText("Spotify SDK reporto error de autenticacion. Reintentando...");
            toast({
                variant: "destructive",
                title: "Sesion de reproduccion inestable",
                description: "Se detecto un error del SDK. Intentaremos recuperar la sesion sin cerrarte.",
            });
            void refreshAccessToken().finally(() => {
                sdkAuthRecoveringRef.current = false;
            });
        };

        player.addListener("ready", handleReady);
        player.addListener("player_state_changed", handleStateChanged);
        player.addListener("authentication_error", handleAuthError);
        player.addListener("account_error", ({ message }: { message: string }) => {
            console.error(message);
            setStatusText("Tu cuenta de Spotify no permite Web Playback SDK (normalmente requiere Premium).");
            toast({
                variant: "destructive",
                title: "Cuenta no compatible",
                description: "Spotify Web Playback SDK suele requerir cuenta Premium.",
            });
        });
        player.addListener("initialization_error", ({ message }: { message: string }) => console.error(message));
        player.addListener("playback_error", ({ message }: { message: string }) => console.error(message));

        void player.connect();

        return () => {
            player.removeListener("ready", handleReady);
            player.removeListener("player_state_changed", handleStateChanged);
            player.removeListener("authentication_error", handleAuthError);
            player.disconnect();
            if (playerRef.current === player) playerRef.current = null;
        };
    }, [accessToken, fetchDevices, loadFavorites, refreshAccessToken, sdkReady, syncFromPlayerState, transferPlayback]);

    useEffect(() => {
        if (!isPlaying || !durationMs) return;
        const interval = setInterval(() => {
            setPositionMs((prev) => Math.min(durationMs, prev + 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [durationMs, isPlaying]);

    useEffect(() => {
        if (!tokenExpiresAt) {
            setSessionCountdown("-");
            return;
        }
        autoRefreshTriggeredRef.current = false;
        const tick = () => {
            const remainingMs = Math.max(0, tokenExpiresAt - Date.now());
            if (remainingMs <= 120000 && !autoRefreshTriggeredRef.current) {
                autoRefreshTriggeredRef.current = true;
                void refreshAccessToken();
            }
            const total = Math.floor(remainingMs / 1000);
            const hours = Math.floor(total / 3600);
            const mins = Math.floor((total % 3600) / 60);
            const secs = total % 60;
            if (hours > 0) {
                setSessionCountdown(`${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
            } else {
                setSessionCountdown(`${mins}:${String(secs).padStart(2, "0")}`);
            }
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [refreshAccessToken, tokenExpiresAt]);

    useEffect(() => {
        if (!accessToken) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.target as HTMLElement)?.closest("input, textarea")) return;
            if (event.code === "Space") {
                event.preventDefault();
                void togglePlayPause();
            }
            if (event.code === "ArrowRight") {
                void playerRef.current?.getCurrentState().then((state) => {
                    if (!state) return;
                    void playerRef.current?.seek(Math.min(state.duration, state.position + 5000));
                });
            }
            if (event.code === "ArrowLeft") {
                void playerRef.current?.getCurrentState().then((state) => {
                    if (!state) return;
                    void playerRef.current?.seek(Math.max(0, state.position - 5000));
                });
            }
            if (event.code === "ArrowUp") void setVolumeLevel(volume + 0.05);
            if (event.code === "ArrowDown") void setVolumeLevel(volume - 0.05);
            if (event.key.toLowerCase() === "m") void fetchDevices();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [accessToken, fetchDevices, setVolumeLevel, togglePlayPause, volume]);

    const progress = useMemo(() => {
        if (!durationMs) return 0;
        return Math.max(0, Math.min(100, (positionMs / durationMs) * 100));
    }, [durationMs, positionMs]);

    const fetchArtistData = useCallback(async (artistName: string): Promise<ArtistData | null> => {
        if (!artistName || !accessTokenRef.current) return null;
        try {
            const searchRes = await api(
                `/search?type=artist&limit=10&q=${encodeURIComponent(artistName)}`,
                {},
                { silent: true }
            );
            if (!searchRes.ok) return null;
            const searchData = (await searchRes.json()) as {
                artists?: { items?: Array<{ id: string; name: string; images?: Array<{ url: string }>; followers?: { total?: number }; genres?: string[]; external_urls?: { spotify?: string } }> };
            };
            const items = searchData.artists?.items ?? [];
            if (!items.length) return null;

            const normalise = (s: string) => s.toLowerCase().trim();
            const target = normalise(artistName);
            // Prefer exact match, then starts-with, then first result
            const artistItem =
                items.find((a) => normalise(a.name) === target) ??
                items.find((a) => normalise(a.name).startsWith(target)) ??
                items[0];

            const topTracksRes = await api(
                `/artists/${artistItem.id}/top-tracks?market=ES`,
                {},
                { silent: true }
            );
            interface SpotifyTopTrackItem {
                id: string;
                uri: string;
                name?: string;
                duration_ms?: number;
                artists?: Array<{ name: string }>;
                album?: { images?: Array<{ url: string }> };
            }
            const topTracksData = topTracksRes.ok
                ? ((await topTracksRes.json()) as { tracks?: SpotifyTopTrackItem[] })
                : { tracks: [] };

            return {
                id: artistItem.id,
                name: artistItem.name,
                image: artistItem.images?.[0]?.url || fallbackAlbumArt,
                followers: artistItem.followers?.total,
                genres: artistItem.genres,
                externalUrl: artistItem.external_urls?.spotify,
                topTracks: (topTracksData.tracks || []).slice(0, 10).map((t) => ({
                    id: t.id,
                    uri: t.uri,
                    title: t.name || "Sin título",
                    artist: (t.artists || []).map((a) => a.name).join(", ") || "Sin artista",
                    duration: formatMs(t.duration_ms || 0),
                    albumArt: t.album?.images?.[2]?.url || t.album?.images?.[0]?.url || fallbackAlbumArt,
                })),
            };
        } catch {
            return null;
        }
    }, [api]);

    return {
        isAuthenticated: Boolean(accessToken),
        isAuthLoading,
        sdkReady,
        statusText,
        sessionCountdown,
        currentTrack,
        queue,
        isPlaying,
        shuffleMode,
        repeatMode,
        volume,
        isLiked,
        progress,
        positionMs,
        durationMs,
        currentTime: formatMs(positionMs),
        totalTime: formatMs(durationMs || currentTrack?.durationMs || 0),
        devices,
        activeDeviceName,
        playlists,
        playlistsLoading,
        playlistsHasMore,
        searchResults,
        searchLoading,
        authFeedback,
        startLogin,
        logout,
        searchAndPlay,
        searchCatalog,
        clearSearchResults,
        playSearchTrack,
        playPreviewForTrackId,
        playAlbum,
        addToQueue,
        playFavorites,
        playPlaylist,
        ensureLibraryLoaded,
        loadPlaylists,
        fetchDevices,
        transferPlayback,
        togglePlayPause,
        nextTrack,
        prevTrack,
        cycleShuffle,
        cycleRepeat,
        seekToProgress,
        setVolumeLevel,
        toggleLike,
        shareCurrent,
        refreshQueue,
        playQueueTrack,
        fetchArtistData,
    };
};

export default useSpotifyPlayer;
