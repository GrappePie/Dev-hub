import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { clamp01, formatMs, toProgressPercent } from "@/lib/format";
import { loadGoogleIdentity, loadYouTubeIframeApi } from "@/lib/sdk";
import { getNextShuffleMode } from "@/lib/shuffleMode";
import {
    DEFAULT_VIDEO_ID,
    GOOGLE_CLIENT_ID,
    YOUTUBE_API_BASE,
    YOUTUBE_API_KEY,
    YOUTUBE_MUSIC_CATEGORY_ID,
    YOUTUBE_SCOPE,
} from "@/lib/youtube/config";
import {
    collectVideoIds,
    getPlaylistItemVideoId,
    getSearchResultVideoId,
    mapCommentThreads,
    mapCurrentTrack,
    mapPlaylists,
    mapQueueTrack,
    mapVideoTracks,
    parseIsoDuration,
    toLibraryTrackItems,
    toWatchUrl,
} from "@/lib/youtube/mappers";
import { youtubeAccountNameStore, youtubeTokenStore, youtubeVolumeStore } from "@/lib/youtube/storage";
import type {
    YouTubeChannel,
    YouTubeComment,
    YouTubeCommentThreadItem,
    YouTubeLibraryItem,
    YouTubeLibrarySection,
    YouTubePagedResponse,
    YouTubePlaylist,
    YouTubePlaylistItem,
    YouTubeSearchResult,
    YouTubeSnippet,
    YouTubeTrack,
    YouTubeVideoDetails,
} from "@/lib/youtube/types";
import type { CurrentTrack } from "@/types/player";

export type { YouTubeComment, YouTubeLibraryItem, YouTubeLibrarySection };

type YouTubeLibraryBySection = Record<YouTubeLibrarySection, YouTubeLibraryItem[]>;
type YouTubeLibraryNextBySection = Record<YouTubeLibrarySection, string | null>;
type YouTubeLibraryLoadingBySection = Record<YouTubeLibrarySection, boolean>;
type YouTubeTrackSection = Exclude<YouTubeLibrarySection, "playlists">;

const EMPTY_LIBRARY: YouTubeLibraryBySection = { playlists: [], likes: [], watchLater: [] };
const EMPTY_LIBRARY_NEXT: YouTubeLibraryNextBySection = { playlists: null, likes: null, watchLater: null };
const EMPTY_LIBRARY_LOADING: YouTubeLibraryLoadingBySection = { playlists: false, likes: false, watchLater: false };

const FALLBACK_TRACK_TITLE = "YouTube Track";
const LIBRARY_TRACK_FALLBACK_TITLE: Record<YouTubeTrackSection, string> = { likes: "Like", watchLater: "Watch Later" };

