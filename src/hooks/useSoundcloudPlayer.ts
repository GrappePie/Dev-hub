import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import fallbackAlbumArt from "@/assets/album-art-placeholder.svg";
import { getNextShuffleMode } from "@/lib/shuffleMode";
import type { CurrentTrack, ArtistData } from "@/hooks/useSpotifyPlayer";

const SOUNDCLOUD_WIDGET_SCRIPT = "https://w.soundcloud.com/player/api.js";
const SOUNDCLOUD_API_BASE = "https://api.soundcloud.com";
const SOUNDCLOUD_AUTHORIZE_URL = "https://secure.soundcloud.com/authorize";
const SOUNDCLOUD_STATE_PREFIX = "sc_";

const SOUNDCLOUD_CLIENT_ID = import.meta.env.VITE_SOUNDCLOUD_CLIENT_ID || "";
const DEFAULT_REDIRECT_URI = `${window.location.origin}${window.location.pathname}`;
const SOUNDCLOUD_REDIRECT_URI = import.meta.env.VITE_SOUNDCLOUD_REDIRECT_URI || DEFAULT_REDIRECT_URI;
const DEFAULT_TRACK_URL = "https://soundcloud.com/forss/flickermood";

const STORAGE = {
    ACCESS_TOKEN: "sc_access_token",
    REFRESH_TOKEN: "sc_refresh_token",
    EXPIRES_AT: "sc_token_expires_at",
    OAUTH_STATE: "sc_oauth_state",
    PKCE_VERIFIER: "sc_pkce_verifier",
} as const;

interface SoundcloudTokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
}

interface SoundcloudUser {
    id: number;
    username: string;
    full_name?: string;
    avatar_url?: string;
    permalink_url?: string;
}

interface SoundcloudPlaylist {
    id: number;
    title: string;
    permalink_url: string;
    artwork_url?: string | null;
    track_count?: number;
    subtitle?: string;
    kind?: "playlist" | "track" | "like";
    artist?: string;
    duration_ms?: number;
}

export type SoundcloudLibrarySection = "playlists" | "tracks" | "likes";

interface SoundcloudPopupMessage {
    type?: string;
    code?: string;
    state?: string | null;
    error?: string;
}

interface SoundcloudSearchItem {
    id: number;
    title: string;
    permalink_url: string;
    artwork_url?: string | null;
    user?: { username?: string; avatar_url?: string | null };
    duration?: number;
}

export interface ScTimedComment {
    id: number;
    body: string;
    timestamp: number; // milliseconds into the track
    user: { username: string; avatar_url?: string | null };
}

interface SoundcloudCollectionResponse<T> {
    collection?: T[];
    next_href?: string | null;
}

const EMPTY_LIBRARY_SECTIONS: Record<SoundcloudLibrarySection, SoundcloudPlaylist[]> = {
    playlists: [],
    tracks: [],
    likes: [],
};

const EMPTY_LIBRARY_NEXT: Record<SoundcloudLibrarySection, string | null> = {
    playlists: null,
    tracks: null,
    likes: null,
};

const EMPTY_LIBRARY_LOADING: Record<SoundcloudLibrarySection, boolean> = {
    playlists: false,
    tracks: false,
    likes: false,
};

const formatMs = (ms = 0) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const normalizeSoundcloudUrl = (value: string) => {
    const raw = value.trim().split("?")[0]; // strip query params (UTM, etc.)
    if (!raw) return "";
    if (raw.startsWith("https://soundcloud.com/") || raw.startsWith("https://on.soundcloud.com/")) return raw;
    if (raw.startsWith("http://soundcloud.com/")) return raw.replace("http://", "https://");
    if (raw.startsWith("soundcloud.com/")) return `https://${raw}`;
    return "";
};

const buildWidgetSrc = (trackUrl: string, autoPlay = false) =>
    `https://w.soundcloud.com/player/?url=${encodeURIComponent(trackUrl)}&auto_play=${autoPlay ? "true" : "false"}&hide_related=false&show_comments=false&show_user=true&show_reposts=false&visual=false`;

const upscaleArtwork = (url?: string | null) => {
    if (!url) return fallbackAlbumArt;
    return url.replace("-large.", "-t500x500.");
};

const toBase64Url = (bytes: Uint8Array) => {
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const generateRandomString = (byteLength: number) => {
    const bytes = new Uint8Array(byteLength);
    crypto.getRandomValues(bytes);
    return toBase64Url(bytes);
};

const createCodeChallenge = async (verifier: string) => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    return toBase64Url(new Uint8Array(digest));
};

const appendClientId = (path: string, includeClientId = true) => {
    const target = path.startsWith("http") ? new URL(path) : new URL(`${SOUNDCLOUD_API_BASE}${path}`);
    if (includeClientId && SOUNDCLOUD_CLIENT_ID && !target.searchParams.has("client_id")) {
        target.searchParams.set("client_id", SOUNDCLOUD_CLIENT_ID);
    }
    return target.toString();
};

const isSoundcloudState = (value?: string | null) => Boolean(value && value.startsWith(SOUNDCLOUD_STATE_PREFIX));

const getTokenExpiry = (expiresIn?: number) => {
    if (!expiresIn || !Number.isFinite(expiresIn)) return Date.now() + 3600 * 1000;
    return Date.now() + Math.max(60, expiresIn) * 1000;
};

const parseCollectionResponse = <T>(raw: unknown): { items: T[]; nextHref: string | null } => {
    if (Array.isArray(raw)) {
        return { items: raw as T[], nextHref: null };
    }
    const data = raw as SoundcloudCollectionResponse<T> | null;
    const items = Array.isArray(data?.collection) ? data.collection : [];
    return { items, nextHref: data?.next_href || null };
};

const dedupeByPermalink = (items: SoundcloudPlaylist[]) => {
    const uniqueByUrl = new Map<string, SoundcloudPlaylist>();
    items.forEach((item) => {
        if (!item.permalink_url) return;
        if (!uniqueByUrl.has(item.permalink_url)) {
            uniqueByUrl.set(item.permalink_url, item);
        }
    });
    return Array.from(uniqueByUrl.values());
};

