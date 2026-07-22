import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Header from "@/components/Header";
import LoginScreen from "@/components/LoginScreen";
import PlayerScreen from "@/components/PlayerScreen";
import SoundcloudScreen from "@/components/SoundcloudScreen";
import YoutubeMusicScreen from "@/components/YoutubeMusicScreen";
import FileaScreen from "@/components/FileaScreen";
import PixelTransition from "@/components/PixelTransition";
import ReactiveBackground, { type ReactiveBackgroundVariant } from "@/components/ReactiveBackground";
import useSpotifyPlayer from "@/hooks/useSpotifyPlayer";
import useSoundcloudPlayer from "@/hooks/useSoundcloudPlayer";
import useYoutubePlayer from "@/hooks/useYoutubePlayer";
import type { YouTubeLibrarySection } from "@/hooks/useYoutubePlayer";
import type { SoundcloudLibrarySection } from "@/hooks/useSoundcloudPlayer";
import { useAudioAnalyser } from "@/hooks/useAudioAnalyser";
import { useBpmDetector } from "@/hooks/useBpmDetector";
import CharacterSelectScreen, { type PlatformId } from "@/components/CharacterSelectScreen";
import { toast } from "@/hooks/use-toast";
import useRetroSfx from "@/hooks/useRetroSfx";
import { usePlatformTheme } from "@/hooks/usePlatformTheme";
import { usePlatformSearch } from "@/hooks/usePlatformSearch";
import { useYoutubeKeyboardShortcuts } from "@/hooks/useYoutubeKeyboardShortcuts";
import {
    getStoredPlatform,
    getStoredBackgroundVariant,
    PLATFORM_MESSAGE,
} from "@/lib/platformTheme";
import ArtistDialog from "@/components/ArtistDialog";
import type { ArtistData, ArtistTopTrack } from "@/hooks/useSpotifyPlayer";

