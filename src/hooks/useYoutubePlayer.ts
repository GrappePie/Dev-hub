import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import fallbackAlbumArt from "@/assets/album-art-placeholder.svg";
import type { CurrentTrack, QueueTrack } from "@/hooks/useSpotifyPlayer";

const YOUTUBE_IFRAME_API = "https://www.youtube.com/iframe_api";
const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || "";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
const DEFAULT_VIDEO_ID = "dQw4w9WgXcQ";
const VOLUME_STORAGE_KEY = "mh_yt_vol";

const STORAGE = {
    ACCESS_TOKEN: "yt_access_token",
    EXPIRES_AT: "yt_token_expires_at",
    ACCOUNT_NAME: "yt_account_name",
} as const;

export type YouTubeLibrarySection = "playlists" | "likes" | "watchLater";

interface YouTubeSearchResult {
    id?: { videoId?: string };
    snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: {
            high?: { url?: string };
            medium?: { url?: string };
            default?: { url?: string };
        };
    };
}

interface YouTubePlaylist {
    id?: string;
    snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: {
            high?: { url?: string };
            medium?: { url?: string };
            default?: { url?: string };
        };
    };
    contentDetails?: {
        itemCount?: number;
    };
}

interface YouTubePlaylistItem {
    snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: {
            high?: { url?: string };
            medium?: { url?: string };
            default?: { url?: string };
        };
        resourceId?: {
            videoId?: string;
        };
    };
    contentDetails?: {
        videoId?: string;
    };
}

interface YouTubeVideoDetails {
    id?: string;
    contentDetails?: {
        duration?: string;
    };
}

interface YouTubePagedResponse<T> {
    items?: T[];
    nextPageToken?: string;
}

interface YouTubeCommentSnippet {
    authorDisplayName?: string;
    textDisplay?: string;
    likeCount?: number;
    publishedAt?: string;
}

interface YouTubeCommentThreadItem {
    id?: string;
    snippet?: { topLevelComment?: { snippet?: YouTubeCommentSnippet } };
}

export interface YouTubeComment {
    id: string;
    author: string;
    text: string;
    likeCount: number;
    publishedAt: string;
}

interface YouTubeTrack {
    id: string;
    videoId: string;
    uri: string;
    title: string;
    artist: string;
    image: string;
    durationMs: number;
    duration: string;
}

interface YouTubeLibraryPlaylistItem {
    id: string;
    kind: "playlist";
    playlistId: string;
    title: string;
    artist: string;
    image: string;
    trackCount: number;
}

interface YouTubeLibraryTrackItem extends YouTubeTrack {
    kind: "track";
}

export type YouTubeLibraryItem = YouTubeLibraryPlaylistItem | YouTubeLibraryTrackItem;

type YouTubeLibraryBySection = Record<YouTubeLibrarySection, YouTubeLibraryItem[]>;
type YouTubeLibraryNextBySection = Record<YouTubeLibrarySection, string | null>;
type YouTubeLibraryLoadingBySection = Record<YouTubeLibrarySection, boolean>;

const EMPTY_LIBRARY: YouTubeLibraryBySection = { playlists: [], likes: [], watchLater: [] };
const EMPTY_LIBRARY_NEXT: YouTubeLibraryNextBySection = { playlists: null, likes: null, watchLater: null };
const EMPTY_LIBRARY_LOADING: YouTubeLibraryLoadingBySection = { playlists: false, likes: false, watchLater: false };

let youtubeApiPromise: Promise<void> | null = null;
let googleIdentityPromise: Promise<void> | null = null;

const readStoredVolume = () => {
    const raw = localStorage.getItem(VOLUME_STORAGE_KEY);
    const parsed = raw ? Number(raw) : 0.5;
    if (!Number.isFinite(parsed)) return 0.5;
    return Math.max(0, Math.min(1, parsed));
};

const formatMs = (ms = 0) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatCountdown = (expiresAt: number) => {
    const remaining = Math.max(0, expiresAt - Date.now());
    const secs = Math.floor(remaining / 1000);
    const mins = Math.floor(secs / 60);
    return `${mins}:${String(secs % 60).padStart(2, "0")}`;
};

const parseIsoDuration = (value?: string) => {
    if (!value) return 0;
    const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    if (!match) return 0;
    const hours = Number(match[1] || 0);
    const mins = Number(match[2] || 0);
    const secs = Number(match[3] || 0);
    return ((hours * 60 + mins) * 60 + secs) * 1000;
};

const toWatchUrl = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`;

const pickThumb = (value?: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } }) =>
    value?.high?.url || value?.medium?.url || value?.default?.url || fallbackAlbumArt;

const ensureYoutubeApi = () => {
    if (window.YT?.Player) return Promise.resolve();
    if (youtubeApiPromise) return youtubeApiPromise;

    youtubeApiPromise = new Promise<void>((resolve, reject) => {
        const previous = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            previous?.();
            resolve();
        };

        const existing = document.querySelector<HTMLScriptElement>(`script[src="${YOUTUBE_IFRAME_API}"]`);
        if (existing) return;

        const script = document.createElement("script");
        script.src = YOUTUBE_IFRAME_API;
        script.async = true;
        script.onerror = () => reject(new Error("No se pudo cargar YouTube IFrame API"));
        document.body.appendChild(script);
    });

    return youtubeApiPromise;
};

const ensureGoogleIdentity = () => {
    if (window.google?.accounts?.oauth2) return Promise.resolve();
    if (googleIdentityPromise) return googleIdentityPromise;

    googleIdentityPromise = new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_IDENTITY_SCRIPT}"]`);
        if (existing) {
            resolve();
            return;
        }
        const script = document.createElement("script");
        script.src = GOOGLE_IDENTITY_SCRIPT;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("No se pudo cargar Google Identity Services"));
        document.body.appendChild(script);
    });

    return googleIdentityPromise;
};