const mapPlaylistItems = (items: any[]): SoundcloudPlaylist[] =>
    items
        .filter((item) => item?.permalink_url)
        .map((item) => ({
            id: Number(item.id),
            title: item.title || "Playlist",
            permalink_url: item.permalink_url,
            artwork_url: item.artwork_url || item?.tracks?.[0]?.artwork_url || null,
            track_count: item.track_count || item?.tracks?.length || 0,
            subtitle: "Playlist",
            kind: "playlist" as const,
        }));

const mapTrackItems = (items: any[], subtitle: string, kind: "track" | "like"): SoundcloudPlaylist[] =>
    items
        .filter((item) => item?.permalink_url)
        .map((item) => ({
            id: Number(item.id),
            title: item.title || (kind === "like" ? "Like" : "Track"),
            permalink_url: item.permalink_url,
            artwork_url: item.artwork_url || item?.user?.avatar_url || null,
            track_count: 1,
            subtitle,
            kind,
            artist: item?.user?.username || "SoundCloud",
            duration_ms: item?.duration || 0,
        }));

const mapLikeItems = (items: any[]): SoundcloudPlaylist[] => {
    const tracks = items
        .map((entry) => entry?.track || entry)
        .filter(Boolean);
    return mapTrackItems(tracks, "Me gusta", "like");
};