const Index = () => {
    const spotify = useSpotifyPlayer();
    const soundcloud = useSoundcloudPlayer();
    const youtube = useYoutubePlayer();
    const sfx = useRetroSfx();
    const [oauthReturnDetected] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const state = params.get("state");
        return Boolean(code && (!state || state.startsWith("sp_")));
    });
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoggedIn, setIsLoggedIn] = useState(spotify.isAuthenticated);
    const [transitioning, setTransitioning] = useState(false);
    const [pendingState, setPendingState] = useState<boolean | null>(null);
    const [pendingCharacterState, setPendingCharacterState] = useState<boolean | null>(null);
    const [libraryOpen, setLibraryOpen] = useState(false);
    const [devicesOpen, setDevicesOpen] = useState(false);
    const [showCharacterSelect, setShowCharacterSelect] = useState(false);
    const [isCharacterVisible, setIsCharacterVisible] = useState(false);
    const [selectedPlatform, setSelectedPlatform] = useState<PlatformId>(() => getStoredPlatform());
    const [backgroundVariant, setBackgroundVariant] = useState<ReactiveBackgroundVariant>(() => getStoredBackgroundVariant());
    const [previewPlatform, setPreviewPlatform] = useState<PlatformId | null>(null);
    const [isAuthRedirecting, setIsAuthRedirecting] = useState(false);
    const [soundcloudMode, setSoundcloudMode] = useState(false);
    const [youtubeMode, setYoutubeMode] = useState(false);
    const [fileaMode, setFileaMode] = useState(false);
    const [pendingModeActivation, setPendingModeActivation] = useState<"soundcloud" | "youtube" | null>(null);
    const [pendingModeDeactivation, setPendingModeDeactivation] = useState<"soundcloud" | "youtube" | null>(null);
    const [soundcloudLibrarySection, setSoundcloudLibrarySection] = useState<SoundcloudLibrarySection>("playlists");
    const [youtubeLibrarySection, setYoutubeLibrarySection] = useState<YouTubeLibrarySection>("playlists");
    const [critterCommentsMode, setCritterCommentsMode] = useState(false);
    const [activeCritterComment, setActiveCritterComment] = useState<{ body: string; username: string } | null>(null);
    const critterCommentTimerRef = useRef<ReturnType<typeof setTimeout>>();

    const handleCritterCommentTrigger = useCallback((comment: { body: string; username: string }) => {
        if (critterCommentTimerRef.current) clearTimeout(critterCommentTimerRef.current);
        setActiveCritterComment(comment);
        critterCommentTimerRef.current = setTimeout(() => setActiveCritterComment(null), 4000);
    }, []);
    const [artistDialogOpen, setArtistDialogOpen] = useState(false);
    const [artistDialogData, setArtistDialogData] = useState<ArtistData | null>(null);
    const [artistDialogLoading, setArtistDialogLoading] = useState(false);
    const isSoundcloudMode = selectedPlatform === "soundcloud" && soundcloudMode;
    const isYouTubeMode = selectedPlatform === "youtube" && youtubeMode;
    const isFileaMode = selectedPlatform === "filea" && fileaMode;
    const isSessionActive = isLoggedIn || isSoundcloudMode || isYouTubeMode || isFileaMode;
    const showOAuthBridge = !isLoggedIn && oauthReturnDetected && spotify.isAuthLoading;
    const lastAuthFeedbackIdRef = useRef<number | null>(null);
    const youtubeVolumeBeforeMuteRef = useRef(0.5);

    const activePlatform = isLoggedIn ? "spotify" : isSoundcloudMode ? "soundcloud" : isYouTubeMode ? "youtube" : null;
    const { analyser, ytCaptureActive: captureActive, requestYouTubeCapture } = useAudioAnalyser(activePlatform);
    const analysisTrackId = activePlatform === "spotify"
        ? spotify.currentTrack?.id ?? null
        : activePlatform === "soundcloud"
            ? soundcloud.currentTrack?.id ?? null
            : activePlatform === "youtube"
                ? youtube.currentTrack?.id ?? null
                : null;
    const { bpm, confidence: bpmConfidence, beatRef } = useBpmDetector(analyser, analysisTrackId);

    useEffect(() => {
        if (showCharacterSelect || isCharacterVisible) {
            setPreviewPlatform(selectedPlatform);
            return;
        }
        setPreviewPlatform(null);
    }, [isCharacterVisible, selectedPlatform, showCharacterSelect]);

    useEffect(() => {
        if (isLoggedIn || showOAuthBridge) return;
        if (showCharacterSelect === isCharacterVisible) return;
        setPendingCharacterState(showCharacterSelect);
        setTransitioning(true);
    }, [isCharacterVisible, isLoggedIn, showCharacterSelect, showOAuthBridge]);

    usePlatformTheme({
        selectedPlatform,
        isSessionActive,
        isCharacterVisible,
        isAuthRedirecting,
        showOAuthBridge,
        previewPlatform,
        backgroundVariant,
    });

    useEffect(() => {
        if (spotify.isAuthenticated === isLoggedIn) return;
        setPendingState(spotify.isAuthenticated);
        setTransitioning(true);
    }, [isLoggedIn, spotify.isAuthenticated]);

    useEffect(() => {
        const feedback = spotify.authFeedback;
        if (!feedback) return;
        if (lastAuthFeedbackIdRef.current === feedback.id) return;
        lastAuthFeedbackIdRef.current = feedback.id;
        sfx(feedback.kind === "success" ? "success" : "fail");
    }, [sfx, spotify.authFeedback]);

    useEffect(() => {
        if (isLoggedIn) {
            setIsAuthRedirecting(false);
        }
    }, [isLoggedIn]);

    useEffect(() => {
        if (youtube.volume > 0.01) {
            youtubeVolumeBeforeMuteRef.current = youtube.volume;
        }
    }, [youtube.volume]);

    usePlatformSearch({
        searchQuery,
        isLoggedIn,
        isSoundcloudMode,
        isYouTubeMode,
        spotify,
        soundcloud,
        youtube,
    });

    useEffect(() => {
        if (isLoggedIn) return;
        setLibraryOpen(false);
        setDevicesOpen(false);
        setSearchQuery("");
    }, [isLoggedIn]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            setLibraryOpen(false);
            setDevicesOpen(false);
            setSearchQuery("");
            spotify.clearSearchResults();
            soundcloud.clearSearchResults();
            youtube.clearSearchResults();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [soundcloud.clearSearchResults, spotify.clearSearchResults, youtube.clearSearchResults]);

    useYoutubeKeyboardShortcuts(youtube, isYouTubeMode, youtubeVolumeBeforeMuteRef);

    const handleTransitionComplete = useCallback(() => {
        if (pendingState !== null) {
            setIsLoggedIn(pendingState);
            setPendingState(null);
        }
        if (pendingCharacterState !== null) {
            setIsCharacterVisible(pendingCharacterState);
            setPendingCharacterState(null);
        }
        if (pendingModeActivation === "soundcloud") {
            youtube.reset();
            setSoundcloudMode(true);
            setYoutubeMode(false);
            setLibraryOpen(false);
            setIsAuthRedirecting(false);
            setShowCharacterSelect(false);
            setSearchQuery("");
            toast({
                title: "Modo SoundCloud activado",
                description: "Carga un enlace y reproduce desde el widget.",
            });
            setPendingModeActivation(null);
            return;
        }
        if (pendingModeActivation === "youtube") {
            soundcloud.reset();
            setSoundcloudMode(false);
            setYoutubeMode(true);
            setLibraryOpen(false);
            setIsAuthRedirecting(false);
            setShowCharacterSelect(false);
            setSearchQuery("");
            toast({
                title: "Modo YouTube activado",
                description: "Busca tracks con el header y reproduce al instante.",
            });
            setPendingModeActivation(null);
            return;
        }
        if (pendingModeDeactivation === "soundcloud") {
            soundcloud.reset();
            setSoundcloudMode(false);
            setYoutubeMode(false);
            setLibraryOpen(false);
            setDevicesOpen(false);
            setSearchQuery("");
            setIsAuthRedirecting(false);
            setPendingModeDeactivation(null);
            return;
        }
        if (pendingModeDeactivation === "youtube") {
            youtube.reset();
            setYoutubeMode(false);
            setSoundcloudMode(false);
            setLibraryOpen(false);
            setDevicesOpen(false);
            setSearchQuery("");
            setIsAuthRedirecting(false);
            setPendingModeDeactivation(null);
        }
    }, [pendingCharacterState, pendingModeActivation, pendingModeDeactivation, pendingState, soundcloud.reset, youtube.reset]);

    const onLoginToggle = useCallback(() => {
        if (isFileaMode) {
            setFileaMode(false);
            setPendingModeActivation(null);
            setPendingModeDeactivation(null);
            setIsAuthRedirecting(false);
            setShowCharacterSelect(true);
            return;
        }
        if (isSoundcloudMode) {
            setPendingModeActivation(null);
            setPendingModeDeactivation("soundcloud");
            setShowCharacterSelect(true);
            return;
        }
        if (isYouTubeMode) {
            setPendingModeActivation(null);
            setPendingModeDeactivation("youtube");
            setShowCharacterSelect(true);
            return;
        }
        if (spotify.isAuthenticated) {
            setLibraryOpen(false);
            setDevicesOpen(false);
            setSearchQuery("");
            spotify.clearSearchResults();
            setSoundcloudMode(false);
            setYoutubeMode(false);
            setFileaMode(false);
            setPendingModeActivation(null);
            setPendingModeDeactivation(null);
            setIsAuthRedirecting(false);
            setShowCharacterSelect(true);
            spotify.logout();
            return;
        }
        setIsAuthRedirecting(false);
        setSoundcloudMode(false);
        setYoutubeMode(false);
        setFileaMode(false);
        setPendingModeActivation(null);
        setPendingModeDeactivation(null);
        setShowCharacterSelect(true);
    }, [isFileaMode, isSoundcloudMode, isYouTubeMode, spotify.clearSearchResults, spotify.isAuthenticated, spotify.logout]);

    const onPlatformSelect = useCallback(
        (platform: PlatformId) => {
            setSelectedPlatform(platform);
            setPreviewPlatform(platform);
            if (platform !== "spotify") {
                if (platform === "soundcloud") {
                    setPendingModeDeactivation(null);
                    setPendingModeActivation("soundcloud");
                    setFileaMode(false);
                    setShowCharacterSelect(false);
                    return;
                }
                if (platform === "youtube") {
                    setPendingModeDeactivation(null);
                    setPendingModeActivation("youtube");
                    setFileaMode(false);
                    setShowCharacterSelect(false);
                    return;
                }
                if (platform === "filea") {
                    sfx("coin");
                    setPendingModeActivation(null);
                    setPendingModeDeactivation(null);
                    soundcloud.reset();
                    youtube.reset();
                    setSoundcloudMode(false);
                    setYoutubeMode(false);
                    setFileaMode(true);
                    setIsAuthRedirecting(false);
                    setShowCharacterSelect(false);
                    toast({
                        title: "FILEA READY",
                        description: "La idol pixel esta activa en el selector.",
                    });
                    return;
                }
            }
            sfx("coin");
            setPendingModeActivation(null);
            setPendingModeDeactivation(null);
            soundcloud.reset();
            youtube.reset();
            setSoundcloudMode(false);
            setYoutubeMode(false);
            setFileaMode(false);
            setIsAuthRedirecting(true);
            setShowCharacterSelect(true);
            void spotify.startLogin().catch(() => {
                setIsAuthRedirecting(false);
                toast({
                    variant: "destructive",
                    title: "No se pudo abrir Spotify",
                    description: "Intenta de nuevo en unos segundos.",
                });
            });
        },
        [sfx, soundcloud.reset, spotify.startLogin, youtube.reset]
    );

    const onLibraryToggle = useCallback(() => {
        if (isSoundcloudMode) {
            const next = !libraryOpen;
            setLibraryOpen(next);
            setDevicesOpen(false);
            if (next && soundcloud.isAuthenticated) {
                void soundcloud.fetchLibrary();
            }
            return;
        }
        if (isYouTubeMode) {
            const next = !libraryOpen;
            setLibraryOpen(next);
            setDevicesOpen(false);
            if (next && youtube.isAuthenticated) {
                void youtube.fetchLibrary();
            }
            return;
        }
        setLibraryOpen((prev) => !prev);
        setDevicesOpen(false);
        void spotify.ensureLibraryLoaded();
    }, [isSoundcloudMode, isYouTubeMode, libraryOpen, soundcloud, spotify, youtube]);

    const onDevicesToggle = useCallback(() => {
        setDevicesOpen((prev) => !prev);
        setLibraryOpen(false);
        void spotify.fetchDevices();
    }, [spotify]);

    const onSearchSubmit = useCallback(() => {
        if (isSoundcloudMode) {
            void soundcloud.searchAndPlay(searchQuery);
            return;
        }
        if (isYouTubeMode) {
            void youtube.searchAndPlay(searchQuery);
            return;
        }
        void spotify.searchAndPlay(searchQuery);
    }, [isSoundcloudMode, isYouTubeMode, searchQuery, soundcloud.searchAndPlay, spotify.searchAndPlay, youtube.searchAndPlay]);

    const handleSpotifyArtistClick = useCallback(async (name: string) => {
        if (!name) return;
        setArtistDialogOpen(true);
        setArtistDialogLoading(true);
        setArtistDialogData(null);
        const data = await spotify.fetchArtistData(name);
        if (!data) {
            toast({ variant: "destructive", title: "No se pudo cargar el artista" });
        }
        setArtistDialogData(data);
        setArtistDialogLoading(false);
    }, [spotify]);

    const handleSoundcloudArtistClick = useCallback(async (_name: string) => {
        const artistId = soundcloud.currentTrack?.artistId;
        if (!artistId) return;
        setArtistDialogOpen(true);
        setArtistDialogLoading(true);
        setArtistDialogData(null);
        const data = await soundcloud.fetchArtistData(artistId);
        if (!data) {
            toast({ variant: "destructive", title: "No se pudo cargar el artista" });
        }
        setArtistDialogData(data);
        setArtistDialogLoading(false);
    }, [soundcloud]);

    const queueById = useMemo(() => {
        const map = new Map<string, (typeof spotify.queue)[number]>();
        spotify.queue.forEach((track) => map.set(track.id, track));
        return map;
    }, [spotify.queue]);

    const hasSearchResults =
        spotify.searchResults.tracks.length > 0 ||
        spotify.searchResults.albums.length > 0 ||
        spotify.searchResults.artists.length > 0;

    const hasSoundcloudSearchResults = soundcloud.searchResults.length > 0;
    const hasYoutubeSearchResults = youtube.searchResults.length > 0;
    const soundcloudLibraryItems = soundcloud.libraryBySection[soundcloudLibrarySection] || [];
    const soundcloudHasMore = Boolean(soundcloud.libraryNextBySection[soundcloudLibrarySection]);
    const soundcloudLoadingMore = soundcloud.libraryLoadingMoreBySection[soundcloudLibrarySection];
    const youtubeLibraryItems = youtube.libraryBySection[youtubeLibrarySection] || [];
    const youtubeHasMore = Boolean(youtube.libraryNextBySection[youtubeLibrarySection]);
    const youtubeLoadingMore = youtube.libraryLoadingMoreBySection[youtubeLibrarySection];
    const showSpotifySearchPanel = isLoggedIn && searchQuery.trim().length > 0 && (spotify.searchLoading || hasSearchResults);
    const showSoundcloudSearchPanel = isSoundcloudMode && searchQuery.trim().length > 0 && (soundcloud.searchLoading || hasSoundcloudSearchResults);
    const showYoutubeSearchPanel = false;
    const showLegacyYoutubeLibrary = false;
    const showYoutubeAuthControl = isYouTubeMode;
    const youtubeAuthLabel = youtube.isAuthLoading
        ? "Conectando..."
        : youtube.isAuthenticated
            ? "Desconectar YT"
            : "Conectar YT";
    const loginMessage = selectedPlatform === "spotify" ? spotify.statusText : PLATFORM_MESSAGE[selectedPlatform];
    const playbackActive = isLoggedIn ? spotify.isPlaying : isSoundcloudMode ? soundcloud.isPlaying : isYouTubeMode ? youtube.isPlaying : false;
    const playbackProgress = isLoggedIn ? spotify.progress : isSoundcloudMode ? soundcloud.progress : isYouTubeMode ? youtube.progress : 0;
    const playbackVolume = isLoggedIn ? spotify.volume : isSoundcloudMode ? soundcloud.volume : isYouTubeMode ? youtube.volume : 0.35;

    return (
        <>
        <div className="min-h-screen relative scanlines">
            <ReactiveBackground
                enabled={isSessionActive || isCharacterVisible || showOAuthBridge}
                isPlaying={playbackActive}
                progress={playbackProgress}
                volume={playbackVolume}
                variant={backgroundVariant}
                analyser={analyser}
                activeComment={critterCommentsMode ? activeCritterComment : null}
                beatSignal={beatRef}
                bpm={bpm}
                transitionActive={transitioning}
            />
            <PixelTransition
                active={transitioning}
                onComplete={handleTransitionComplete}
                onTransitionEnd={() => setTransitioning(false)}
            />
            <div className={`${isYouTubeMode ? "max-w-[2200px]" : "max-w-screen-xl"} mx-auto px-2 sm:px-4 lg:px-6 py-3 sm:py-5 relative z-10`}>
                <div className="pixel-box-elevated overflow-hidden">
                    {!showOAuthBridge && (
                        <Header
                            isSessionActive={isSessionActive}
                            showSearchControls={isLoggedIn || isSoundcloudMode || isYouTubeMode}
                            showDeviceControl={isLoggedIn}
                            showLibraryControl={isLoggedIn}
                            showAuthControl={showYoutubeAuthControl}
                            authControlLabel={youtubeAuthLabel}
                            authControlTitle={youtube.accountName || "YouTube"}
                            authControlDisabled={youtube.isAuthLoading}
                            authControlTone={youtube.isAuthenticated ? "secondary" : "primary"}
                            onAuthControl={() => {
                                if (youtube.isAuthenticated) {
                                    youtube.logout();
                                    return;
                                }
                                void youtube.startLogin();
                            }}
                            onLoginToggle={onLoginToggle}
                            activeDeviceName={spotify.activeDeviceName}
                            searchQuery={searchQuery}
                            searchPlaceholder={isSoundcloudMode ? "► BUSCAR TRACK EN SOUNDCLOUD..." : isYouTubeMode ? "► BUSCAR TRACK EN YOUTUBE..." : "► BUSCAR..."}
                            onSearchChange={setSearchQuery}
                            onSearchSubmit={onSearchSubmit}
                            onLibraryToggle={onLibraryToggle}
                            onDevicesToggle={onDevicesToggle}
                        />
                    )}

                    {showSpotifySearchPanel && (
                        <div className="px-4 pt-4">
                            <div className="pixel-box p-3 max-h-96 overflow-auto">
                                {spotify.searchLoading && (
                                    <p className="text-sm text-muted-foreground">Buscando resultados...</p>
                                )}
                                {!spotify.searchLoading && !hasSearchResults && (
                                    <p className="text-sm text-muted-foreground">Sin resultados.</p>
                                )}
                                {!!spotify.searchResults.tracks.length && (
                                    <div className="mb-3">
                                        <p className="font-display text-[8px] text-primary mb-2">CANCIONES</p>
                                        <div className="space-y-1">
                                            {spotify.searchResults.tracks.map((track) => (
                                                <div
                                                    key={track.id}
                                                    className="flex items-center gap-2 px-2 py-2 hover:bg-secondary cursor-pointer"
                                                    onClick={() => {
                                                        void spotify.playSearchTrack(track);
                                                    }}
                                                >
                                                    <img src={track.image} alt={track.name} className="w-8 h-8 border-2 border-border object-cover" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm truncate">{track.name}</p>
                                                        <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                                                    </div>
                                                    <button
                                                        className="retro-btn-secondary !text-[7px] !px-2 !py-1"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            void spotify.addToQueue(track.uri);
                                                        }}
                                                    >
                                                        Colar
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {!!spotify.searchResults.albums.length && (
                                    <div className="mb-3">
                                        <p className="font-display text-[8px] text-primary mb-2">ALBUMES</p>
                                        <div className="space-y-1">
                                            {spotify.searchResults.albums.map((album) => (
                                                <div
                                                    key={album.id}
                                                    className="flex items-center gap-2 px-2 py-2 hover:bg-secondary cursor-pointer"
                                                    onClick={() => void spotify.playAlbum(album.id)}
                                                >
                                                    <img src={album.image} alt={album.name} className="w-8 h-8 border-2 border-border object-cover" />
                                                    <p className="text-sm truncate">{album.name}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {!!spotify.searchResults.artists.length && (
                                    <div>
                                        <p className="font-display text-[8px] text-primary mb-2">ARTISTAS</p>
                                        <div className="space-y-1">
                                            {spotify.searchResults.artists.map((artist) => (
                                                <div key={artist.id} className="flex items-center gap-2 px-2 py-2">
                                                    <img src={artist.image} alt={artist.name} className="w-8 h-8 border-2 border-border rounded-full object-cover" />
                                                    <p className="text-sm truncate">{artist.name}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {showYoutubeSearchPanel && (
                        <div className="px-4 pt-4">
                            <div className="pixel-box p-3 max-h-96 overflow-auto">
                                {youtube.searchLoading && (
                                    <p className="text-sm text-muted-foreground">Buscando resultados...</p>
                                )}
                                {!youtube.searchLoading && !hasYoutubeSearchResults && (
                                    <p className="text-sm text-muted-foreground">Sin resultados.</p>
                                )}
                                {!!youtube.searchResults.length && (
                                    <div className="space-y-1">
                                        {youtube.searchResults.map((item) => (
                                            <div
                                                key={`yt-search-${item.id}`}
                                                className="flex items-center gap-2 px-2 py-2 hover:bg-secondary cursor-pointer"
                                                onClick={() => {
                                                    youtube.playSearchTrack(item);
                                                }}
                                            >
                                                <img
                                                    src={item.image}
                                                    alt={item.title}
                                                    className="w-8 h-8 border-2 border-border object-cover"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm truncate">{item.title}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{item.artist}</p>
                                                </div>
                                                <button
                                                    className="retro-btn-secondary !text-[7px] !px-2 !py-1"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        youtube.playSearchTrack(item);
                                                    }}
                                                >
                                                    Play
                                                </button>
                                                <button
                                                    className="retro-btn-secondary !text-[7px] !px-2 !py-1"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        youtube.addToQueue(item);
                                                    }}
                                                >
                                                    Colar
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {showLegacyYoutubeLibrary && isYouTubeMode && libraryOpen && (
                        <div className="px-4 pt-4">
                            <div className="pixel-box p-3">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="font-display text-[8px] text-primary">BIBLIOTECA YOUTUBE</p>
                                    <div className="flex items-center gap-2">
                                        {youtube.isAuthenticated && (
                                            <button
                                                onClick={() => void youtube.fetchLibrary()}
                                                className="retro-btn-secondary !text-[7px] !px-2 !py-1"
                                                disabled={youtube.libraryLoading}
                                            >
                                                {youtube.libraryLoading ? "..." : "Refresh"}
                                            </button>
                                        )}
                                        {youtube.isAuthenticated ? (
                                            <button
                                                onClick={youtube.logout}
                                                className="retro-btn-secondary !text-[7px] !px-2 !py-1"
                                            >
                                                Salir
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => void youtube.startLogin()}
                                                className="retro-btn-secondary !text-[7px] !px-2 !py-1"
                                                disabled={youtube.isAuthLoading}
                                            >
                                                {youtube.isAuthLoading ? "Conectando..." : "Conectar"}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {youtube.isAuthenticated && (
                                    <>
                                        <p className="text-sm text-muted-foreground mb-2 truncate">
                                            Cuenta: {youtube.accountName || "Conectada"}
                                        </p>
                                        <div className="grid grid-cols-3 gap-1 mb-3">
                                            {(["playlists", "likes", "watchLater"] as YouTubeLibrarySection[]).map((section) => {
                                                const isActive = youtubeLibrarySection === section;
                                                const count = youtube.libraryBySection[section]?.length || 0;
                                                const label = section === "playlists" ? "PLAYLISTS" : section === "likes" ? "LIKES" : "WATCH";
                                                return (
                                                    <button
                                                        key={`yt-lib-tab-${section}`}
                                                        onClick={() => {
                                                            sfx("select");
                                                            setYoutubeLibrarySection(section);
                                                        }}
                                                        className={`px-2 py-1 font-display text-[7px] border-2 ${
                                                            isActive ? "border-primary bg-secondary text-primary" : "border-border text-muted-foreground"
                                                        }`}
                                                    >
                                                        {label} ({count})
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}

                                {!youtube.isAuthenticated && (
                                    <p className="text-sm text-muted-foreground">
                                        Conecta Google para ver playlists, likes y watch later de YouTube.
                                    </p>
                                )}
                                {youtube.isAuthenticated && !youtubeLibraryItems.length && !youtube.libraryLoading && (
                                    <p className="text-sm text-muted-foreground">No hay elementos en {youtubeLibrarySection}.</p>
                                )}
                                {youtube.isAuthenticated && youtube.libraryLoading && (
                                    <p className="text-sm text-muted-foreground">Cargando biblioteca...</p>
                                )}

                                <div className="space-y-1 max-h-80 overflow-auto">
                                    {youtubeLibraryItems.map((item) => (
                                        <button
                                            key={`yt-lib-${youtubeLibrarySection}-${item.id}`}
                                            onClick={() => void youtube.playLibraryItem(item)}
                                            className="w-full text-left px-2 py-2 hover:bg-secondary flex items-center gap-2"
                                        >
                                            <img
                                                src={item.image}
                                                alt={item.title}
                                                className="w-8 h-8 border-2 border-border object-cover"
                                            />
                                            <div className="min-w-0">
                                                <p className="text-sm truncate">{item.title}</p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {item.artist}
                                                    {item.kind === "playlist" ? ` · ${item.trackCount || 0} tracks` : ""}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                {youtube.isAuthenticated && youtubeHasMore && (
                                    <button
                                        onClick={() => void youtube.loadMoreLibrarySection(youtubeLibrarySection)}
                                        className="retro-btn-secondary !text-[7px] !px-2 !py-1 mt-3"
                                        disabled={youtubeLoadingMore}
                                    >
                                        {youtubeLoadingMore ? "Cargando..." : "Cargar mas"}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {isLoggedIn && devicesOpen && (
                        <div className="px-4 pt-4">
                            <div className="pixel-box p-3">
                                <p className="font-display text-[8px] text-primary mb-2">DISPOSITIVOS DISPONIBLES</p>
                                <div className="space-y-2">
                                    {!spotify.devices.length && (
                                        <p className="text-sm text-muted-foreground">No hay dispositivos activos.</p>
                                    )}
                                    {spotify.devices.map((device) => (
                                        <button
                                            key={device.id}
                                            className={`w-full text-left px-3 py-2 border-2 transition-colors ${
                                                device.isActive
                                                    ? "border-primary bg-secondary"
                                                    : "border-border hover:border-primary/60"
                                            }`}
                                            onClick={() => void spotify.transferPlayback(device.id)}
                                            disabled={device.isRestricted}
                                        >
                                            <p className="text-sm">{device.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {device.type} {device.isActive ? "· activo" : ""}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {isLoggedIn && libraryOpen && (
                        <div className="px-4 pt-4">
                            <div className="pixel-box p-3">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="font-display text-[8px] text-primary">BIBLIOTECA</p>
                                    <button
                                        onClick={() => void spotify.playFavorites()}
                                        className="retro-btn-secondary !text-[7px] !px-2 !py-1"
                                    >
                                        Favoritos
                                    </button>
                                </div>
                                <div className="space-y-1 max-h-80 overflow-auto">
                                    {!spotify.playlists.length && !spotify.playlistsLoading && (
                                        <p className="text-sm text-muted-foreground">No hay playlists disponibles.</p>
                                    )}
                                    {spotify.playlists.map((playlist) => (
                                        <button
                                            key={playlist.id}
                                            onClick={() => void spotify.playPlaylist(playlist.id)}
                                            className="w-full text-left px-2 py-2 hover:bg-secondary flex items-center gap-2"
                                        >
                                            <img src={playlist.image} alt={playlist.name} className="w-8 h-8 border-2 border-border object-cover" />
                                            <div className="min-w-0">
                                                <p className="text-sm truncate">{playlist.name}</p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {playlist.owner} · {playlist.tracksTotal} tracks
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                {spotify.playlistsHasMore && (
                                    <button
                                        onClick={() => void spotify.loadPlaylists("append")}
                                        className="retro-btn-secondary !text-[7px] !px-2 !py-1 mt-3"
                                        disabled={spotify.playlistsLoading}
                                    >
                                        {spotify.playlistsLoading ? "Cargando..." : "Cargar mas"}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {isLoggedIn ? (
                        <PlayerScreen
                            currentTrack={spotify.currentTrack}
                            queueTracks={spotify.queue}
                            isPlaying={spotify.isPlaying}
                            progress={spotify.progress}
                            volume={spotify.volume}
                            shuffleMode={spotify.shuffleMode}
                            repeatMode={spotify.repeatMode}
                            isLiked={spotify.isLiked}
                            currentTime={spotify.currentTime}
                            totalTime={spotify.totalTime}
                            onPlayPause={() => void spotify.togglePlayPause()}
                            onNext={() => void spotify.nextTrack()}
                            onPrev={() => void spotify.prevTrack()}
                            onShuffleCycle={() => void spotify.cycleShuffle()}
                            onRepeatToggle={() => void spotify.cycleRepeat()}
                            onProgressChange={(value) => void spotify.seekToProgress(value)}
                            onVolumeChange={(value) => void spotify.setVolumeLevel(value)}
                            onLikeToggle={() => void spotify.toggleLike()}
                            onShare={() => void spotify.shareCurrent()}
                            onQueueRefresh={() => void spotify.refreshQueue()}
                            onQueueTrackSelect={(trackId) => {
                                const track = queueById.get(trackId);
                                if (!track) return;
                                void spotify.playQueueTrack(track);
                            }}
                            onArtistClick={handleSpotifyArtistClick}
                            analyser={analyser}
                            onRequestCapture={!captureActive ? requestYouTubeCapture : undefined}
                            bpm={bpm}
                            bpmConfidence={bpmConfidence}
                            beatSignal={beatRef}
                        />
                    ) : isSoundcloudMode ? (
                        <SoundcloudScreen
                            iframeRef={soundcloud.iframeRef}
                            iframeSrc={soundcloud.iframeSrc}
                            sdkReady={soundcloud.sdkReady}
                            isAuthenticated={soundcloud.isAuthenticated}
                            isAuthLoading={soundcloud.isAuthLoading}
                            accountName={soundcloud.accountName}
                            statusText={soundcloud.statusText}
                            libraryBySection={soundcloud.libraryBySection}
                            libraryNextBySection={soundcloud.libraryNextBySection}
                            libraryLoading={soundcloud.libraryLoading}
                            libraryLoadingMoreBySection={soundcloud.libraryLoadingMoreBySection}
                            recentQueue={soundcloud.recentQueue}
                            onRecentPlay={(item, queue) => soundcloud.playFromList(queue, queue.findIndex((q) => q.id === item.id))}
                            onRefreshLibrary={() => void soundcloud.fetchLibrary()}
                            onLoadMoreSection={(section) => void soundcloud.loadMoreLibrarySection(section)}
                            onPlaylistPlay={(item, queue) => soundcloud.playFromList(queue, queue.findIndex((q) => q.id === item.id))}
                            onConnect={() => void soundcloud.startLogin()}
                            onDisconnect={soundcloud.logout}
                            title={soundcloud.currentTrack.title}
                            artist={soundcloud.currentTrack.artist}
                            albumArt={soundcloud.currentTrack.albumArt}
                            isPlaying={soundcloud.isPlaying}
                            progress={soundcloud.progress}
                            durationMs={soundcloud.durationMs}
                            volume={soundcloud.volume}
                            currentTime={soundcloud.currentTime}
                            totalTime={soundcloud.totalTime}
                            onPlayPause={soundcloud.togglePlayPause}
                            onNext={soundcloud.nextTrack}
                            onPrev={soundcloud.prevTrack}
                            onSeek={soundcloud.seekToProgress}
                            onVolume={soundcloud.setVolumeLevel}
                            onShare={() => void soundcloud.shareCurrent()}
                            showLibraryPanel={true}
                            searchResults={soundcloud.searchResults}
                            searchLoading={soundcloud.searchLoading}
                            onSearchTrackPlay={soundcloud.playSearchTrack}
                            currentScTrackId={soundcloud.currentScTrackId}
                            trackPlaylistMembership={soundcloud.trackPlaylistMembership}
                            membershipLoading={soundcloud.membershipLoading}
                            onToggleTrackInPlaylist={(p) => void soundcloud.toggleTrackInPlaylist(p)}
                            onLoadTrackMembership={(playlists) => void soundcloud.loadTrackMembership(playlists)}
                            isCurrentTrackLiked={soundcloud.isCurrentTrackLiked}
                            onToggleLike={() => void soundcloud.toggleCurrentTrackLike()}
                            expandedPlaylist={soundcloud.expandedPlaylist}
                            expandedPlaylistLoading={soundcloud.expandedPlaylistLoading}
                            shuffleMode={soundcloud.shuffleMode}
                            onOpenPlaylist={(p) => void soundcloud.openPlaylist(p)}
                            onCloseExpandedPlaylist={soundcloud.closeExpandedPlaylist}
                            onToggleShuffle={soundcloud.toggleShuffle}
                            timedComments={soundcloud.timedComments}
                            onArtistClick={handleSoundcloudArtistClick}
                            analyser={analyser}
                            onRequestCapture={!captureActive ? requestYouTubeCapture : undefined}
                            critterCommentsMode={critterCommentsMode}
                            onToggleCritterComments={() => setCritterCommentsMode(m => !m)}
                            onCritterCommentTrigger={handleCritterCommentTrigger}
                            bpm={bpm}
                            bpmConfidence={bpmConfidence}
                            beatSignal={beatRef}
                        />
                    ) : isYouTubeMode ? (
                        <YoutubeMusicScreen
                            accountName={youtube.accountName}
                            isAuthenticated={youtube.isAuthenticated}
                            libraryLoading={youtube.libraryLoading}
                            playlists={youtube.libraryBySection.playlists}
                            likes={youtube.libraryBySection.likes}
                            searchQuery={searchQuery}
                            searchResults={youtube.searchResults}
                            searchLoading={youtube.searchLoading}
                            currentTrack={youtube.currentTrack}
                            queueTracks={youtube.queue}
                            recentTracks={youtube.recentQueue}
                            comments={youtube.comments}
                            commentsLoading={youtube.commentsLoading}
                            isPlaying={youtube.isPlaying}
                            progress={youtube.progress}
                            volume={youtube.volume}
                            shuffleMode={youtube.shuffleMode}
                            repeatMode={youtube.repeatMode}
                            currentTime={youtube.currentTime}
                            totalTime={youtube.totalTime}
                            playerHostRef={youtube.playerHostRef}
                            pipMode={youtube.pipMode}
                            onTogglePipMode={youtube.togglePipMode}
                            onPlayPause={youtube.togglePlayPause}
                            onNext={youtube.nextTrack}
                            onPrev={youtube.prevTrack}
                            onShuffleCycle={youtube.cycleShuffle}
                            onRepeatToggle={youtube.cycleRepeat}
                            onSeek={youtube.seekToProgress}
                            onVolume={youtube.setVolumeLevel}
                            onShare={() => void youtube.shareCurrent()}
                            onPlayLibraryItem={(item) => void youtube.playLibraryItem(item)}
                            onPlaySearchTrack={youtube.playSearchTrack}
                            onAddToQueue={youtube.addToQueue}
                            onPlayQueueTrack={youtube.playQueueTrack}
                            onRefreshLibrary={() => void youtube.fetchLibrary()}
                            onLoadMorePlaylists={() => void youtube.loadMoreLibrarySection("playlists")}
                            playlistsHaveMore={Boolean(youtube.libraryNextBySection.playlists)}
                            playlistsLoadingMore={youtube.libraryLoadingMoreBySection.playlists}
                            analyser={analyser}
                            onRequestCapture={requestYouTubeCapture}
                            bpm={bpm}
                            bpmConfidence={bpmConfidence}
                            beatSignal={beatRef}
                        />
                    ) : isFileaMode ? (
                        <FileaScreen />
                    ) : (
                        <>
                            {showOAuthBridge ? (
                                <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
                                    <div className="pixel-box p-8 max-w-lg w-full">
                                        <p className="font-display text-[9px] text-primary mb-3">CONECTANDO SPOTIFY...</p>
                                        <p className="text-sm text-muted-foreground">
                                            Validando autorizacion y preparando el reproductor.
                                        </p>
                                    </div>
                                </div>
                            ) : isCharacterVisible ? (
                                <CharacterSelectScreen
                                    onSelect={onPlatformSelect}
                                    onPreviewChange={setPreviewPlatform}
                                    onBack={() => {
                                        setPreviewPlatform(null);
                                        setIsAuthRedirecting(false);
                                        setShowCharacterSelect(false);
                                    }}
                                    initialPlatform={selectedPlatform}
                                />
                            ) : (
                                <LoginScreen
                                    onLogin={() => setShowCharacterSelect(true)}
                                    message={loginMessage}
                                    isLoading={selectedPlatform === "spotify" && spotify.isAuthLoading && !spotify.sdkReady}
                                />
                            )}
                        </>
                    )}
                </div>

                <div className="mt-4 flex items-center justify-center gap-2">                    <span className="font-display text-[7px] text-muted-foreground">BG FX</span>
                    <button
                        onClick={() => {
                            sfx("select");
                            setBackgroundVariant("arcadeGrid");
                        }}
                        className={`retro-btn-secondary !text-[7px] !px-2 !py-1 ${
                            backgroundVariant === "arcadeGrid" ? "!border-primary !text-primary !bg-secondary" : ""
                        }`}
                    >
                        GRID
                    </button>
                    <button
                        onClick={() => {
                            sfx("select");
                            setBackgroundVariant("starfieldShooter");
                        }}
                        className={`retro-btn-secondary !text-[7px] !px-2 !py-1 ${
                            backgroundVariant === "starfieldShooter" ? "!border-primary !text-primary !bg-secondary" : ""
                        }`}
                    >
                        STAR
                    </button>
                    <button
                        onClick={() => {
                            sfx("select");
                            setBackgroundVariant("pixelCritters");
                        }}
                        className={`retro-btn-secondary !text-[7px] !px-2 !py-1 ${
                            backgroundVariant === "pixelCritters" ? "!border-primary !text-primary !bg-secondary" : ""
                        }`}
                    >
                        HOP
                    </button>
                </div>

                <div className="text-center mt-4">
                    <p className="font-display text-[7px] text-muted-foreground">
                        © 2026 DEV HUB ENTERTAINMENT · SELECT + START
                    </p>
                </div>
            </div>
        </div>
        <ArtistDialog
            open={artistDialogOpen}
            onClose={() => setArtistDialogOpen(false)}
            data={artistDialogData}
            loading={artistDialogLoading}
            onPlayTrack={(track: ArtistTopTrack) => {
                if (isLoggedIn) void spotify.playSearchTrack({ id: track.id, uri: track.uri, name: track.title, artist: track.artist, image: track.albumArt });
                else if (isSoundcloudMode) soundcloud.playSearchTrack({ id: parseInt(track.id) || 0, title: track.title, permalink_url: track.uri, artwork_url: track.albumArt, track_count: 1, kind: "track", artist: track.artist });
                setArtistDialogOpen(false);
            }}
        />
        </>
    );
};

export default Index;