const mapQueueTrack = (track: YouTubeTrack): QueueTrack => ({
    id: track.id,
    title: track.title,
    artist: track.artist,
    duration: track.duration,
    uri: track.uri,
});

const mapCurrentTrack = (track: YouTubeTrack): CurrentTrack => ({
    id: track.id,
    uri: track.uri,
    title: track.title,
    artist: track.artist,
    durationMs: track.durationMs,
    duration: track.duration,
    albumArt: track.image || fallbackAlbumArt,
    externalUrl: track.uri,
});

export const useYoutubePlayer = () => {
    const [playerHostEl, setPlayerHostEl] = useState<HTMLDivElement | null>(null);
    const playerHostRef = useCallback((node: HTMLDivElement | null) => {
        setPlayerHostEl(node);
        if (!node) setPlayerReady(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const playerRef = useRef<YouTubePlayer | null>(null);
    const tokenClientRef = useRef<GoogleTokenClient | null>(null);
    const accessTokenRef = useRef<string | null>(null);
    const likesPlaylistIdRef = useRef<string | null>(null);
    const watchLaterPlaylistIdRef = useRef<string | null>(null);
    const queueRef = useRef<YouTubeTrack[]>([]);
    const queueIndexRef = useRef(-1);
    const repeatModeRef = useRef<0 | 1 | 2>(0);
    const shuffleModeRef = useRef<"off" | "shuffle" | "smart">("off");
    const pendingTrackRef = useRef<YouTubeTrack | null>(null);
    const fetchedLibraryRef = useRef(false);

    const [apiReady, setApiReady] = useState(false);
    const [playerReady, setPlayerReady] = useState(false);
    const [statusText, setStatusText] = useState("YouTube mode listo. Busca una canción para empezar.");
    const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null);
    const [searchResults, setSearchResults] = useState<YouTubeTrack[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [queueTracks, setQueueTracks] = useState<YouTubeTrack[]>([]);
    const [queueIndex, setQueueIndex] = useState(-1);
    const [recentQueue, setRecentQueue] = useState<YouTubeTrack[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [shuffleMode, setShuffleMode] = useState<"off" | "shuffle" | "smart">("off");
    const [repeatMode, setRepeatMode] = useState<0 | 1 | 2>(0);
    const [volume, setVolume] = useState(readStoredVolume);
    const [durationMs, setDurationMs] = useState(0);
    const [positionMs, setPositionMs] = useState(0);
    const [comments, setComments] = useState<YouTubeComment[]>([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [showVideo, setShowVideo] = useState(false);
    const [pipMode, setPipMode] = useState(false);

    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);
    const [isAuthLoading, setIsAuthLoading] = useState(false);
    const [accountName, setAccountName] = useState("");
    const [libraryBySection, setLibraryBySection] = useState<YouTubeLibraryBySection>(EMPTY_LIBRARY);
    const [libraryNextBySection, setLibraryNextBySection] = useState<YouTubeLibraryNextBySection>(EMPTY_LIBRARY_NEXT);
    const [libraryLoading, setLibraryLoading] = useState(false);
    const [libraryLoadingMoreBySection, setLibraryLoadingMoreBySection] = useState<YouTubeLibraryLoadingBySection>(EMPTY_LIBRARY_LOADING);

    useEffect(() => {
        accessTokenRef.current = accessToken;
    }, [accessToken]);

    useEffect(() => {
        queueRef.current = queueTracks;
    }, [queueTracks]);

    useEffect(() => {
        queueIndexRef.current = queueIndex;
    }, [queueIndex]);

    useEffect(() => {
        repeatModeRef.current = repeatMode;
    }, [repeatMode]);

    useEffect(() => {
        shuffleModeRef.current = shuffleMode;
    }, [shuffleMode]);

    const clearAuth = useCallback(() => {
        setAccessToken(null);
        setTokenExpiresAt(null);
        setAccountName("");
        setLibraryBySection(EMPTY_LIBRARY);
        setLibraryNextBySection(EMPTY_LIBRARY_NEXT);
        setLibraryLoading(false);
        setLibraryLoadingMoreBySection(EMPTY_LIBRARY_LOADING);
        localStorage.removeItem(STORAGE.ACCESS_TOKEN);
        localStorage.removeItem(STORAGE.EXPIRES_AT);
        localStorage.removeItem(STORAGE.ACCOUNT_NAME);
        likesPlaylistIdRef.current = null;
        watchLaterPlaylistIdRef.current = null;
        fetchedLibraryRef.current = false;
    }, []);

    const youtubeApiGet = useCallback(
        async (
            endpoint: string,
            params: Record<string, string | number> = {},
            opts: { auth?: boolean; includeApiKey?: boolean; silent?: boolean } = {}
        ) => {
            const { auth = false, includeApiKey = true, silent = false } = opts;
            const url = new URL(`${YOUTUBE_API_BASE}${endpoint}`);
            Object.entries(params).forEach(([key, value]) => {
                if (value === undefined || value === null || value === "") return;
                url.searchParams.set(key, String(value));
            });
            if (includeApiKey && YOUTUBE_API_KEY) {
                url.searchParams.set("key", YOUTUBE_API_KEY);
            }
            const headers: HeadersInit = {};
            if (auth && accessTokenRef.current) {
                headers.Authorization = `Bearer ${accessTokenRef.current}`;
            }
            const response = await fetch(url.toString(), { headers });
            if (!response.ok && !silent) {
                const text = await response.clone().text();
                toast({
                    variant: "destructive",
                    title: "Error YouTube",
                    description: `API ${response.status}${text ? ` · ${text.slice(0, 120)}` : ""}`,
                });
            }
            if (response.status === 401 && auth) {
                clearAuth();
            }
            return response;
        },
        [clearAuth]
    );

    const fetchDurationsByVideoId = useCallback(
        async (videoIds: string[], useAuth: boolean) => {
            const ids = Array.from(new Set(videoIds.filter(Boolean)));
            const map = new Map<string, number>();
            if (!ids.length) return map;
            const response = await youtubeApiGet(
                "/videos",
                { part: "contentDetails", id: ids.join(",") },
                { auth: useAuth, includeApiKey: !useAuth, silent: true }
            );
            if (!response.ok) return map;
            const data = (await response.json()) as YouTubePagedResponse<YouTubeVideoDetails>;
            (data.items || []).forEach((item) => {
                if (!item.id) return;
                map.set(item.id, parseIsoDuration(item.contentDetails?.duration));
            });
            return map;
        },
        [youtubeApiGet]
    );

    const canSearch = useCallback(() => {
        if (YOUTUBE_API_KEY || accessTokenRef.current) return true;
        toast({
            variant: "destructive",
            title: "Config faltante",
            description: "Define VITE_YOUTUBE_API_KEY o conecta tu cuenta Google.",
        });
        return false;
    }, []);

    const mapSearchResults = useCallback(
        async (items: YouTubeSearchResult[], useAuth: boolean) => {
            const ids = items.map((item) => item.id?.videoId).filter((value): value is string => Boolean(value));
            const durationById = await fetchDurationsByVideoId(ids, useAuth);
            return items
                .map((item) => {
                    const videoId = item.id?.videoId;
                    if (!videoId) return null;
                    const duration = durationById.get(videoId) || 0;
                    return {
                        id: `yt-${videoId}`,
                        videoId,
                        uri: toWatchUrl(videoId),
                        title: item.snippet?.title || "YouTube Track",
                        artist: item.snippet?.channelTitle || "YouTube",
                        image: pickThumb(item.snippet?.thumbnails),
                        durationMs: duration,
                        duration: formatMs(duration),
                    } satisfies YouTubeTrack;
                })
                .filter((item): item is YouTubeTrack => Boolean(item));
        },
        [fetchDurationsByVideoId]
    );

    const fetchSearch = useCallback(
        async (query: string) => {
            if (!canSearch()) return [];
            const q = query.trim();
            if (!q) return [];
            const useAuth = Boolean(accessTokenRef.current);
            const response = await youtubeApiGet(
                "/search",
                {
                    part: "snippet",
                    type: "video",
                    videoEmbeddable: "true",
                    videoCategoryId: "10",
                    maxResults: 20,
                    q,
                },
                { auth: useAuth, includeApiKey: !useAuth, silent: true }
            );
            if (!response.ok) return [];
            const data = (await response.json()) as YouTubePagedResponse<YouTubeSearchResult>;
            return mapSearchResults(data.items || [], useAuth);
        },
        [canSearch, mapSearchResults, youtubeApiGet]
    );

    const fetchComments = useCallback(
        async (videoId: string) => {
            if (!videoId) return;
            setCommentsLoading(true);
            setComments([]);
            const useAuth = Boolean(accessTokenRef.current);
            const response = await youtubeApiGet(
                "/commentThreads",
                { part: "snippet", videoId, order: "relevance", maxResults: 20 },
                { auth: useAuth, includeApiKey: true, silent: true }
            );
            setCommentsLoading(false);
            if (!response.ok) return;
            const data = (await response.json()) as YouTubePagedResponse<YouTubeCommentThreadItem>;
            const mapped: YouTubeComment[] = (data.items || [])
                .map((item) => ({
                    id: item.id || String(Math.random()),
                    author: item.snippet?.topLevelComment?.snippet?.authorDisplayName || "Anónimo",
                    text: item.snippet?.topLevelComment?.snippet?.textDisplay || "",
                    likeCount: item.snippet?.topLevelComment?.snippet?.likeCount || 0,
                    publishedAt: item.snippet?.topLevelComment?.snippet?.publishedAt || "",
                }))
                .filter((c) => c.text);
            setComments(mapped);
        },
        [youtubeApiGet]
    );

    useEffect(() => {
        if (!currentTrack?.id) { setComments([]); return; }
        const videoId = currentTrack.id.startsWith("yt-") ? currentTrack.id.slice(3) : currentTrack.id;
        void fetchComments(videoId);
    }, [currentTrack?.id, fetchComments]);

    const fetchPlaylistTracks = useCallback(
        async (playlistId: string) => {
            const useAuth = Boolean(accessTokenRef.current);
            const response = await youtubeApiGet(
                "/playlistItems",
                {
                    part: "snippet,contentDetails",
                    playlistId,
                    maxResults: 50,
                },
                { auth: useAuth, includeApiKey: !useAuth, silent: true }
            );
            if (!response.ok) return [];
            const data = (await response.json()) as YouTubePagedResponse<YouTubePlaylistItem>;
            const raw = data.items || [];
            const ids = raw
                .map((item) => item.contentDetails?.videoId || item.snippet?.resourceId?.videoId)
                .filter((value): value is string => Boolean(value));
            const durationById = await fetchDurationsByVideoId(ids, useAuth);
            return raw
                .map((item) => {
                    const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
                    if (!videoId) return null;
                    const duration = durationById.get(videoId) || 0;
                    return {
                        id: `yt-${videoId}`,
                        videoId,
                        uri: toWatchUrl(videoId),
                        title: item.snippet?.title || "YouTube Track",
                        artist: item.snippet?.channelTitle || "YouTube",
                        image: pickThumb(item.snippet?.thumbnails),
                        durationMs: duration,
                        duration: formatMs(duration),
                    } satisfies YouTubeTrack;
                })
                .filter((item): item is YouTubeTrack => Boolean(item));
        },
        [fetchDurationsByVideoId, youtubeApiGet]
    );

    const fetchLibrary = useCallback(async () => {
        if (!accessTokenRef.current) return;
        fetchedLibraryRef.current = true;
        setLibraryLoading(true);
        setLibraryLoadingMoreBySection(EMPTY_LIBRARY_LOADING);
        try {
            const meResponse = await youtubeApiGet(
                "/channels",
                { part: "snippet,contentDetails", mine: "true", maxResults: 1 },
                { auth: true, includeApiKey: false, silent: true }
            );
            if (!meResponse.ok) return;
            const meData = (await meResponse.json()) as {
                items?: Array<{
                    snippet?: { title?: string };
                    contentDetails?: { relatedPlaylists?: { likes?: string; watchLater?: string } };
                }>;
            };
            const me = meData.items?.[0];
            const displayName = me?.snippet?.title || "";
            setAccountName(displayName);
            if (displayName) {
                localStorage.setItem(STORAGE.ACCOUNT_NAME, displayName);
            }
            likesPlaylistIdRef.current = me?.contentDetails?.relatedPlaylists?.likes || null;
            watchLaterPlaylistIdRef.current = me?.contentDetails?.relatedPlaylists?.watchLater || null;

            const [playlistsResponse, likesResponse, watchLaterResponse] = await Promise.all([
                youtubeApiGet(
                    "/playlists",
                    { part: "snippet,contentDetails", mine: "true", maxResults: 20 },
                    { auth: true, includeApiKey: false, silent: true }
                ),
                likesPlaylistIdRef.current
                    ? youtubeApiGet(
                          "/playlistItems",
                          {
                              part: "snippet,contentDetails",
                              playlistId: likesPlaylistIdRef.current,
                              maxResults: 20,
                          },
                          { auth: true, includeApiKey: false, silent: true }
                      )
                    : Promise.resolve(null),
                watchLaterPlaylistIdRef.current
                    ? youtubeApiGet(
                          "/playlistItems",
                          {
                              part: "snippet,contentDetails",
                              playlistId: watchLaterPlaylistIdRef.current,
                              maxResults: 20,
                          },
                          { auth: true, includeApiKey: false, silent: true }
                      )
                    : Promise.resolve(null),
            ]);

            const nextLibrary: YouTubeLibraryBySection = { ...EMPTY_LIBRARY };
            const nextTokens: YouTubeLibraryNextBySection = { ...EMPTY_LIBRARY_NEXT };

            if (playlistsResponse.ok) {
                const data = (await playlistsResponse.json()) as YouTubePagedResponse<YouTubePlaylist>;
                nextLibrary.playlists = (data.items || [])
                    .filter((item) => item.id)
                    .map((item) => ({
                        id: `yt-playlist-${item.id}`,
                        kind: "playlist",
                        playlistId: item.id as string,
                        title: item.snippet?.title || "Playlist",
                        artist: item.snippet?.channelTitle || "YouTube",
                        image: pickThumb(item.snippet?.thumbnails),
                        trackCount: Number(item.contentDetails?.itemCount || 0),
                    }));
                nextTokens.playlists = data.nextPageToken || null;
            }

            if (likesResponse?.ok) {
                const data = (await likesResponse.json()) as YouTubePagedResponse<YouTubePlaylistItem>;
                const raw = data.items || [];
                const ids = raw
                    .map((item) => item.contentDetails?.videoId || item.snippet?.resourceId?.videoId)
                    .filter((value): value is string => Boolean(value));
                const durationById = await fetchDurationsByVideoId(ids, true);
                nextLibrary.likes = raw
                    .map((item) => {
                        const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
                        if (!videoId) return null;
                        const duration = durationById.get(videoId) || 0;
                        return {
                            kind: "track",
                            id: `yt-${videoId}`,
                            videoId,
                            uri: toWatchUrl(videoId),
                            title: item.snippet?.title || "Like",
                            artist: item.snippet?.channelTitle || "YouTube",
                            image: pickThumb(item.snippet?.thumbnails),
                            durationMs: duration,
                            duration: formatMs(duration),
                        } satisfies YouTubeLibraryTrackItem;
                    })
                    .filter((item): item is YouTubeLibraryTrackItem => Boolean(item));
                nextTokens.likes = data.nextPageToken || null;
            }

            if (watchLaterResponse?.ok) {
                const data = (await watchLaterResponse.json()) as YouTubePagedResponse<YouTubePlaylistItem>;
                const raw = data.items || [];
                const ids = raw
                    .map((item) => item.contentDetails?.videoId || item.snippet?.resourceId?.videoId)
                    .filter((value): value is string => Boolean(value));
                const durationById = await fetchDurationsByVideoId(ids, true);
                nextLibrary.watchLater = raw
                    .map((item) => {
                        const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
                        if (!videoId) return null;
                        const duration = durationById.get(videoId) || 0;
                        return {
                            kind: "track",
                            id: `yt-${videoId}`,
                            videoId,
                            uri: toWatchUrl(videoId),
                            title: item.snippet?.title || "Watch Later",
                            artist: item.snippet?.channelTitle || "YouTube",
                            image: pickThumb(item.snippet?.thumbnails),
                            durationMs: duration,
                            duration: formatMs(duration),
                        } satisfies YouTubeLibraryTrackItem;
                    })
                    .filter((item): item is YouTubeLibraryTrackItem => Boolean(item));
                nextTokens.watchLater = data.nextPageToken || null;
            }

            setLibraryBySection(nextLibrary);
            setLibraryNextBySection(nextTokens);
            setStatusText("Biblioteca de YouTube cargada.");
        } finally {
            setLibraryLoading(false);
        }
    }, [fetchDurationsByVideoId, youtubeApiGet]);

    const loadMoreLibrarySection = useCallback(
        async (section: YouTubeLibrarySection) => {
            const token = libraryNextBySection[section];
            if (!token || libraryLoadingMoreBySection[section] || !accessTokenRef.current) return;
            setLibraryLoadingMoreBySection((prev) => ({ ...prev, [section]: true }));
            try {
                if (section === "playlists") {
                    const response = await youtubeApiGet(
                        "/playlists",
                        { part: "snippet,contentDetails", mine: "true", maxResults: 20, pageToken: token },
                        { auth: true, includeApiKey: false, silent: true }
                    );
                    if (!response.ok) return;
                    const data = (await response.json()) as YouTubePagedResponse<YouTubePlaylist>;
                    const mapped = (data.items || [])
                        .filter((item) => item.id)
                        .map((item) => ({
                            id: `yt-playlist-${item.id}`,
                            kind: "playlist",
                            playlistId: item.id as string,
                            title: item.snippet?.title || "Playlist",
                            artist: item.snippet?.channelTitle || "YouTube",
                            image: pickThumb(item.snippet?.thumbnails),
                            trackCount: Number(item.contentDetails?.itemCount || 0),
                        })) satisfies YouTubeLibraryItem[];
                    setLibraryBySection((prev) => ({ ...prev, playlists: [...prev.playlists, ...mapped] }));
                    setLibraryNextBySection((prev) => ({ ...prev, playlists: data.nextPageToken || null }));
                    return;
                }

                const targetPlaylistId =
                    section === "likes" ? likesPlaylistIdRef.current : watchLaterPlaylistIdRef.current;
                if (!targetPlaylistId) return;
                const response = await youtubeApiGet(
                    "/playlistItems",
                    { part: "snippet,contentDetails", playlistId: targetPlaylistId, maxResults: 20, pageToken: token },
                    { auth: true, includeApiKey: false, silent: true }
                );
                if (!response.ok) return;
                const data = (await response.json()) as YouTubePagedResponse<YouTubePlaylistItem>;
                const raw = data.items || [];
                const ids = raw
                    .map((item) => item.contentDetails?.videoId || item.snippet?.resourceId?.videoId)
                    .filter((value): value is string => Boolean(value));
                const durationById = await fetchDurationsByVideoId(ids, true);
                const mapped = raw
                    .map((item) => {
                        const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
                        if (!videoId) return null;
                        const duration = durationById.get(videoId) || 0;
                        return {
                            kind: "track",
                            id: `yt-${videoId}`,
                            videoId,
                            uri: toWatchUrl(videoId),
                            title: item.snippet?.title || (section === "likes" ? "Like" : "Watch Later"),
                            artist: item.snippet?.channelTitle || "YouTube",
                            image: pickThumb(item.snippet?.thumbnails),
                            durationMs: duration,
                            duration: formatMs(duration),
                        } satisfies YouTubeLibraryTrackItem;
                    })
                    .filter((item): item is YouTubeLibraryTrackItem => Boolean(item));
                if (section === "likes") {
                    setLibraryBySection((prev) => ({ ...prev, likes: [...prev.likes, ...mapped] }));
                    setLibraryNextBySection((prev) => ({ ...prev, likes: data.nextPageToken || null }));
                } else {
                    setLibraryBySection((prev) => ({ ...prev, watchLater: [...prev.watchLater, ...mapped] }));
                    setLibraryNextBySection((prev) => ({ ...prev, watchLater: data.nextPageToken || null }));
                }
            } finally {
                setLibraryLoadingMoreBySection((prev) => ({ ...prev, [section]: false }));
            }
        },
        [fetchDurationsByVideoId, libraryLoadingMoreBySection, libraryNextBySection, youtubeApiGet]
    );

    useEffect(() => {
        let mounted = true;
        void ensureGoogleIdentity()
            .then(() => {
                if (!mounted || !GOOGLE_CLIENT_ID || !window.google?.accounts?.oauth2) return;
                tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
                    client_id: GOOGLE_CLIENT_ID,
                    scope: YOUTUBE_SCOPE,
                    callback: () => undefined,
                    error_callback: (error) => {
                        console.error(error);
                        setIsAuthLoading(false);
                    },
                });
            })
            .catch((error) => {
                console.error(error);
            });
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        const token = localStorage.getItem(STORAGE.ACCESS_TOKEN);
        const expiresAt = Number(localStorage.getItem(STORAGE.EXPIRES_AT) || 0);
        const storedName = localStorage.getItem(STORAGE.ACCOUNT_NAME) || "";
        if (!token || !expiresAt || Date.now() >= expiresAt) {
            clearAuth();
            return;
        }
        setAccessToken(token);
        setTokenExpiresAt(expiresAt);
        if (storedName) setAccountName(storedName);
    }, [clearAuth]);

    useEffect(() => {
        if (!accessToken || fetchedLibraryRef.current) return;
        void fetchLibrary();
    }, [accessToken, fetchLibrary]);

    useEffect(() => {
        let mounted = true;
        void ensureYoutubeApi()
            .then(() => {
                if (!mounted) return;
                setApiReady(true);
            })
            .catch((error) => {
                console.error(error);
                if (!mounted) return;
                setStatusText("No se pudo cargar el player de YouTube.");
            });
        return () => {
            mounted = false;
        };
    }, []);

    const playTrack = useCallback(
        (track: YouTubeTrack) => {
            const player = playerRef.current;
            setCurrentTrack(mapCurrentTrack(track));
            setStatusText(`Cargando ${track.title}...`);
            if (!playerReady || !player) {
                pendingTrackRef.current = track;
                return;
            }
            player.loadVideoById(track.videoId);
            window.setTimeout(() => {
                try {
                    player.playVideo();
                } catch {
                    // ignore
                }
            }, 120);
        },
        [playerReady]
    );

    const pushRecent = useCallback((track: YouTubeTrack) => {
        setRecentQueue((prev) => {
            const next = [track, ...prev.filter((entry) => entry.videoId !== track.videoId)];
            return next.slice(0, 20);
        });
    }, []);

    const playQueueIndex = useCallback(
        (index: number) => {
            const target = queueRef.current[index];
            if (!target) return;
            setQueueIndex(index);
            playTrack(target);
            pushRecent(target);
        },
        [playTrack, pushRecent]
    );

    const handleTrackEnd = useCallback(() => {
        const tracks = queueRef.current;
        if (!tracks.length) return;
        const currentIndex = Math.max(0, queueIndexRef.current);
        if (repeatModeRef.current === 2) {
            playQueueIndex(currentIndex);
            return;
        }
        if (shuffleModeRef.current === "smart") {
            const seedTrack = tracks[currentIndex];
            void (async () => {
                if (seedTrack && canSearch()) {
                    const query = `${seedTrack.artist} music`;
                    const useAuth = Boolean(accessTokenRef.current);
                    const resp = await youtubeApiGet(
                        "/search",
                        { part: "snippet", type: "video", videoEmbeddable: "true", videoCategoryId: "10", maxResults: 10, q: query },
                        { auth: useAuth, includeApiKey: !useAuth, silent: true }
                    );
                    if (resp.ok) {
                        const data = (await resp.json()) as YouTubePagedResponse<YouTubeSearchResult>;
                        const mapped = await mapSearchResults(data.items || [], useAuth);
                        const knownIds = new Set(queueRef.current.map((t) => t.videoId));
                        const pick = mapped.find((r) => !knownIds.has(r.videoId));
                        if (pick) {
                            const insertAt = currentIndex + 1;
                            setQueueTracks((prev) => {
                                const next = [...prev];
                                next.splice(insertAt, 0, pick);
                                return next;
                            });
                            window.setTimeout(() => playQueueIndex(insertAt), 50);
                            return;
                        }
                    }
                }
                if (tracks.length > 1) playQueueIndex(Math.floor(Math.random() * tracks.length));
            })();
            return;
        }
        if (shuffleModeRef.current === "shuffle" && tracks.length > 1) {
            playQueueIndex(Math.floor(Math.random() * tracks.length));
            return;
        }
        const nextIndex = currentIndex + 1;
        if (nextIndex < tracks.length) {
            playQueueIndex(nextIndex);
            return;
        }
        if (repeatModeRef.current === 1) {
            playQueueIndex(0);
            return;
        }
        setIsPlaying(false);
        setStatusText("Reproducción finalizada.");
    }, [playQueueIndex, canSearch, youtubeApiGet, mapSearchResults]);

    useEffect(() => {
        if (!apiReady || !window.YT?.Player || !playerHostEl || playerRef.current) return;
        const player = new window.YT.Player(playerHostEl, {
            width: "0",
            height: "0",
            videoId: DEFAULT_VIDEO_ID,
            playerVars: {
                autoplay: 0,
                controls: 0,
                rel: 0,
                modestbranding: 1,
                playsinline: 1,
                origin: window.location.origin,
            },
            events: {
                onReady: () => {
                    setPlayerReady(true);
                    player.setVolume(Math.round(volume * 100));
                    setStatusText("YouTube player listo.");
                    if (pendingTrackRef.current) {
                        const pending = pendingTrackRef.current;
                        pendingTrackRef.current = null;
                        playTrack(pending);
                    }
                },
                onStateChange: (event) => {
                    if (event.data === window.YT.PlayerState.PLAYING) {
                        setIsPlaying(true);
                        setStatusText("Reproduciendo en YouTube.");
                    } else if (event.data === window.YT.PlayerState.PAUSED) {
                        setIsPlaying(false);
                        setStatusText("Pausado.");
                    } else if (event.data === window.YT.PlayerState.ENDED) {
                        setIsPlaying(false);
                        void handleTrackEnd();
                    } else if (event.data === window.YT.PlayerState.BUFFERING) {
                        setStatusText("Buffering...");
                    }
                },
                onError: () => {
                    setIsPlaying(false);
                    setStatusText("No se pudo reproducir ese video.");
                },
            },
        });
        playerRef.current = player;
        return () => {
            player.destroy();
            if (playerRef.current === player) playerRef.current = null;
        };
    }, [apiReady, playerHostEl, handleTrackEnd, playTrack, volume]);

    useEffect(() => {
        if (!playerReady || !playerRef.current) return;
        const interval = setInterval(() => {
            const player = playerRef.current;
            if (!player) return;
            setDurationMs(Math.max(0, Math.floor(Number(player.getDuration?.() || 0) * 1000)));
            setPositionMs(Math.max(0, Math.floor(Number(player.getCurrentTime?.() || 0) * 1000)));
        }, 500);
        return () => clearInterval(interval);
    }, [playerReady]);

    useEffect(() => {
        const player = playerRef.current;
        if (!player || !playerReady) return;
        if (!showVideo) {
            player.setSize(1, 1);
        } else if (pipMode) {
            player.setSize(288, 162);
        } else {
            // Fill the image slot (square container ~240-272px depending on breakpoint)
            player.setSize(272, 272);
        }
    }, [showVideo, pipMode, playerReady]);

    const startLogin = useCallback(() => {
        if (!GOOGLE_CLIENT_ID) {
            toast({
                variant: "destructive",
                title: "Config faltante",
                description: "Define VITE_GOOGLE_CLIENT_ID en tu .env.",
            });
            return;
        }
        const client = tokenClientRef.current;
        if (!client) {
            toast({
                variant: "destructive",
                title: "Google no listo",
                description: "Espera un segundo e intenta de nuevo.",
            });
            return;
        }
        setIsAuthLoading(true);
        client.callback = (response) => {
            if (response.error || !response.access_token) {
                setIsAuthLoading(false);
                toast({
                    variant: "destructive",
                    title: "Google no autorizado",
                    description: "No se pudo completar la conexión con YouTube.",
                });
                return;
            }
            const expiresAt = Date.now() + Math.max(60, Number(response.expires_in || 3600)) * 1000;
            setAccessToken(response.access_token);
            setTokenExpiresAt(expiresAt);
            localStorage.setItem(STORAGE.ACCESS_TOKEN, response.access_token);
            localStorage.setItem(STORAGE.EXPIRES_AT, String(expiresAt));
            fetchedLibraryRef.current = false;
            void fetchLibrary().finally(() => {
                setIsAuthLoading(false);
            });
        };
        client.requestAccessToken({ prompt: accessTokenRef.current ? "" : "consent" });
    }, [fetchLibrary]);

    const logout = useCallback(() => {
        clearAuth();
        setStatusText("Cuenta de YouTube desconectada.");
    }, [clearAuth]);

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
            setSearchLoading(true);
            try {
                const tracks = await fetchSearch(q);
                setSearchResults(tracks);
            } finally {
                setSearchLoading(false);
            }
        },
        [fetchSearch]
    );

    const playSearchTrack = useCallback(
        (track: YouTubeTrack) => {
            setQueueTracks((prev) => {
                const found = prev.findIndex((item) => item.videoId === track.videoId);
                const next = found >= 0 ? prev : [track, ...prev];
                setQueueIndex(found >= 0 ? found : 0);
                return next;
            });
            playTrack(track);
            pushRecent(track);
        },
        [playTrack, pushRecent]
    );

    const searchAndPlay = useCallback(
        async (query: string) => {
            const q = query.trim();
            if (!q) return;
            setSearchLoading(true);
            try {
                const tracks = await fetchSearch(q);
                setSearchResults(tracks);
                const first = tracks[0];
                if (!first) {
                    toast({ title: "Sin resultados", description: "No se encontraron tracks en YouTube." });
                    return;
                }
                setQueueTracks(tracks);
                setQueueIndex(0);
                playTrack(first);
                pushRecent(first);
            } finally {
                setSearchLoading(false);
            }
        },
        [fetchSearch, playTrack, pushRecent]
    );

    const playLibraryItem = useCallback(
        async (item: YouTubeLibraryItem) => {
            if (item.kind === "track") {
                playSearchTrack(item);
                return;
            }
            setStatusText(`Cargando playlist ${item.title}...`);
            const tracks = await fetchPlaylistTracks(item.playlistId);
            if (!tracks.length) {
                toast({ title: "Playlist vacia", description: "No se encontraron videos reproducibles." });
                return;
            }
            setQueueTracks(tracks);
            setQueueIndex(0);
            playTrack(tracks[0]);
            pushRecent(tracks[0]);
        },
        [fetchPlaylistTracks, playSearchTrack, playTrack, pushRecent]
    );

    const togglePlayPause = useCallback(() => {
        const player = playerRef.current;
        if (!player) return;
        if (player.getPlayerState() === window.YT.PlayerState.PLAYING) {
            player.pauseVideo();
        } else {
            player.playVideo();
        }
    }, []);

    const nextTrack = useCallback(() => {
        const tracks = queueRef.current;
        if (!tracks.length) return;
        if (shuffleModeRef.current !== "off" && tracks.length > 1) {
            playQueueIndex(Math.floor(Math.random() * tracks.length));
            return;
        }
        const candidate = queueIndexRef.current + 1;
        if (candidate < tracks.length) {
            playQueueIndex(candidate);
            return;
        }
        if (repeatMode > 0) playQueueIndex(0);
    }, [playQueueIndex, repeatMode]);

    const prevTrack = useCallback(() => {
        const tracks = queueRef.current;
        if (!tracks.length) return;
        const candidate = queueIndexRef.current - 1;
        if (candidate >= 0) {
            playQueueIndex(candidate);
            return;
        }
        if (repeatMode > 0) playQueueIndex(tracks.length - 1);
    }, [playQueueIndex, repeatMode]);

    const cycleShuffle = useCallback(() => {
        setShuffleMode((prev) => {
            const next: "off" | "shuffle" | "smart" = prev === "off" ? "shuffle" : prev === "shuffle" ? "smart" : "off";
            shuffleModeRef.current = next;
            return next;
        });
    }, []);
    const cycleRepeat = useCallback(() => setRepeatMode((prev) => ((prev + 1) % 3) as 0 | 1 | 2), []);

    const seekToProgress = useCallback(
        (value: number) => {
            const player = playerRef.current;
            if (!player || !durationMs) return;
            const targetSec = ((Math.max(0, Math.min(100, value)) / 100) * durationMs) / 1000;
            player.seekTo(targetSec, true);
            setPositionMs(Math.floor(targetSec * 1000));
        },
        [durationMs]
    );

    const setVolumeLevel = useCallback((value: number) => {
        const player = playerRef.current;
        const next = Math.max(0, Math.min(1, value));
        setVolume(next);
        localStorage.setItem(VOLUME_STORAGE_KEY, String(next));
        if (player) player.setVolume(Math.round(next * 100));
    }, []);

    const shareCurrent = useCallback(async () => {
        const target = currentTrack?.externalUrl || toWatchUrl(DEFAULT_VIDEO_ID);
        await navigator.clipboard.writeText(target);
        toast({ title: "Enlace copiado", description: "YouTube URL copiada al portapapeles." });
    }, [currentTrack?.externalUrl]);

    const playQueueTrack = useCallback(
        (trackId: string) => {
            const index = queueRef.current.findIndex((item) => item.id === trackId);
            if (index < 0) return;
            playQueueIndex(index);
        },
        [playQueueIndex]
    );

    const addToQueue = useCallback((track: YouTubeTrack) => {
        setQueueTracks((prev) => (prev.some((item) => item.videoId === track.videoId) ? prev : [...prev, track]));
    }, []);

    const refreshQueue = useCallback(() => setQueueTracks((prev) => [...prev]), []);

    const toggleVideoMode = useCallback(() => {
        setShowVideo((prev) => {
            if (prev) setPipMode(false);
            return !prev;
        });
    }, []);

    const togglePipMode = useCallback(() => {
        setPipMode((prev) => !prev);
    }, []);

    const reset = useCallback(() => {
        playerRef.current?.pauseVideo();
        setIsPlaying(false);
        setStatusText("Modo YouTube cerrado.");
    }, []);

    const progress = useMemo(() => {
        if (!durationMs) return 0;
        return Math.max(0, Math.min(100, (positionMs / durationMs) * 100));
    }, [durationMs, positionMs]);

    return {
        playerHostRef,
        isReady: playerReady,
        statusText,
        sessionCountdown: tokenExpiresAt ? formatCountdown(tokenExpiresAt) : "-",
        currentTrack,
        queue: queueTracks.map(mapQueueTrack),
        searchResults,
        searchLoading,
        recentQueue,
        isPlaying,
        shuffleMode,
        repeatMode,
        volume,
        durationMs,
        progress,
        currentTime: formatMs(positionMs),
        totalTime: formatMs(durationMs),
        comments,
        commentsLoading,
        showVideo,
        pipMode,
        toggleVideoMode,
        togglePipMode,
        isAuthenticated: Boolean(accessToken),
        isAuthLoading,
        accountName,
        libraryBySection,
        libraryNextBySection,
        libraryLoading,
        libraryLoadingMoreBySection,
        startLogin,
        logout,
        fetchLibrary,
        loadMoreLibrarySection,
        playLibraryItem,
        clearSearchResults,
        searchCatalog,
        searchAndPlay,
        playSearchTrack,
        addToQueue,
        togglePlayPause,
        nextTrack,
        prevTrack,
        cycleShuffle,
        cycleRepeat,
        seekToProgress,
        setVolumeLevel,
        shareCurrent,
        playQueueTrack,
        refreshQueue,
        reset,
    };
};

export default useYoutubePlayer;