export const useSoundcloudPlayer = () => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const widgetRef = useRef<SoundcloudWidget | null>(null);
    const accessTokenRef = useRef<string | null>(null);
    const refreshTokenRef = useRef<string | null>(null);
    const searchQueueRef = useRef<SoundcloudPlaylist[]>([]);
    const searchQueueIndexRef = useRef<number>(-1);
    const loadTrackRef = useRef<((value: string, autoPlay?: boolean, meta?: Partial<SoundcloudPlaylist>) => boolean) | null>(null);

    const [sdkReady, setSdkReady] = useState(false);
    const [isAuthLoading, setIsAuthLoading] = useState(false);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState<string | null>(null);
    const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);
    const [account, setAccount] = useState<SoundcloudUser | null>(null);
    const [libraryBySection, setLibraryBySection] = useState<Record<SoundcloudLibrarySection, SoundcloudPlaylist[]>>(EMPTY_LIBRARY_SECTIONS);
    const [libraryNextBySection, setLibraryNextBySection] = useState<Record<SoundcloudLibrarySection, string | null>>(EMPTY_LIBRARY_NEXT);
    const [libraryLoading, setLibraryLoading] = useState(false);
    const [libraryLoadingMoreBySection, setLibraryLoadingMoreBySection] =
        useState<Record<SoundcloudLibrarySection, boolean>>(EMPTY_LIBRARY_LOADING);
    const [searchResults, setSearchResults] = useState<SoundcloudPlaylist[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [recentQueue, setRecentQueue] = useState<SoundcloudPlaylist[]>([]);
    const [currentScTrackId, setCurrentScTrackId] = useState<number | null>(null);
    const [trackPlaylistMembership, setTrackPlaylistMembership] = useState<Record<number, boolean>>({});
    const [membershipLoading, setMembershipLoading] = useState(false);
    const [isCurrentTrackLiked, setIsCurrentTrackLiked] = useState(false);

    const isShuffleRef = useRef<"off" | "shuffle" | "smart">("off");
    const scApiRef = useRef<((path: string, init?: RequestInit, opts?: { silent?: boolean; includeClientId?: boolean }) => Promise<Response>) | null>(null);
    const currentScTrackIdRef = useRef<number | null>(null);
    const volumeRef = useRef(0.5);
    const loadedUrlRef = useRef(DEFAULT_TRACK_URL);
    const durationMsRef = useRef(0);
    const pendingAutoPlayRef = useRef(false);
    const [shuffleMode, setShuffleMode] = useState<"off" | "shuffle" | "smart">("off");
    const [expandedPlaylist, setExpandedPlaylist] = useState<{ id: number; title: string; tracks: SoundcloudPlaylist[] } | null>(null);
    const [expandedPlaylistLoading, setExpandedPlaylistLoading] = useState(false);
    const [timedComments, setTimedComments] = useState<ScTimedComment[]>([]);

    const [iframeSrc, setIframeSrc] = useState(() => buildWidgetSrc(DEFAULT_TRACK_URL));
    const [inputUrl, setInputUrl] = useState(DEFAULT_TRACK_URL);
    const [statusText, setStatusText] = useState("Pega un enlace o conecta tu cuenta de SoundCloud.");
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.5);
    const [durationMs, setDurationMs] = useState(0);
    const [positionMs, setPositionMs] = useState(0);
    const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null);
    const [loadedUrl, setLoadedUrl] = useState(DEFAULT_TRACK_URL);

    loadedUrlRef.current = loadedUrl;
    durationMsRef.current = durationMs;

    useEffect(() => {
        accessTokenRef.current = accessToken;
    }, [accessToken]);

    useEffect(() => {
        refreshTokenRef.current = refreshToken;
    }, [refreshToken]);

    const clearAuthState = useCallback(() => {
        setAccessToken(null);
        setRefreshToken(null);
        setTokenExpiresAt(null);
        setAccount(null);
        setLibraryLoading(false);
        setLibraryBySection(EMPTY_LIBRARY_SECTIONS);
        setLibraryNextBySection(EMPTY_LIBRARY_NEXT);
        setLibraryLoadingMoreBySection(EMPTY_LIBRARY_LOADING);
        localStorage.removeItem(STORAGE.ACCESS_TOKEN);
        localStorage.removeItem(STORAGE.REFRESH_TOKEN);
        localStorage.removeItem(STORAGE.EXPIRES_AT);
        localStorage.removeItem(STORAGE.OAUTH_STATE);
        localStorage.removeItem(STORAGE.PKCE_VERIFIER);
    }, []);

    const applyTokenResponse = useCallback((data: SoundcloudTokenResponse, fallbackRefreshToken?: string | null) => {
        const expiresAt = getTokenExpiry(data.expires_in);
        accessTokenRef.current = data.access_token; // sync ref immediately so fetchLibrary can use it right away
        setAccessToken(data.access_token);
        setTokenExpiresAt(expiresAt);
        localStorage.setItem(STORAGE.ACCESS_TOKEN, data.access_token);
        localStorage.setItem(STORAGE.EXPIRES_AT, String(expiresAt));

        const nextRefreshToken = data.refresh_token || fallbackRefreshToken || null;
        setRefreshToken(nextRefreshToken);
        if (nextRefreshToken) {
            localStorage.setItem(STORAGE.REFRESH_TOKEN, nextRefreshToken);
        } else {
            localStorage.removeItem(STORAGE.REFRESH_TOKEN);
        }
    }, []);

    const tokenRequest = useCallback(async (body: Record<string, string>) => {
        const response = await fetch("/api/soundcloud/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                redirect_uri: SOUNDCLOUD_REDIRECT_URI,
                ...body,
            }),
        });
        if (!response.ok) {
            const raw = await response.text();
            throw new Error(`SoundCloud token error (${response.status}) ${raw}`);
        }
        return (await response.json()) as SoundcloudTokenResponse;
    }, []);

    const refreshAccessToken = useCallback(async () => {
        const currentRefreshToken = refreshTokenRef.current;
        if (!currentRefreshToken) return false;
        try {
            const data = await tokenRequest({
                grant_type: "refresh_token",
                refresh_token: currentRefreshToken,
            });
            applyTokenResponse(data, currentRefreshToken);
            return true;
        } catch (error) {
            console.error(error);
            clearAuthState();
            return false;
        }
    }, [applyTokenResponse, clearAuthState, tokenRequest]);

    const scApi = useCallback(
        async (path: string, init: RequestInit = {}, opts: { silent?: boolean; includeClientId?: boolean } = {}) => {
            const token = accessTokenRef.current;
            const includeClientId = opts.includeClientId ?? !token;
            const headers = {
                Accept: "application/json",
                ...(token ? { Authorization: `OAuth ${token}` } : {}),
                ...(init.headers || {}),
            };
            let response = await fetch(appendClientId(path, includeClientId), { ...init, headers });
            if (response.status === 401 && refreshTokenRef.current) {
                const refreshed = await refreshAccessToken();
                if (refreshed) {
                    const nextHeaders = {
                        Accept: "application/json",
                        ...(accessTokenRef.current ? { Authorization: `OAuth ${accessTokenRef.current}` } : {}),
                        ...(init.headers || {}),
                    };
                    response = await fetch(appendClientId(path, includeClientId), { ...init, headers: nextHeaders });
                }
            }
            if (!opts.silent && !response.ok) {
                const text = await response.clone().text();
                toast({
                    variant: "destructive",
                    title: "Error SoundCloud",
                    description: `API ${response.status}${text ? ` · ${text.slice(0, 120)}` : ""}`,
                });
            }
            return response;
        },
        [refreshAccessToken]
    );

    const fetchLibrary = useCallback(async () => {
        if (!accessTokenRef.current) return;
        setLibraryLoading(true);
        setLibraryLoadingMoreBySection(EMPTY_LIBRARY_LOADING);
        setStatusText("Cargando tu biblioteca de SoundCloud...");
        try {
            const meResponse = await scApi("/me", {}, { silent: false, includeClientId: false });
            if (meResponse.ok) {
                const user = (await meResponse.json()) as SoundcloudUser;
                setAccount(user);
            } else {
                setStatusText("No se pudo cargar la cuenta de SoundCloud.");
                return;
            }

            const [playlistsResponse, tracksResponse, likesResponse] = await Promise.all([
                scApi("/me/playlists?limit=20&linked_partitioning=1", {}, { silent: true, includeClientId: false }),
                scApi("/me/tracks?limit=20&linked_partitioning=1", {}, { silent: true, includeClientId: false }),
                scApi("/me/likes?limit=20&linked_partitioning=1", {}, { silent: true, includeClientId: false }),
            ]);

            const nextBySection: Record<SoundcloudLibrarySection, string | null> = { ...EMPTY_LIBRARY_NEXT };
            const nextLibrary: Record<SoundcloudLibrarySection, SoundcloudPlaylist[]> = { ...EMPTY_LIBRARY_SECTIONS };

            if (playlistsResponse.ok) {
                const { items, nextHref } = parseCollectionResponse<any>(await playlistsResponse.json());
                nextLibrary.playlists = dedupeByPermalink(mapPlaylistItems(items));
                nextBySection.playlists = nextHref;
            }

            if (tracksResponse.ok) {
                const { items, nextHref } = parseCollectionResponse<any>(await tracksResponse.json());
                nextLibrary.tracks = dedupeByPermalink(mapTrackItems(items, "Track propio", "track"));
                nextBySection.tracks = nextHref;
            }

            if (likesResponse.ok) {
                const { items, nextHref } = parseCollectionResponse<any>(await likesResponse.json());
                nextLibrary.likes = dedupeByPermalink(mapLikeItems(items));
                nextBySection.likes = nextHref;
            }

            setLibraryBySection(nextLibrary);
            setLibraryNextBySection(nextBySection);

            const totalItems = nextLibrary.playlists.length + nextLibrary.tracks.length + nextLibrary.likes.length;
            if (!totalItems) {
                setStatusText("Cuenta conectada, pero no se encontraron playlists, tracks ni likes.");
            } else {
                setStatusText(
                    `Biblioteca cargada (${nextLibrary.playlists.length} playlists, ${nextLibrary.tracks.length} tracks, ${nextLibrary.likes.length} likes).`
                );
            }
        } finally {
            setLibraryLoading(false);
        }
    }, [scApi]);

    const loadMoreLibrarySection = useCallback(
        async (section: SoundcloudLibrarySection) => {
            const nextHref = libraryNextBySection[section];
            if (!nextHref) return;
            if (libraryLoadingMoreBySection[section]) return;

            setLibraryLoadingMoreBySection((prev) => ({ ...prev, [section]: true }));
            try {
                const response = await scApi(nextHref, {}, { silent: true, includeClientId: false });
                if (!response.ok) return;
                const raw = await response.json();
                const { items, nextHref: newNextHref } = parseCollectionResponse<any>(raw);

                const mapped =
                    section === "playlists"
                        ? mapPlaylistItems(items)
                        : section === "tracks"
                            ? mapTrackItems(items, "Track propio", "track")
                            : mapLikeItems(items);

                setLibraryBySection((prev) => ({
                    ...prev,
                    [section]: dedupeByPermalink([...prev[section], ...mapped]),
                }));
                setLibraryNextBySection((prev) => ({ ...prev, [section]: newNextHref }));
            } finally {
                setLibraryLoadingMoreBySection((prev) => ({ ...prev, [section]: false }));
            }
        },
        [libraryLoadingMoreBySection, libraryNextBySection, scApi]
    );

    const completeOAuthLogin = useCallback(
        async (code: string, state?: string | null) => {
            const expectedState = localStorage.getItem(STORAGE.OAUTH_STATE);
            if (!expectedState || !state || expectedState !== state) {
                throw new Error("SoundCloud OAuth state mismatch");
            }
            const codeVerifier = localStorage.getItem(STORAGE.PKCE_VERIFIER);
            if (!codeVerifier) {
                throw new Error("SoundCloud PKCE verifier missing; restart the login flow");
            }
            const token = await tokenRequest({
                grant_type: "authorization_code",
                code,
                code_verifier: codeVerifier,
            });
            applyTokenResponse(token);
            localStorage.removeItem(STORAGE.OAUTH_STATE);
            localStorage.removeItem(STORAGE.PKCE_VERIFIER);
            setStatusText("Cuenta de SoundCloud conectada.");
            await fetchLibrary();
        },
        [applyTokenResponse, fetchLibrary, tokenRequest]
    );

    const startLogin = useCallback(async () => {
        if (!SOUNDCLOUD_CLIENT_ID) {
            toast({
                variant: "destructive",
                title: "Config faltante",
                description: "Define VITE_SOUNDCLOUD_CLIENT_ID en el frontend y configura el secreto en el servidor.",
            });
            return;
        }

        const oauthState = `${SOUNDCLOUD_STATE_PREFIX}${generateRandomString(24)}`;
        const codeVerifier = generateRandomString(64);
        const codeChallenge = await createCodeChallenge(codeVerifier);
        localStorage.setItem(STORAGE.OAUTH_STATE, oauthState);
        localStorage.setItem(STORAGE.PKCE_VERIFIER, codeVerifier);
        setIsAuthLoading(true);

        const authUrl = new URL(SOUNDCLOUD_AUTHORIZE_URL);
        authUrl.search = new URLSearchParams({
            client_id: SOUNDCLOUD_CLIENT_ID,
            response_type: "code",
            redirect_uri: SOUNDCLOUD_REDIRECT_URI,
            state: oauthState,
            scope: "*",
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
        }).toString();

        const width = 520;
        const height = 760;
        const left = Math.max(0, window.screenX + Math.round((window.outerWidth - width) / 2));
        const top = Math.max(0, window.screenY + Math.round((window.outerHeight - height) / 2));
        const popup = window.open(
            authUrl.toString(),
            "soundcloud_oauth_popup",
            `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );

        if (popup && !popup.closed) {
            popup.focus();
            return;
        }

        window.location.href = authUrl.toString();
    }, []);

    useEffect(() => {
        let mounted = true;
        const initializeAuth = async () => {
            const params = new URLSearchParams(window.location.search);
            const code = params.get("code");
            const state = params.get("state");
            const authError = params.get("error");
            const isScFlow = isSoundcloudState(state);
            const isPopup = Boolean(window.opener && window.opener !== window);
            const storedToken = localStorage.getItem(STORAGE.ACCESS_TOKEN);
            const storedRefreshToken = localStorage.getItem(STORAGE.REFRESH_TOKEN);
            const storedExpiresAt = Number(localStorage.getItem(STORAGE.EXPIRES_AT) || 0);

            try {
                if (isPopup && isScFlow && (code || authError)) {
                    window.opener?.postMessage(
                        {
                            type: "soundcloud-oauth-callback",
                            code: code || undefined,
                            state,
                            error: authError || undefined,
                        } satisfies SoundcloudPopupMessage,
                        window.location.origin
                    );
                    window.close();
                    return;
                }

                if (code && isScFlow) {
                    setIsAuthLoading(true);
                    await completeOAuthLogin(code, state);
                    if (!mounted) return;
                    window.history.replaceState({}, "", SOUNDCLOUD_REDIRECT_URI);
                } else if (storedToken && storedExpiresAt && Date.now() < storedExpiresAt) {
                    accessTokenRef.current = storedToken; // sync ref before fetchLibrary
                    setAccessToken(storedToken);
                    setRefreshToken(storedRefreshToken);
                    setTokenExpiresAt(storedExpiresAt);
                    await fetchLibrary();
                } else if (storedRefreshToken) {
                    setRefreshToken(storedRefreshToken);
                    const data = await tokenRequest({
                        grant_type: "refresh_token",
                        refresh_token: storedRefreshToken,
                    });
                    applyTokenResponse(data, storedRefreshToken);
                    await fetchLibrary();
                }
            } catch (error) {
                console.error(error);
                clearAuthState();
            } finally {
                if (mounted) setIsAuthLoading(false);
            }
        };
        void initializeAuth();
        return () => {
            mounted = false;
        };
    }, [applyTokenResponse, clearAuthState, completeOAuthLogin, fetchLibrary, tokenRequest]);

    useEffect(() => {
        const handlePopupMessage = (event: MessageEvent<SoundcloudPopupMessage>) => {
            if (event.origin !== window.location.origin) return;
            const payload = event.data;
            if (!payload || payload.type !== "soundcloud-oauth-callback") return;

            if (payload.error) {
                setIsAuthLoading(false);
                toast({
                    variant: "destructive",
                    title: "SoundCloud no autorizado",
                    description: "No se completo el permiso en la ventana emergente.",
                });
                return;
            }
            if (!payload.code) return;

            setIsAuthLoading(true);
            void completeOAuthLogin(payload.code, payload.state)
                .catch((error) => {
                    console.error(error);
                    clearAuthState();
                    toast({
                        variant: "destructive",
                        title: "Error de autenticacion",
                        description: "No se pudo iniciar sesion con SoundCloud.",
                    });
                })
                .finally(() => {
                    setIsAuthLoading(false);
                });
        };

        window.addEventListener("message", handlePopupMessage);
        return () => window.removeEventListener("message", handlePopupMessage);
    }, [clearAuthState, completeOAuthLogin]);

    const syncCurrentTrack = useCallback(() => {
        const widget = widgetRef.current;
        if (!widget) return;
        widget.getCurrentSound((sound) => {
            if (!sound) return;
            if (sound.id) {
                const numId = Number(sound.id);
                setCurrentScTrackId((prev) => {
                    if (prev !== numId) {
                        setTrackPlaylistMembership({});
                        setIsCurrentTrackLiked(false);
                    }
                    return numId;
                });
            }
            setCurrentTrack({
                id: String(sound.id || sound.permalink_url || Date.now()),
                uri: sound.permalink_url || loadedUrlRef.current,
                title: sound.title || "SoundCloud Track",
                artist: sound.user?.username || "SoundCloud",
                artistNames: [sound.user?.username || "SoundCloud"],
                durationMs: sound.duration || durationMsRef.current,
                duration: formatMs(sound.duration || durationMsRef.current),
                albumArt: upscaleArtwork(sound.artwork_url || sound.user?.avatar_url),
                externalUrl: sound.permalink_url || loadedUrlRef.current,
                artistId: sound.user?.id ? String(sound.user.id) : undefined,
            });
        });
    }, []);

    const pushRecent = useCallback((item: SoundcloudPlaylist) => {
        if (!item.permalink_url) return;
        setRecentQueue((prev) => {
            const next = [item, ...prev.filter((entry) => entry.permalink_url !== item.permalink_url)];
            return next.slice(0, 20);
        });
    }, []);

    useEffect(() => {
        if (window.SC?.Widget) {
            setSdkReady(true);
            return;
        }
        const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${SOUNDCLOUD_WIDGET_SCRIPT}"]`);
        if (existingScript) {
            const onLoad = () => setSdkReady(true);
            existingScript.addEventListener("load", onLoad);
            return () => existingScript.removeEventListener("load", onLoad);
        }
        const script = document.createElement("script");
        script.src = SOUNDCLOUD_WIDGET_SCRIPT;
        script.async = true;
        script.onload = () => setSdkReady(true);
        document.body.appendChild(script);
    }, []);

    useEffect(() => {
        if (!sdkReady || !window.SC?.Widget || !iframeRef.current) return;
        const widget = window.SC.Widget(iframeRef.current);
        widgetRef.current = widget;
        const { Events } = window.SC.Widget;

        const onReady = () => {
            setStatusText((value) => (value.includes("conectada") ? value : "SoundCloud listo."));
            widget.setVolume(Math.round(volumeRef.current * 100));
            widget.getDuration((value) => setDurationMs(value || 0));
            widget.getPosition((value) => setPositionMs(value || 0));
            syncCurrentTrack();
            if (pendingAutoPlayRef.current) widget.play();
        };
        const onPlay = () => {
            pendingAutoPlayRef.current = false;
            setIsPlaying(true);
            setStatusText("Reproduciendo en SoundCloud.");
            syncCurrentTrack();
        };
        const onPause = () => {
            setIsPlaying(false);
            setStatusText("Pausado.");
        };
        const onFinish = () => {
            const queue = searchQueueRef.current;
            const currentIdx = searchQueueIndexRef.current;
            const mode = isShuffleRef.current;

            if (mode === "smart" && currentScTrackIdRef.current) {
                const trackId = currentScTrackIdRef.current;
                void (async () => {
                    try {
                        const res = await scApiRef.current?.(`/tracks/${trackId}/related?limit=10`, {}, { silent: true });
                        if (res?.ok) {
                            const data = await res.json();
                            const collection = Array.isArray(data) ? data : Array.isArray(data?.collection) ? data.collection : [];
                            const related = collection
                                .filter((t: any) => t?.permalink_url)
                                .map((t: any) => ({
                                    id: Number(t.id),
                                    title: t.title || "Track",
                                    permalink_url: t.permalink_url,
                                    artwork_url: t.artwork_url || t?.user?.avatar_url || null,
                                    kind: "track" as const,
                                    artist: t.user?.username || "SoundCloud",
                                    duration_ms: t.duration || 0,
                                }));
                            if (related.length > 0) {
                                const pick = related[Math.floor(Math.random() * related.length)];
                                const newQueue = [...queue];
                                newQueue.splice(currentIdx + 1, 0, pick);
                                searchQueueRef.current = newQueue;
                                searchQueueIndexRef.current = currentIdx + 1;
                                setTimeout(() => {
                                    loadTrackRef.current?.(pick.permalink_url, true, pick);
                                }, 500);
                                return;
                            }
                        }
                    } catch (_) {}
                    const nextIdx = Math.floor(Math.random() * queue.length);
                    searchQueueIndexRef.current = nextIdx;
                    setTimeout(() => {
                        loadTrackRef.current?.(queue[nextIdx].permalink_url, true, queue[nextIdx]);
                    }, 500);
                })();
                return;
            }

            if (queue.length > 1) {
                let nextIdx: number;
                if (mode === "shuffle") {
                    do { nextIdx = Math.floor(Math.random() * queue.length); }
                    while (nextIdx === currentIdx && queue.length > 1);
                } else {
                    nextIdx = currentIdx + 1;
                }
                if (nextIdx < queue.length) {
                    searchQueueIndexRef.current = nextIdx;
                    const nextItem = queue[nextIdx];
                    setTimeout(() => {
                        loadTrackRef.current?.(nextItem.permalink_url, true, nextItem);
                    }, 500);
                    return;
                }
            }
            setIsPlaying(false);
            setStatusText("Track finalizado.");
        };
        const onProgress = (event?: { currentPosition?: number }) => {
            if (typeof event?.currentPosition === "number") {
                setPositionMs(event.currentPosition);
            }
            widget.getDuration((value) => setDurationMs(value || 0));
        };

        widget.bind(Events.READY, onReady);
        widget.bind(Events.PLAY, onPlay);
        widget.bind(Events.PAUSE, onPause);
        widget.bind(Events.FINISH, onFinish);
        widget.bind(Events.PLAY_PROGRESS, onProgress);

        return () => {
            try { widget.unbind(Events.READY); } catch (_) {}
            try { widget.unbind(Events.PLAY); } catch (_) {}
            try { widget.unbind(Events.PAUSE); } catch (_) {}
            try { widget.unbind(Events.FINISH); } catch (_) {}
            try { widget.unbind(Events.PLAY_PROGRESS); } catch (_) {}
            if (widgetRef.current === widget) widgetRef.current = null;
        };
    }, [sdkReady, iframeSrc, syncCurrentTrack]);

    const loadTrack = useCallback((value: string, autoPlay = true, meta?: Partial<SoundcloudPlaylist>) => {
        const normalized = normalizeSoundcloudUrl(value);
        if (!normalized) {
            toast({
                variant: "destructive",
                title: "Enlace invalido",
                description: "Ingresa un enlace valido de SoundCloud.",
            });
            return false;
        }
        setInputUrl(normalized);
        setLoadedUrl(normalized);
        pendingAutoPlayRef.current = autoPlay;
        setIsPlaying(false);
        setPositionMs(0);
        setDurationMs(0);
        setStatusText("Cargando track de SoundCloud...");
        const widget = widgetRef.current;
        if (widget) {
            widget.load(normalized, {
                auto_play: autoPlay,
                hide_related: true,
                show_comments: false,
                show_user: true,
                show_reposts: false,
                visual: true,
            });
            if (autoPlay) widget.play();
        } else {
            setIframeSrc(buildWidgetSrc(normalized, autoPlay));
        }
        if (meta?.title) {
            if (meta.id) {
                const numId = Number(meta.id);
                setCurrentScTrackId(numId);
                setTrackPlaylistMembership({});
                setIsCurrentTrackLiked(false);
            }
            setCurrentTrack({
                id: String(meta.id || normalized),
                uri: normalized,
                title: meta.title,
                artist: meta.artist || "SoundCloud",
                durationMs: meta.duration_ms || 0,
                duration: formatMs(meta.duration_ms || 0),
                albumArt: upscaleArtwork(meta.artwork_url || null),
                externalUrl: normalized,
            });
        }
        pushRecent({
            id: Number(meta?.id || Date.now()),
            title: meta?.title || normalized,
            permalink_url: normalized,
            artwork_url: meta?.artwork_url || null,
            track_count: 1,
            subtitle: meta?.subtitle || "Reproducido",
            kind: "track",
            artist: meta?.artist,
            duration_ms: meta?.duration_ms,
        });
        return true;
    }, [pushRecent]);

    loadTrackRef.current = loadTrack;
    isShuffleRef.current = shuffleMode;
    scApiRef.current = scApi;
    currentScTrackIdRef.current = currentScTrackId;
    volumeRef.current = volume;

    const playFromList = useCallback(
        (items: SoundcloudPlaylist[], index: number) => {
            if (!items.length || index < 0 || index >= items.length) return;
            const item = items[index];
            if (!item?.permalink_url) return;
            searchQueueRef.current = items;
            searchQueueIndexRef.current = index;
            loadTrack(item.permalink_url, true, item);
        },
        [loadTrack]
    );

    const openPlaylist = useCallback(async (playlist: SoundcloudPlaylist) => {
        setExpandedPlaylist({ id: playlist.id, title: playlist.title, tracks: [] });
        setExpandedPlaylistLoading(true);
        try {
            const res = await scApi(`/playlists/${playlist.id}`, {}, { silent: true });
            if (!res.ok) { setExpandedPlaylist(null); return; }
            const data = await res.json() as { tracks?: any[]; title?: string };
            const tracks: SoundcloudPlaylist[] = (data.tracks || [])
                .filter((t: any) => t?.permalink_url)
                .map((t: any) => ({
                    id: Number(t.id),
                    title: t.title || "Track",
                    permalink_url: t.permalink_url,
                    artwork_url: t.artwork_url || t?.user?.avatar_url || null,
                    kind: "track" as const,
                    artist: t.user?.username || "SoundCloud",
                    duration_ms: t.duration || 0,
                }));
            setExpandedPlaylist({ id: playlist.id, title: playlist.title, tracks });
        } finally {
            setExpandedPlaylistLoading(false);
        }
    }, [scApi]);

    const closeExpandedPlaylist = useCallback(() => setExpandedPlaylist(null), []);

    const toggleShuffle = useCallback(() =>
        setShuffleMode(getNextShuffleMode),
    []);

    const playPlaylist = useCallback(
        (playlist: SoundcloudPlaylist) => {
            if (!playlist?.permalink_url) return;
            searchQueueRef.current = [playlist];
            searchQueueIndexRef.current = 0;
            loadTrack(playlist.permalink_url, true, {
                id: playlist.id,
                title: playlist.title,
                artwork_url: playlist.artwork_url,
                subtitle: playlist.subtitle,
                artist: playlist.artist,
                duration_ms: playlist.duration_ms,
            });
        },
        [loadTrack]
    );

    const loadFromInput = useCallback(() => loadTrack(inputUrl, true), [inputUrl, loadTrack]);

    const clearSearchResults = useCallback(() => {
        setSearchResults([]);
    }, []);

    const searchCatalog = useCallback(
        async (query: string) => {
            const q = query.trim();
            if (!q) {
                setSearchResults([]);
                return;
            }
            if (!accessTokenRef.current) {
                toast({ title: "SoundCloud", description: "Conecta tu cuenta para buscar tracks." });
                return;
            }
            setSearchLoading(true);
            try {
                const response = await scApi(`/tracks?q=${encodeURIComponent(q)}&limit=20&linked_partitioning=1`, {}, { silent: true });
                if (!response.ok) {
                    setSearchResults([]);
                    return;
                }
                const raw = await response.json();
                const collection = Array.isArray(raw) ? raw : Array.isArray(raw?.collection) ? raw.collection : [];
                const mapped: SoundcloudPlaylist[] = collection
                    .filter((item: SoundcloudSearchItem) => item?.permalink_url)
                    .map((item: SoundcloudSearchItem) => ({
                        id: Number(item.id),
                        title: item.title || "Track",
                        permalink_url: item.permalink_url,
                        artwork_url: item.artwork_url || item?.user?.avatar_url || null,
                        track_count: 1,
                        subtitle: "Busqueda",
                        kind: "track",
                        artist: item.user?.username || "SoundCloud",
                        duration_ms: item.duration || 0,
                    }));
                setSearchResults(mapped);
                searchQueueRef.current = mapped;
                searchQueueIndexRef.current = -1;
            } finally {
                setSearchLoading(false);
            }
        },
        [scApi]
    );

    const playSearchTrack = useCallback(
        (item: SoundcloudPlaylist) => {
            if (!item?.permalink_url) return;
            const idx = searchQueueRef.current.findIndex((r) => r.id === item.id);
            searchQueueIndexRef.current = idx;
            loadTrack(item.permalink_url, true, item);
        },
        [loadTrack]
    );

    const searchAndPlay = useCallback(
        async (query: string) => {
            const q = query.trim();
            if (!q) return;
            if (!accessTokenRef.current) return;
            setSearchLoading(true);
            try {
                const response = await scApi(`/tracks?q=${encodeURIComponent(q)}&limit=20&linked_partitioning=1`, {}, { silent: true });
                if (!response.ok) return;
                const raw = await response.json();
                const collection = Array.isArray(raw) ? raw : Array.isArray(raw?.collection) ? raw.collection : [];
                const mapped: SoundcloudPlaylist[] = collection
                    .filter((item: SoundcloudSearchItem) => item?.permalink_url)
                    .map((item: SoundcloudSearchItem) => ({
                        id: Number(item.id),
                        title: item.title || "Track",
                        permalink_url: item.permalink_url,
                        artwork_url: item.artwork_url || item?.user?.avatar_url || null,
                        track_count: 1,
                        subtitle: "Busqueda",
                        kind: "track",
                        artist: item.user?.username || "SoundCloud",
                        duration_ms: item.duration || 0,
                    }));
                setSearchResults(mapped);
                const first = mapped[0];
                if (!first) {
                    toast({ title: "Sin resultados", description: "No se encontraron tracks en SoundCloud." });
                    return;
                }
                playSearchTrack(first);
            } finally {
                setSearchLoading(false);
            }
        },
        [playSearchTrack, scApi]
    );

    const togglePlayPause = useCallback(() => {
        widgetRef.current?.toggle();
    }, []);

    const play = useCallback(() => {
        pendingAutoPlayRef.current = true;
        widgetRef.current?.play();
    }, []);

    const pause = useCallback(() => {
        pendingAutoPlayRef.current = false;
        widgetRef.current?.pause();
    }, []);

    const nextTrack = useCallback(() => {
        const queue = searchQueueRef.current;
        const currentIdx = searchQueueIndexRef.current;
        const currentItem = queue[currentIdx];
        // Playlist loaded in widget — let it handle internal track navigation
        if (currentItem?.kind === "playlist") {
            widgetRef.current?.next();
            return;
        }
        if (queue.length > 1) {
            let nextIdx: number;
            if (shuffleMode === "smart" || shuffleMode === "shuffle") {
                do { nextIdx = Math.floor(Math.random() * queue.length); }
                while (nextIdx === currentIdx && queue.length > 1);
            } else {
                nextIdx = currentIdx + 1;
            }
            if (nextIdx < queue.length) {
                searchQueueIndexRef.current = nextIdx;
                loadTrackRef.current?.(queue[nextIdx].permalink_url, true, queue[nextIdx]);
            }
        }
    }, [shuffleMode]);

    const prevTrack = useCallback(() => {
        const queue = searchQueueRef.current;
        const currentIdx = searchQueueIndexRef.current;
        const currentItem = queue[currentIdx];
        // Playlist loaded in widget — let it handle internal track navigation
        if (currentItem?.kind === "playlist") {
            widgetRef.current?.prev();
            return;
        }
        const prevIdx = currentIdx - 1;
        if (queue.length > 1 && prevIdx >= 0) {
            searchQueueIndexRef.current = prevIdx;
            loadTrackRef.current?.(queue[prevIdx].permalink_url, true, queue[prevIdx]);
        }
    }, []);

    const seekToProgress = useCallback(
        (pct: number) => {
            if (!durationMs || !widgetRef.current) return;
            const ms = Math.floor((Math.max(0, Math.min(100, pct)) / 100) * durationMs);
            widgetRef.current.seekTo(ms);
            setPositionMs(ms);
        },
        [durationMs]
    );

    const setVolumeLevel = useCallback((value: number) => {
        const next = Math.max(0, Math.min(1, value));
        setVolume(next);
        widgetRef.current?.setVolume(Math.round(next * 100));
    }, []);

    const shareCurrent = useCallback(async () => {
        const target = currentTrack?.externalUrl || loadedUrl;
        if (!target) return;
        await navigator.clipboard.writeText(target);
        toast({ title: "Enlace copiado", description: "SoundCloud URL copiada al portapapeles." });
    }, [currentTrack?.externalUrl, loadedUrl]);

    const loadTrackMembership = useCallback(async (playlists: SoundcloudPlaylist[]) => {
        if (!currentScTrackId || !playlists.length) return;
        setMembershipLoading(true);
        try {
            const results = await Promise.all(
                playlists.map(async (pl) => {
                    const res = await scApi(`/playlists/${pl.id}?representation=compact`, {}, { silent: true });
                    if (!res.ok) return [pl.id, false] as const;
                    const data = await res.json() as { tracks?: { id: number }[] };
                    const inPlaylist = (data.tracks || []).some((t) => t.id === currentScTrackId);
                    return [pl.id, inPlaylist] as const;
                })
            );
            setTrackPlaylistMembership(Object.fromEntries(results));
        } finally {
            setMembershipLoading(false);
        }
    }, [currentScTrackId, scApi]);

    // Auto-check membership whenever the active track or playlist library changes
    useEffect(() => {
        if (!currentScTrackId || !libraryBySection.playlists.length) {
            setTrackPlaylistMembership({});
            return;
        }
        void loadTrackMembership(libraryBySection.playlists);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentScTrackId]);

    const loadTimedComments = useCallback(async (trackId: number) => {
        // Comments API requires OAuth — skip if not authenticated
        if (!accessTokenRef.current) return;
        setTimedComments([]);
        const res = await scApi(`/tracks/${trackId}/comments?limit=200`, {}, { silent: true, includeClientId: false });
        if (!res.ok) return;
        const raw = await res.json() as ScTimedComment[] | { collection?: ScTimedComment[] };
        const all = Array.isArray(raw) ? raw : (raw.collection || []);
        setTimedComments(
            all
                .filter((c) => c.timestamp != null)
                .slice(0, 50)
        );
    }, [scApi]);

    // Auto-load timed comments whenever the active track changes
    useEffect(() => {
        if (currentScTrackId) {
            void loadTimedComments(currentScTrackId);
        } else {
            setTimedComments([]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentScTrackId]);

    // Re-attempt loading comments when user authenticates (token was missing on first try)
    useEffect(() => {
        if (accessToken && currentScTrackId) {
            void loadTimedComments(currentScTrackId);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessToken]);

    const toggleTrackInPlaylist = useCallback(async (playlist: SoundcloudPlaylist) => {
        if (!currentScTrackId || !playlist.id) return;
        const res = await scApi(`/playlists/${playlist.id}?representation=compact`, {}, { silent: true });
        if (!res.ok) {
            toast({ variant: "destructive", title: "Error", description: "No se pudo acceder a la playlist." });
            return;
        }
        const data = await res.json() as { tracks?: { id: number }[] };
        const tracks = (data.tracks || []).map((t) => ({ id: t.id }));
        const inPlaylist = tracks.some((t) => t.id === currentScTrackId);
        const newTracks = inPlaylist
            ? tracks.filter((t) => t.id !== currentScTrackId)
            : [...tracks, { id: currentScTrackId }];
        const putRes = await scApi(
            `/playlists/${playlist.id}`,
            { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playlist: { tracks: newTracks } }) },
            { silent: false }
        );
        if (putRes.ok) {
            setTrackPlaylistMembership((prev) => ({ ...prev, [playlist.id]: !inPlaylist }));
            toast({ title: inPlaylist ? "Removido de playlist" : "Añadido a playlist", description: `"${playlist.title}"` });
        }
    }, [currentScTrackId, scApi]);

    const toggleCurrentTrackLike = useCallback(async () => {
        if (!currentScTrackId) return;
        const method = isCurrentTrackLiked ? "DELETE" : "PUT";
        const res = await scApi(
            `/likes/tracks/${currentScTrackId}`,
            { method },
            { silent: true }
        );
        if (res.ok || res.status === 201 || res.status === 204) {
            setIsCurrentTrackLiked((prev) => !prev);
            toast({ title: isCurrentTrackLiked ? "Like eliminado" : "¡Track likeado!" });
        } else {
            toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el like." });
        }
    }, [currentScTrackId, isCurrentTrackLiked, scApi]);

    const logout = useCallback(() => {
        clearAuthState();
        setStatusText("Cuenta de SoundCloud desconectada.");
    }, [clearAuthState]);

    const fetchArtistData = useCallback(async (userId: string): Promise<ArtistData | null> => {
        if (!userId) return null;
        try {
            const [userRes, tracksRes] = await Promise.all([
                scApi(`/users/${userId}`, {}, { silent: true, includeClientId: false }),
                scApi(`/users/${userId}/tracks?limit=10`, {}, { silent: true, includeClientId: false }),
            ]);
            if (!userRes.ok) return null;
            interface SCUser {
                id: number;
                username: string;
                full_name?: string;
                avatar_url?: string | null;
                followers_count?: number;
                description?: string;
                permalink_url?: string;
            }
            interface SCTrack {
                id: number;
                title?: string;
                user?: { username?: string };
                duration?: number;
                artwork_url?: string | null;
                permalink_url?: string;
            }
            const user = (await userRes.json()) as SCUser;
            const rawTracks = tracksRes.ok ? ((await tracksRes.json()) as unknown) : [];
            const tracks = Array.isArray(rawTracks) ? (rawTracks as SCTrack[]) : [];
            return {
                id: String(user.id),
                name: user.full_name || user.username,
                image: upscaleArtwork(user.avatar_url),
                followers: user.followers_count,
                externalUrl: user.permalink_url,
                topTracks: tracks.slice(0, 10).map((t) => ({
                    id: String(t.id),
                    uri: t.permalink_url || "",
                    title: t.title || "Sin título",
                    artist: t.user?.username || user.username,
                    duration: formatMs(t.duration || 0),
                    albumArt: upscaleArtwork(t.artwork_url || user.avatar_url),
                })),
            };
        } catch {
            return null;
        }
    }, [scApi]);

    const reset = useCallback(() => {
        widgetRef.current?.pause();
        setIsPlaying(false);
        setStatusText("Modo SoundCloud cerrado.");
    }, []);

    const progress = useMemo(() => {
        if (!durationMs) return 0;
        return Math.max(0, Math.min(100, (positionMs / durationMs) * 100));
    }, [durationMs, positionMs]);

    const activeTrack: CurrentTrack =
        currentTrack || {
            id: "soundcloud-fallback",
            uri: loadedUrl,
            title: "Sin reproduccion",
            artist: "Carga un track de SoundCloud",
            durationMs: 0,
            duration: "0:00",
            albumArt: fallbackAlbumArt,
            externalUrl: loadedUrl,
        };

    return {
        iframeRef,
        iframeSrc,
        sdkReady,
        isAuthenticated: Boolean(accessToken),
        isAuthLoading,
        accountName: account?.full_name || account?.username || "",
        inputUrl,
        setInputUrl,
        currentTrack: activeTrack,
        statusText,
        libraryBySection,
        libraryNextBySection,
        libraryLoading,
        libraryLoadingMoreBySection,
        searchResults,
        searchLoading,
        recentQueue,
        currentScTrackId,
        trackPlaylistMembership,
        isCurrentTrackLiked,
        isPlaying,
        volume,
        progress,
        positionMs,
        durationMs,
        currentTime: formatMs(positionMs),
        totalTime: formatMs(durationMs),
        startLogin,
        logout,
        fetchLibrary,
        loadMoreLibrarySection,
        clearSearchResults,
        searchCatalog,
        searchAndPlay,
        playSearchTrack,
        loadTrack,
        loadFromInput,
        playPlaylist,
        playFromList,
        togglePlayPause,
        play,
        pause,
        nextTrack,
        prevTrack,
        seekToProgress,
        setVolumeLevel,
        shareCurrent,
        toggleTrackInPlaylist,
        loadTrackMembership,
        membershipLoading,
        toggleCurrentTrackLike,
        expandedPlaylist,
        expandedPlaylistLoading,
        shuffleMode,
        openPlaylist,
        closeExpandedPlaylist,
        toggleShuffle,
        timedComments,
        fetchArtistData,
        reset,
    };
};

export default useSoundcloudPlayer;
