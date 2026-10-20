import { useState, useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import Header from "@/components/Header";
import LoginScreen from "@/components/LoginScreen";
import PlayerScreen from "@/components/PlayerScreen";
import SoundcloudScreen from "@/components/SoundcloudScreen";
import FileaScreen from "@/components/FileaScreen";
import PixelTransition from "@/components/PixelTransition";
import ReactiveBackground, { type ReactiveBackgroundVariant } from "@/components/ReactiveBackground";
import useSpotifyPlayer from "@/hooks/useSpotifyPlayer";
import useSoundcloudPlayer from "@/hooks/useSoundcloudPlayer";
import useYoutubePlayer from "@/hooks/useYoutubePlayer";
import type { YouTubeLibrarySection } from "@/hooks/useYoutubePlayer";
import { useAudioAnalyser } from "@/hooks/useAudioAnalyser";
import { useBpmDetector } from "@/hooks/useBpmDetector";
import CharacterSelectScreen, { type PlatformId } from "@/components/CharacterSelectScreen";
import { toast } from "@/hooks/use-toast";
import useRetroSfx from "@/hooks/useRetroSfx";
import { usePlatformTheme } from "@/hooks/usePlatformTheme";
import { usePlatformSearch } from "@/hooks/usePlatformSearch";
import { useSessionTransitions } from "@/hooks/useSessionTransitions";
import { useYoutubeKeyboardShortcuts } from "@/hooks/useYoutubeKeyboardShortcuts";
import {
    getStoredPlatform,
    getStoredBackgroundVariant,
    PLATFORM_MESSAGE,
} from "@/lib/platformTheme";
import ArtistDialog from "@/components/ArtistDialog";
import OAuthBridgeScreen from "@/components/OAuthBridgeScreen";
import BackgroundVariantSelector from "@/components/BackgroundVariantSelector";
import SpotifySearchPanel from "@/components/panels/SpotifySearchPanel";
import SpotifyDevicesPanel from "@/components/panels/SpotifyDevicesPanel";
import SpotifyLibraryPanel from "@/components/panels/SpotifyLibraryPanel";
import YoutubeSearchPanel from "@/components/panels/YoutubeSearchPanel";
import YoutubeLibraryPanel from "@/components/panels/YoutubeLibraryPanel";
import type { ArtistData, ArtistTopTrack, PlaybackSnapshot, QueueTrack, SearchProvider } from "@/types/player";
import {
    createInitialSessionState,
    resolveLoginToggle,
    selectActiveModes,
    sessionReducer,
    type StreamingMode,
} from "@/lib/session/sessionReducer";

const IDLE_PLAYBACK: PlaybackSnapshot = { isPlaying: false, progress: 0, volume: 0.35 };

const MODE_ACTIVATED_TOAST: Record<StreamingMode, { title: string; description: string }> = {
    soundcloud: {
        title: "Modo SoundCloud activado",
        description: "Carga un enlace y reproduce desde el widget.",
    },
    youtube: {
        title: "Modo YouTube activado",
        description: "Busca tracks con el header y reproduce al instante.",
    },
};

const Index = () => {
    const spotify = useSpotifyPlayer();
    const soundcloud = useSoundcloudPlayer();
    const youtube = useYoutubePlayer();
    const { clearSearchResults: clearSpotifySearch, logout: logoutSpotify, startLogin: startSpotifyLogin } = spotify;
    const { clearSearchResults: clearSoundcloudSearch, reset: resetSoundcloud } = soundcloud;
    const { clearSearchResults: clearYoutubeSearch, reset: resetYoutube } = youtube;
    const sfx = useRetroSfx();
    const [oauthReturnDetected] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const state = params.get("state");
        return Boolean(code && (!state || state.startsWith("sp_")));
    });
    const [session, dispatch] = useReducer(sessionReducer, spotify.isAuthenticated, (isLoggedIn: boolean) =>
        createInitialSessionState({ isLoggedIn, selectedPlatform: getStoredPlatform() }),
    );
    const {
        searchQuery,
        isLoggedIn,
        transitioning,
        libraryOpen,
        devicesOpen,
        showCharacterSelect,
        isCharacterVisible,
        selectedPlatform,
        previewPlatform,
        isAuthRedirecting,
        pendingModeActivation,
        pendingModeDeactivation,
    } = session;
    const [backgroundVariant, setBackgroundVariant] = useState<ReactiveBackgroundVariant>(() => getStoredBackgroundVariant());
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
    const { isSoundcloudMode, isYouTubeMode, isFileaMode } = selectActiveModes(session);
    const isSessionActive = isLoggedIn || isSoundcloudMode || isYouTubeMode || isFileaMode;
    const showOAuthBridge = !isLoggedIn && oauthReturnDetected && spotify.isAuthLoading;
    const lastAuthFeedbackIdRef = useRef<number | null>(null);
    const youtubeVolumeBeforeMuteRef = useRef(0.5);

    const activePlatform = isLoggedIn ? "spotify" : isSoundcloudMode ? "soundcloud" : isYouTubeMode ? "youtube" : null;
    const { analyser, ytCaptureActive: captureActive, requestYouTubeCapture } = useAudioAnalyser(activePlatform);
    const { bpm, beatRef } = useBpmDetector(analyser);

    useEffect(() => {
        dispatch({
            type: "previewChanged",
            platform: showCharacterSelect || isCharacterVisible ? selectedPlatform : null,
        });
    }, [isCharacterVisible, selectedPlatform, showCharacterSelect]);

    useSessionTransitions(session, dispatch, { spotifyAuthenticated: spotify.isAuthenticated, showOAuthBridge });

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
        const feedback = spotify.authFeedback;
        if (!feedback) return;
        if (lastAuthFeedbackIdRef.current === feedback.id) return;
        lastAuthFeedbackIdRef.current = feedback.id;
        sfx(feedback.kind === "success" ? "success" : "fail");
    }, [sfx, spotify.authFeedback]);

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
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            dispatch({ type: "escapePressed" });
            clearSpotifySearch();
            clearSoundcloudSearch();
            clearYoutubeSearch();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [clearSoundcloudSearch, clearSpotifySearch, clearYoutubeSearch]);

    useYoutubeKeyboardShortcuts(youtube, isYouTubeMode, youtubeVolumeBeforeMuteRef);

    const handleTransitionComplete = useCallback(() => {
        if (pendingModeActivation === "soundcloud") {
            resetYoutube();
        } else if (pendingModeActivation === "youtube") {
            resetSoundcloud();
        } else if (pendingModeDeactivation === "soundcloud") {
            resetSoundcloud();
        } else if (pendingModeDeactivation === "youtube") {
            resetYoutube();
        }
        dispatch({ type: "transitionCompleted" });
        if (pendingModeActivation) {
            toast(MODE_ACTIVATED_TOAST[pendingModeActivation]);
        }
    }, [pendingModeActivation, pendingModeDeactivation, resetSoundcloud, resetYoutube]);

    const onLoginToggle = useCallback(() => {
        const outcome = resolveLoginToggle({ isSoundcloudMode, isYouTubeMode, isFileaMode }, spotify.isAuthenticated);
        dispatch({ type: "loginToggled", outcome });
        if (outcome === "logoutSpotify") {
            clearSpotifySearch();
            logoutSpotify();
        }
    }, [isFileaMode, isSoundcloudMode, isYouTubeMode, clearSpotifySearch, spotify.isAuthenticated, logoutSpotify]);

    const onPlatformSelect = useCallback(
        (platform: PlatformId) => {
            dispatch({ type: "platformSelected", platform });
            // Streaming modes switch providers in handleTransitionComplete, once the transition covers the screen.
            if (platform === "soundcloud" || platform === "youtube") return;
            sfx("coin");
            resetSoundcloud();
            resetYoutube();
            if (platform === "filea") {
                toast({
                    title: "FILEA READY",
                    description: "La idol pixel esta activa en el selector.",
                });
                return;
            }
            void startSpotifyLogin().catch(() => {
                dispatch({ type: "authRedirectFailed" });
                toast({
                    variant: "destructive",
                    title: "No se pudo abrir Spotify",
                    description: "Intenta de nuevo en unos segundos.",
                });
            });
        },
        [sfx, resetSoundcloud, startSpotifyLogin, resetYoutube]
    );

    const onLibraryToggle = useCallback(() => {
        const opening = !libraryOpen;
        dispatch({ type: "libraryToggled" });
        if (isSoundcloudMode) {
            if (opening && soundcloud.isAuthenticated) {
                void soundcloud.fetchLibrary();
            }
            return;
        }
        if (isYouTubeMode) {
            if (opening && youtube.isAuthenticated) {
                void youtube.fetchLibrary();
            }
            return;
        }
        void spotify.ensureLibraryLoaded();
    }, [isSoundcloudMode, isYouTubeMode, libraryOpen, soundcloud, spotify, youtube]);

    const onDevicesToggle = useCallback(() => {
        dispatch({ type: "devicesToggled" });
        void spotify.fetchDevices();
    }, [spotify]);

    const onSearchChange = useCallback((query: string) => dispatch({ type: "searchQueryChanged", query }), []);
    const onPreviewChange = useCallback((platform: PlatformId) => dispatch({ type: "previewChanged", platform }), []);

    const searchProvider: SearchProvider = isSoundcloudMode ? soundcloud : isYouTubeMode ? youtube : spotify;
    const { searchAndPlay } = searchProvider;
    const onSearchSubmit = useCallback(() => {
        void searchAndPlay(searchQuery);
    }, [searchAndPlay, searchQuery]);

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
        const map = new Map<string, QueueTrack>();
        spotify.queue.forEach((track) => map.set(track.id, track));
        return map;
    }, [spotify.queue]);

    const hasSearchQuery = searchQuery.trim().length > 0;
    const hasSpotifySearchResults =
        spotify.searchResults.tracks.length > 0 ||
        spotify.searchResults.albums.length > 0 ||
        spotify.searchResults.artists.length > 0;
    const showSpotifySearchPanel = isLoggedIn && hasSearchQuery && (spotify.searchLoading || hasSpotifySearchResults);
    const showYoutubeSearchPanel = isYouTubeMode && hasSearchQuery && (youtube.searchLoading || youtube.searchResults.length > 0);
    const showYoutubeAuthControl = isYouTubeMode;
    const youtubeAuthLabel = youtube.isAuthLoading
        ? "Conectando..."
        : youtube.isAuthenticated
            ? "Desconectar YT"
            : "Conectar YT";
    const loginMessage = selectedPlatform === "spotify" ? spotify.statusText : PLATFORM_MESSAGE[selectedPlatform];
    const playback: PlaybackSnapshot = isLoggedIn
        ? spotify
        : isSoundcloudMode
            ? soundcloud
            : isYouTubeMode
                ? youtube
                : IDLE_PLAYBACK;

    return (
        <>
        <div className="min-h-screen relative scanlines">
            <ReactiveBackground
                enabled={isSessionActive || isCharacterVisible || showOAuthBridge}
                isPlaying={playback.isPlaying}
                progress={playback.progress}
                volume={playback.volume}
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
                onTransitionEnd={() => dispatch({ type: "transitionEnded" })}
            />
            <div className="max-w-screen-xl mx-auto px-2 sm:px-4 lg:px-6 py-3 sm:py-5 relative z-10">
                <div className="pixel-box-elevated overflow-hidden">
                    {!showOAuthBridge && (
                        <Header
                            isSessionActive={isSessionActive}
                            showSearchControls={isLoggedIn || isSoundcloudMode || isYouTubeMode}
                            showDeviceControl={isLoggedIn}
                            showLibraryControl={(isLoggedIn || (isYouTubeMode && youtube.isAuthenticated))}
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
                            onSearchChange={onSearchChange}
                            onSearchSubmit={onSearchSubmit}
                            onLibraryToggle={onLibraryToggle}
                            onDevicesToggle={onDevicesToggle}
                        />
                    )}

                    {showSpotifySearchPanel && <SpotifySearchPanel player={spotify} />}

                    {showYoutubeSearchPanel && <YoutubeSearchPanel player={youtube} />}

                    {isYouTubeMode && libraryOpen && (
                        <YoutubeLibraryPanel
                            player={youtube}
                            section={youtubeLibrarySection}
                            onSectionChange={setYoutubeLibrarySection}
                        />
                    )}

                    {isLoggedIn && devicesOpen && <SpotifyDevicesPanel player={spotify} />}

                    {isLoggedIn && libraryOpen && <SpotifyLibraryPanel player={spotify} />}

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
                            beatSignal={beatRef}
                        />
                    ) : isYouTubeMode ? (
                        <PlayerScreen
                            currentTrack={youtube.currentTrack}
                            queueTracks={youtube.queue}
                            isPlaying={youtube.isPlaying}
                            progress={youtube.progress}
                            volume={youtube.volume}
                            shuffleMode={youtube.shuffleMode}
                            repeatMode={youtube.repeatMode}
                            isLiked={false}
                            currentTime={youtube.currentTime}
                            totalTime={youtube.totalTime}
                            onPlayPause={youtube.togglePlayPause}
                            onNext={youtube.nextTrack}
                            onPrev={youtube.prevTrack}
                            onShuffleCycle={youtube.cycleShuffle}
                            onRepeatToggle={youtube.cycleRepeat}
                            onProgressChange={youtube.seekToProgress}
                            onVolumeChange={youtube.setVolumeLevel}
                            onLikeToggle={() => {}}
                            onShare={() => void youtube.shareCurrent()}
                            onQueueRefresh={youtube.refreshQueue}
                            onQueueTrackSelect={youtube.playQueueTrack}
                            comments={youtube.comments}
                            commentsLoading={youtube.commentsLoading}
                            analyser={analyser}
                            onRequestCapture={requestYouTubeCapture}
                            playerHostRef={youtube.playerHostRef}
                            showVideo={youtube.showVideo}
                            pipMode={youtube.pipMode}
                            onToggleVideoMode={youtube.toggleVideoMode}
                            onTogglePipMode={youtube.togglePipMode}
                            bpm={bpm}
                            beatSignal={beatRef}
                        />
                    ) : isFileaMode ? (
                        <FileaScreen />
                    ) : (
                        <>
                            {showOAuthBridge ? (
                                <OAuthBridgeScreen />
                            ) : isCharacterVisible ? (
                                <CharacterSelectScreen
                                    onSelect={onPlatformSelect}
                                    onPreviewChange={onPreviewChange}
                                    onBack={() => dispatch({ type: "characterSelectClosed" })}
                                    initialPlatform={selectedPlatform}
                                />
                            ) : (
                                <LoginScreen
                                    onLogin={() => dispatch({ type: "characterSelectOpened" })}
                                    message={loginMessage}
                                    isLoading={selectedPlatform === "spotify" && spotify.isAuthLoading && !spotify.sdkReady}
                                />
                            )}
                        </>
                    )}
                </div>

                <BackgroundVariantSelector value={backgroundVariant} onChange={setBackgroundVariant} />

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