export const useYoutubePlayer = () => {
    const [playerHostEl, setPlayerHostEl] = useState<HTMLDivElement | null>(null);
    const playerHostRef = useCallback((node: HTMLDivElement | null) => {
        setPlayerHostEl(node);
        if (!node) setPlayerReady(false);
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
    const [volume, setVolume] = useState(youtubeVolumeStore.read);
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

    const volumeRef = useRef(volume);
    useEffect(() => {
        volumeRef.current = volume;
    }, [volume]);

    const clearAuth = useCallback(() => {
        setAccessToken(null);
        setTokenExpiresAt(null);
        setAccountName("");
        setLibraryBySection(EMPTY_LIBRARY);
        setLibraryNextBySection(EMPTY_LIBRARY_NEXT);
        setLibraryLoading(false);
        setLibraryLoadingMoreBySection(EMPTY_LIBRARY_LOADING);
        youtubeTokenStore.clear();
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

    /** Search and playlist endpoints omit durations, so they are fetched in one extra request before mapping. */
    const resolveVideoTracks = useCallback(
        async <T extends { snippet?: YouTubeSnippet }>(
            items: T[],
            getVideoId: (item: T) => string | undefined,
            useAuth: boolean,
            fallbackTitle: string
        ) => {
            const durationById = await fetchDurationsByVideoId(collectVideoIds(items, getVideoId), useAuth);
            return mapVideoTracks(items, getVideoId, durationById, fallbackTitle);
        },
        [fetchDurationsByVideoId]
    );

    const searchVideos = useCallback(
        async (q: string, maxResults: number) => {
            const useAuth = Boolean(accessTokenRef.current);
            const response = await youtubeApiGet(
                "/search",
                {
                    part: "snippet",
                    type: "video",
                    videoEmbeddable: "true",
                    videoCategoryId: YOUTUBE_MUSIC_CATEGORY_ID,
                    maxResults,
                    q,
                },
                { auth: useAuth, includeApiKey: !useAuth, silent: true }
            );
            if (!response.ok) return [];
            const data = (await response.json()) as YouTubePagedResponse<YouTubeSearchResult>;
            return resolveVideoTracks(data.items || [], getSearchResultVideoId, useAuth, FALLBACK_TRACK_TITLE);
        },
        [resolveVideoTracks, youtubeApiGet]
    );

    const fetchSearch = useCallback(
        async (query: string) => {
            if (!canSearch()) return [];
            const q = query.trim();
            if (!q) return [];
            return searchVideos(q, 20);
        },
        [canSearch, searchVideos]
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
            setComments(mapCommentThreads(data.items || []));
        },
        [youtubeApiGet]
    );

    useEffect(() => {
        if (!currentTrack?.id) { setComments([]); return; }
        const videoId = currentTrack.id.startsWith("yt-") ? currentTrack.id.slice(3) : currentTrack.id;
        void fetchComments(videoId);
    }, [currentTrack?.id, fetchComments]);

    const requestPlaylistItems = useCallback(
        (
            playlistId: string,
            { maxResults = 20, useAuth = true, pageToken }: { maxResults?: number; useAuth?: boolean; pageToken?: string } = {}
        ) =>
            youtubeApiGet(
                "/playlistItems",
                { part: "snippet,contentDetails", playlistId, maxResults, ...(pageToken ? { pageToken } : {}) },
                { auth: useAuth, includeApiKey: !useAuth, silent: true }
            ),
        [youtubeApiGet]
    );

    const requestMyPlaylists = useCallback(
        (pageToken?: string) =>
            youtubeApiGet(
                "/playlists",
                { part: "snippet,contentDetails", mine: "true", maxResults: 20, ...(pageToken ? { pageToken } : {}) },
                { auth: true, includeApiKey: false, silent: true }
            ),
        [youtubeApiGet]
    );

    const readLibraryTrackPage = useCallback(
        async (response: Response, section: YouTubeTrackSection) => {
            const data = (await response.json()) as YouTubePagedResponse<YouTubePlaylistItem>;
            const tracks = await resolveVideoTracks(
                data.items || [],
                getPlaylistItemVideoId,
                true,
                LIBRARY_TRACK_FALLBACK_TITLE[section]
            );
            return { items: toLibraryTrackItems(tracks), nextPageToken: data.nextPageToken || null };
        },
        [resolveVideoTracks]
    );

    const fetchPlaylistTracks = useCallback(
        async (playlistId: string) => {
            const useAuth = Boolean(accessTokenRef.current);
            const response = await requestPlaylistItems(playlistId, { maxResults: 50, useAuth });
            if (!response.ok) return [];
            const data = (await response.json()) as YouTubePagedResponse<YouTubePlaylistItem>;
            return resolveVideoTracks(data.items || [], getPlaylistItemVideoId, useAuth, FALLBACK_TRACK_TITLE);
        },
        [requestPlaylistItems, resolveVideoTracks]
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
            const meData = (await meResponse.json()) as YouTubePagedResponse<YouTubeChannel>;
            const me = meData.items?.[0];
            const displayName = me?.snippet?.title || "";
            setAccountName(displayName);
            if (displayName) {
                youtubeAccountNameStore.save(displayName);
            }
            likesPlaylistIdRef.current = me?.contentDetails?.relatedPlaylists?.likes || null;
            watchLaterPlaylistIdRef.current = me?.contentDetails?.relatedPlaylists?.watchLater || null;

            const [playlistsResponse, likesResponse, watchLaterResponse] = await Promise.all([
                requestMyPlaylists(),
                likesPlaylistIdRef.current ? requestPlaylistItems(likesPlaylistIdRef.current) : Promise.resolve(null),
                watchLaterPlaylistIdRef.current
                    ? requestPlaylistItems(watchLaterPlaylistIdRef.current)
                    : Promise.resolve(null),
            ]);

            const nextLibrary: YouTubeLibraryBySection = { ...EMPTY_LIBRARY };
            const nextTokens: YouTubeLibraryNextBySection = { ...EMPTY_LIBRARY_NEXT };

            if (playlistsResponse.ok) {
                const data = (await playlistsResponse.json()) as YouTubePagedResponse<YouTubePlaylist>;
                nextLibrary.playlists = mapPlaylists(data.items || []);
                nextTokens.playlists = data.nextPageToken || null;
            }

            if (likesResponse?.ok) {
                const page = await readLibraryTrackPage(likesResponse, "likes");
                nextLibrary.likes = page.items;
                nextTokens.likes = page.nextPageToken;
            }

            if (watchLaterResponse?.ok) {
                const page = await readLibraryTrackPage(watchLaterResponse, "watchLater");
                nextLibrary.watchLater = page.items;
                nextTokens.watchLater = page.nextPageToken;
            }

            setLibraryBySection(nextLibrary);
            setLibraryNextBySection(nextTokens);
            setStatusText("Biblioteca de YouTube cargada.");
        } finally {
            setLibraryLoading(false);
        }
    }, [readLibraryTrackPage, requestMyPlaylists, requestPlaylistItems, youtubeApiGet]);

    const loadMoreLibrarySection = useCallback(
        async (section: YouTubeLibrarySection) => {
            const token = libraryNextBySection[section];
            if (!token || libraryLoadingMoreBySection[section] || !accessTokenRef.current) return;
            setLibraryLoadingMoreBySection((prev) => ({ ...prev, [section]: true }));
            try {
                if (section === "playlists") {
                    const response = await requestMyPlaylists(token);
                    if (!response.ok) return;
                    const data = (await response.json()) as YouTubePagedResponse<YouTubePlaylist>;
                    const mapped = mapPlaylists(data.items || []);
                    setLibraryBySection((prev) => ({ ...prev, playlists: [...prev.playlists, ...mapped] }));
                    setLibraryNextBySection((prev) => ({ ...prev, playlists: data.nextPageToken || null }));
                    return;
                }

                const targetPlaylistId =
                    section === "likes" ? likesPlaylistIdRef.current : watchLaterPlaylistIdRef.current;
                if (!targetPlaylistId) return;
                const response = await requestPlaylistItems(targetPlaylistId, { pageToken: token });
                if (!response.ok) return;
                const page = await readLibraryTrackPage(response, section);
                setLibraryBySection((prev) => ({ ...prev, [section]: [...prev[section], ...page.items] }));
                setLibraryNextBySection((prev) => ({ ...prev, [section]: page.nextPageToken }));
            } finally {
                setLibraryLoadingMoreBySection((prev) => ({ ...prev, [section]: false }));
            }
        },
        [libraryLoadingMoreBySection, libraryNextBySection, readLibraryTrackPage, requestMyPlaylists, requestPlaylistItems]
    );

    useEffect(() => {
        let mounted = true;
        void loadGoogleIdentity()
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
        const { accessToken: token, expiresAt } = youtubeTokenStore.read();
        const storedName = youtubeAccountNameStore.read();
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
        void loadYouTubeIframeApi()
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
                    const mapped = await searchVideos(`${seedTrack.artist} music`, 10);
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
    }, [playQueueIndex, canSearch, searchVideos]);

    const handleTrackEndRef = useRef(handleTrackEnd);
    useEffect(() => {
        handleTrackEndRef.current = handleTrackEnd;
    }, [handleTrackEnd]);

    // The player is created once per host element; volume and callbacks are read through refs
    // so changing them never destroys the iframe (which would stop playback).
    useEffect(() => {
        if (!apiReady || !window.YT?.Player || !playerHostEl || playerRef.current) return;
        const { PlayerState } = window.YT;
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
                    player.setVolume(Math.round(volumeRef.current * 100));
                    setStatusText("YouTube player listo.");
                },
                onStateChange: (event) => {
                    if (event.data === PlayerState.PLAYING) {
                        setIsPlaying(true);
                        setStatusText("Reproduciendo en YouTube.");
                    } else if (event.data === PlayerState.PAUSED) {
                        setIsPlaying(false);
                        setStatusText("Pausado.");
                    } else if (event.data === PlayerState.ENDED) {
                        setIsPlaying(false);
                        handleTrackEndRef.current();
                    } else if (event.data === PlayerState.BUFFERING) {
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
    }, [apiReady, playerHostEl]);

    // Plays a track requested before the player finished loading.
    useEffect(() => {
        const pending = pendingTrackRef.current;
        if (!playerReady || !pending) return;
        pendingTrackRef.current = null;
        playTrack(pending);
    }, [playerReady, playTrack]);

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
            youtubeTokenStore.save({ accessToken: response.access_token, expiresAt });
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
        if (player.getPlayerState() === window.YT?.PlayerState.PLAYING) {
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
            const next = getNextShuffleMode(prev);
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
        const next = clamp01(value);
        setVolume(next);
        youtubeVolumeStore.write(next);
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

    const progress = useMemo(() => toProgressPercent(positionMs, durationMs), [durationMs, positionMs]);

    return {
        playerHostRef,
        isReady: playerReady,
        statusText,
        sessionCountdown: tokenExpiresAt ? formatMs(tokenExpiresAt - Date.now()) : "-",
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
