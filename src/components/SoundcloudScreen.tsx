import useRetroSfx from "@/hooks/useRetroSfx";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Music } from "pixelarticons/react/Music";
import { Link } from "pixelarticons/react/Link";
import { Heart } from "pixelarticons/react/Heart";
import { ArrowLeftBox } from "pixelarticons/react/ArrowLeftBox";
import { ArrowRightBox } from "pixelarticons/react/ArrowRightBox";
import { Play } from "pixelarticons/react/Play";
import { Bulletlist } from "pixelarticons/react/Bulletlist";
import PixelIcon from "@/components/PixelIcon";
import PixelBubble from "@/components/PixelBubble";
import EmojiText from "@/components/EmojiText";
import Visualizer from "@/components/Visualizer";
import ScrollingText from "@/components/ScrollingText";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SoundcloudLibrarySection, ScTimedComment } from "@/hooks/useSoundcloudPlayer";
interface SoundcloudPlaylistItem {
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

interface SoundcloudScreenProps {
    iframeRef: RefObject<HTMLIFrameElement>;
    iframeSrc: string;
    sdkReady: boolean;
    isAuthenticated: boolean;
    isAuthLoading: boolean;
    accountName: string;
    statusText: string;
    libraryBySection: Record<SoundcloudLibrarySection, SoundcloudPlaylistItem[]>;
    libraryNextBySection: Record<SoundcloudLibrarySection, string | null>;
    libraryLoading: boolean;
    libraryLoadingMoreBySection: Record<SoundcloudLibrarySection, boolean>;
    recentQueue: SoundcloudPlaylistItem[];
    onRecentPlay: (item: SoundcloudPlaylistItem, queue: SoundcloudPlaylistItem[]) => void;
    onRefreshLibrary: () => void;
    onLoadMoreSection: (section: SoundcloudLibrarySection) => void;
    onPlaylistPlay: (playlist: SoundcloudPlaylistItem, queue: SoundcloudPlaylistItem[]) => void;
    onConnect: () => void;
    onDisconnect: () => void;
    title: string;
    artist: string;
    albumArt: string;
    isPlaying: boolean;
    progress: number;
    durationMs: number;
    volume: number;
    currentTime: string;
    totalTime: string;
    onPlayPause: () => void;
    onNext: () => void;
    onPrev: () => void;
    onSeek: (value: number) => void;
    onVolume: (value: number) => void;
    onShare: () => void;
    showLibraryPanel?: boolean;
    searchResults: SoundcloudPlaylistItem[];
    searchLoading: boolean;
    onSearchTrackPlay: (item: SoundcloudPlaylistItem) => void;
    currentScTrackId: number | null;
    trackPlaylistMembership: Record<number, boolean>;
    membershipLoading: boolean;
    onToggleTrackInPlaylist: (playlist: SoundcloudPlaylistItem) => void;
    onLoadTrackMembership: (playlists: SoundcloudPlaylistItem[]) => void;
    isCurrentTrackLiked: boolean;
    onToggleLike: () => void;
    expandedPlaylist: { id: number; title: string; tracks: SoundcloudPlaylistItem[] } | null;
    expandedPlaylistLoading: boolean;
    shuffleMode: "off" | "shuffle" | "smart";
    onOpenPlaylist: (playlist: SoundcloudPlaylistItem) => void;
    onCloseExpandedPlaylist: () => void;
    onToggleShuffle: () => void;
    timedComments: ScTimedComment[];
    onArtistClick?: (name: string) => void;
    analyser?: AnalyserNode | null;
    onRequestCapture?: () => void;
    critterCommentsMode?: boolean;
    onToggleCritterComments?: () => void;
    onCritterCommentTrigger?: (comment: { body: string; username: string }) => void;
    bpm?: number | null;
    bpmConfidence?: number;
    beatSignal?: import("react").MutableRefObject<number>;
}

const SoundcloudScreen = ({
    iframeRef,
    iframeSrc,
    sdkReady,
    isAuthenticated,
    isAuthLoading,
    accountName,
    statusText,
    libraryBySection,
    libraryNextBySection,
    libraryLoading,
    libraryLoadingMoreBySection,
    recentQueue,
    onRecentPlay,
    onRefreshLibrary,
    onLoadMoreSection,
    onPlaylistPlay,
    onConnect,
    onDisconnect,
    title,
    artist,
    albumArt,
    isPlaying,
    progress,
    durationMs,
    volume,
    currentTime,
    totalTime,
    onPlayPause,
    onNext,
    onPrev,
    onSeek,
    onVolume,
    onShare,
    showLibraryPanel = true,
    searchResults,
    searchLoading,
    onSearchTrackPlay,
    currentScTrackId,
    trackPlaylistMembership,
    membershipLoading,
    onToggleTrackInPlaylist,
    onLoadTrackMembership,
    isCurrentTrackLiked,
    onToggleLike,
    expandedPlaylist,
    expandedPlaylistLoading,
    shuffleMode,
    onOpenPlaylist,
    onCloseExpandedPlaylist,
    onToggleShuffle,
    timedComments,
    onArtistClick,
    analyser,
    onRequestCapture,
    critterCommentsMode = false,
    onToggleCritterComments,
    onCritterCommentTrigger,
    bpm,
    bpmConfidence,
    beatSignal,
}: SoundcloudScreenProps) => {
    const sfx = useRetroSfx();
    const seekBarRef = useRef<HTMLDivElement>(null);
    const isDraggingSeekRef = useRef(false);

    const PausePixel = () => (
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4">
            <path d="M6 5h4v14H6V5Zm8 0h4v14h-4V5Z" />
        </svg>
    );

    const ShuffleIcon = () => (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M2 4h2v2H2zM4 4h8v2H4zM12 4h2v2h-2zM14 4h2v2h-2zM12 6h2v2h-2zM14 8h2v2h-2zM8 10h2v2H8zM10 10h2v2h-2zM12 10h2v2h-2zM10 12h2v2h-2zM4 12H2v2h2v-2zM4 12h6v2H4zM2 10h2v2H2zM2 10h4v2H2zM2 8h2v2H2zM2 6h2v2H2zM14 12h2v2h-2zM16 10h2v2h-2z"/>
        </svg>
    );

    const [activeSection, setActiveSection] = useState<SoundcloudLibrarySection>("playlists");
    const [showPlaylistModal, setShowPlaylistModal] = useState(false);
    const rememberedVolumeRef = useRef(Math.max(0.15, volume || 0.5));

    // Timed comments state
    const prevProgressRef = useRef(0);
    const [activeComment, setActiveComment] = useState<ScTimedComment | null>(null);
    const activeCommentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isInAnyPlaylist = Object.values(trackPlaylistMembership).some(Boolean);

    useEffect(() => {
        if (volume > 0.01) {
            rememberedVolumeRef.current = volume;
        }
    }, [volume]);

    // Reset active comment on track change
    useEffect(() => {
        setActiveComment(null);
        prevProgressRef.current = 0;
        if (activeCommentTimerRef.current) clearTimeout(activeCommentTimerRef.current);
    }, [currentScTrackId]);

    // Trigger comments when playback crosses their timestamp
    useEffect(() => {
        if (!timedComments.length || !durationMs) return;
        const prevMs = (prevProgressRef.current / 100) * durationMs;
        const currMs = (progress / 100) * durationMs;
        prevProgressRef.current = progress;
        // Ignore backward seeks
        if (currMs < prevMs - 2000) return;
        const triggered = timedComments.filter((c) => c.timestamp > prevMs && c.timestamp <= currMs);
        if (triggered.length > 0) {
            const comment = triggered[triggered.length - 1];
            if (activeCommentTimerRef.current) clearTimeout(activeCommentTimerRef.current);
            if (critterCommentsMode) {
                // Route comment to the jumping critters in the background
                onCritterCommentTrigger?.({ body: comment.body, username: comment.user.username });
                setActiveComment(null);
            } else {
                setActiveComment(comment);
                activeCommentTimerRef.current = setTimeout(() => setActiveComment(null), 3500);
            }
        }
    }, [progress, durationMs, timedComments, critterCommentsMode, onCritterCommentTrigger]);

    useEffect(() => {
        const handleMouseUp = () => {
            isDraggingSeekRef.current = false;
        };
        window.addEventListener("mouseup", handleMouseUp);
        return () => window.removeEventListener("mouseup", handleMouseUp);
    }, []);

    const sectionMeta = useMemo(
        () => [
            { key: "playlists" as const, label: "PLAYLISTS" },
            { key: "tracks" as const, label: "TRACKS" },
            { key: "likes" as const, label: "LIKES" },
        ],
        []
    );

    const activeLibraryItems = libraryBySection[activeSection] || [];
    const hasMoreInSection = Boolean(libraryNextBySection[activeSection]);
    const loadingMoreInSection = libraryLoadingMoreBySection[activeSection];

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.target as HTMLElement)?.closest("input, textarea")) return;

            if (event.code === "Space") {
                event.preventDefault();
                sfx(isPlaying ? "cancel" : "confirm");
                onPlayPause();
                return;
            }

            if (event.code === "ArrowRight") {
                event.preventDefault();
                const step = durationMs > 0 ? (5000 / durationMs) * 100 : 5;
                onSeek(Math.min(100, progress + step));
                return;
            }

            if (event.code === "ArrowLeft") {
                event.preventDefault();
                const step = durationMs > 0 ? (5000 / durationMs) * 100 : 5;
                onSeek(Math.max(0, progress - step));
                return;
            }

            if (event.code === "ArrowUp") {
                event.preventDefault();
                onVolume(Math.min(1, volume + 0.05));
                return;
            }

            if (event.code === "ArrowDown") {
                event.preventDefault();
                onVolume(Math.max(0, volume - 0.05));
                return;
            }

            if (event.code === "KeyM") {
                event.preventDefault();
                if (volume > 0.01) {
                    rememberedVolumeRef.current = volume;
                    onVolume(0);
                } else {
                    onVolume(Math.max(0.15, rememberedVolumeRef.current || 0.5));
                }
                return;
            }

            if (event.code === "KeyN") {
                event.preventDefault();
                onNext();
                return;
            }

            if (event.code === "KeyB") {
                event.preventDefault();
                onPrev();
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [durationMs, isPlaying, onNext, onPlayPause, onPrev, onSeek, onVolume, progress, sfx, volume]);

    return (
        <div className="px-4 py-5 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 lg:gap-6">
                <div className="pixel-box-elevated p-5 flex flex-col items-center gap-5 relative scanlines">
                    <div className="relative">
                        <img
                            src={albumArt}
                            alt={title}
                            className="w-full aspect-square object-cover border-4 border-border"
                            style={{
                                boxShadow: "4px 4px 0 hsl(240 30% 4%)",
                                imageRendering: "auto",
                                filter: "contrast(1.04) saturate(0.95)",
                            }}
                        />
                        {isPlaying && (
                            <div className="absolute top-2 right-2 w-3 h-3 bg-accent border border-foreground animate-pulse-glow" />
                        )}
                    </div>

                    <div className="w-full pixel-box p-3">
                        <ScrollingText
                            text={title}
                            className="font-display text-[9px] text-primary mb-1 w-full"
                            style={{ textShadow: "2px 2px 0 hsl(240 30% 4%)" }}
                        />
                        {onArtistClick ? (
                            <button
                                onClick={() => onArtistClick(artist)}
                                className="w-full text-left cursor-pointer hover:text-primary transition-colors"
                                title="Ver perfil del artista"
                            >
                                <ScrollingText
                                    text={artist}
                                    className="text-sm text-muted-foreground w-full hover:text-primary transition-colors"
                                />
                            </button>
                        ) : (
                            <ScrollingText
                                text={artist}
                                className="text-sm text-muted-foreground w-full"
                            />
                        )}
                        <div className="mt-3 flex items-center gap-3">
                            <button
                                onClick={() => { sfx(isCurrentTrackLiked ? "cancel" : "coin"); onToggleLike(); }}
                                className={`retro-btn-secondary !p-2 ${isCurrentTrackLiked ? "!bg-destructive !text-destructive-foreground !border-destructive" : ""}`}
                                disabled={!isAuthenticated || !currentScTrackId}
                                title={isAuthenticated ? (isCurrentTrackLiked ? "Quitar like" : "Dar like") : "Conecta tu cuenta"}
                            >
                                <PixelIcon icon={Heart} size="sm" className={isCurrentTrackLiked ? "text-destructive-foreground" : ""} />
                            </button>
                            <button onClick={() => { sfx("confirm"); onShare(); }} className="retro-btn-secondary !p-2">
                                <PixelIcon icon={Link} size="sm" />
                            </button>
                            <button
                                onClick={() => { sfx("select"); onLoadTrackMembership(libraryBySection.playlists); setShowPlaylistModal(true); }}
                                className={`retro-btn-secondary !p-2 ${isInAnyPlaylist ? "!bg-primary !text-primary-foreground !border-primary" : ""}`}
                                disabled={!isAuthenticated || !currentScTrackId}
                                title={isAuthenticated ? "Agregar a playlist" : "Conecta tu cuenta"}
                            >
                                <PixelIcon icon={Bulletlist} size="sm" className={isInAnyPlaylist ? "text-primary-foreground" : ""} />
                            </button>
                            <span className="ml-auto font-display text-[8px] text-muted-foreground">
                                {isPlaying ? "NOW PLAYING" : "PAUSED"}
                            </span>
                        </div>
                    </div>

                    <div className="w-full pixel-box p-3">
                        <p className="font-display text-[8px] text-primary mb-2">CUENTA</p>
                        {isAuthenticated ? (
                            <>
                                <p className="text-sm text-muted-foreground truncate mb-2">{accountName || "Conectado"}</p>
                                <button onClick={onDisconnect} className="retro-btn-secondary !text-[8px] !px-2 !py-1 w-full">
                                    Desconectar
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => { sfx("coin"); onConnect(); }}
                                className="retro-btn-secondary !text-[8px] !px-2 !py-1 w-full"
                                disabled={isAuthLoading}
                            >
                                {isAuthLoading ? "Conectando..." : "Conectar Cuenta"}
                            </button>
                        )}
                    </div>

                    <Visualizer isPlaying={isPlaying} analyser={analyser} onRequestCapture={onRequestCapture} bpm={bpm} bpmConfidence={bpmConfidence} beatSignal={beatSignal} />
                </div>

                <div className="space-y-5">
                    <div className="pixel-box-elevated p-5">
                        <div className="flex items-center justify-between mb-3">
                            <p className="font-display text-[8px] text-primary flex items-center gap-2">
                                <span className="w-2 h-2 bg-accent border border-foreground animate-pulse-glow" />
                                SOUNDCLOUD MODE
                            </p>
                            <p className="text-xs text-muted-foreground">{sdkReady ? "SDK listo" : "Cargando SDK..."}</p>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">{statusText}</p>

                        <div className="space-y-2 mb-4">
                            {/* Seek bar with comment markers and speech bubble */}
                            <div className="relative" style={{ overflow: "visible" }}>
                                {/* Active timed comment — bubble above, avatar below (tail points at avatar) */}
                                {activeComment && durationMs > 0 && (
                                    <div
                                        className="absolute bottom-full mb-2 z-50 pointer-events-none flex flex-col"
                                        style={{
                                            left: `${Math.min(84, Math.max(16, (activeComment.timestamp / durationMs) * 100))}%`,
                                            transform: "translateX(-50%)",
                                            width: 200,
                                        }}
                                    >
                                        {/* Pixel-art speech bubble with tail at bottom-left */}
                                        <PixelBubble>
                                            <p className="text-[9px] leading-tight line-clamp-4 break-words" style={{ color: "hsl(var(--pixel-ink))" }}>
                                                <EmojiText text={activeComment.body} size={12} />
                                            </p>
                                        </PixelBubble>

                                        {/* Avatar + username — aligned below where the tail tip lands (~24px from left) */}
                                        {/* Tail overlaps bubble by 4px; tail body = 5 rows × 4px = 20px; total = 16px below bubble */}
                                        <div className="flex items-center gap-1" style={{ marginTop: 18, marginLeft: 4 }}>
                                            <img
                                                src={activeComment.user.avatar_url || "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="}
                                                alt=""
                                                className="w-12 h-12 border-2 border-foreground flex-shrink-0"
                                                style={{ imageRendering: "pixelated" }}
                                            />
                                            <span className="font-display text-[6px] text-primary truncate max-w-[100px] leading-tight">
                                                {activeComment.user.username}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div
                                    ref={seekBarRef}
                                    className="relative h-3 bg-secondary border-2 border-border cursor-pointer"
                                    onMouseDown={(e) => {
                                        isDraggingSeekRef.current = true;
                                        const rect = seekBarRef.current!.getBoundingClientRect();
                                        onSeek(Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)));
                                    }}
                                    onMouseMove={(e) => {
                                        if (!isDraggingSeekRef.current) return;
                                        const rect = seekBarRef.current!.getBoundingClientRect();
                                        onSeek(Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)));
                                    }}
                                    onClick={(e) => {
                                        sfx("select");
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        onSeek(Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)));
                                    }}
                                >
                                    <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
                                    <div className="absolute top-[-4px] w-2 h-[calc(100%+8px)] bg-foreground" style={{ left: `${progress}%`, transform: "translateX(-50%)" }} />
                                    {/* Timed comment markers */}
                                    {durationMs > 0 && timedComments.map((comment) => (
                                        <div
                                            key={comment.id}
                                            className="absolute top-0 bottom-0 pointer-events-none"
                                            style={{
                                                left: `${(comment.timestamp / durationMs) * 100}%`,
                                                width: "1px",
                                                backgroundColor: "hsl(var(--accent))",
                                                opacity: 0.65,
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-between items-center font-display text-[8px] text-muted-foreground">
                                <span>{currentTime}</span>
                                {timedComments.length > 0 && onToggleCritterComments && (
                                    <button
                                        onClick={() => { sfx("select"); onToggleCritterComments(); }}
                                        title={critterCommentsMode ? "Comentarios en la barra" : "Comentarios en los animalitos"}
                                        className={`retro-btn-secondary !p-1 !text-[7px] flex items-center gap-1 transition-all ${critterCommentsMode ? "!border-accent !text-accent" : ""}`}
                                    >
                                        <span>{critterCommentsMode ? "🐸" : "💬"}</span>
                                        <span className="hidden sm:inline">{critterCommentsMode ? "BICHOS" : "BARRA"}</span>
                                    </button>
                                )}
                                <span>{totalTime || "0:00"}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-3 mb-4">
                            <button
                                onClick={() => {
                                    sfx(shuffleMode === "off" ? "select" : shuffleMode === "shuffle" ? "select" : "cancel");
                                    onToggleShuffle();
                                }}
                                className={`retro-btn-secondary !p-2 relative ${
                                    shuffleMode === "smart" ? "!bg-accent !text-accent-foreground !border-accent" :
                                    shuffleMode === "shuffle" ? "!bg-primary !text-primary-foreground !border-primary" : ""
                                }`}
                                title={shuffleMode === "off" ? "Shuffle desactivado" : shuffleMode === "shuffle" ? "Shuffle activado" : "Smart Shuffle activado"}
                            >
                                <ShuffleIcon />
                                {shuffleMode === "smart" && (
                                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent border border-background rounded-full animate-pulse" />
                                )}
                            </button>
                            <button onClick={() => { sfx("navigate"); onPrev(); }} className="retro-btn-secondary !p-2">
                                <PixelIcon icon={ArrowLeftBox} size="md" />
                            </button>
                            <button onClick={() => { sfx(isPlaying ? "cancel" : "confirm"); onPlayPause(); }} className="retro-btn !px-5 !py-3">
                                {isPlaying ? <PausePixel /> : <PixelIcon icon={Play} size="md" />}
                            </button>
                            <button onClick={() => { sfx("navigate"); onNext(); }} className="retro-btn-secondary !p-2">
                                <PixelIcon icon={ArrowRightBox} size="md" />
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            <PixelIcon icon={Music} size="sm" className="text-muted-foreground" />
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={volume}
                                onChange={(e) => onVolume(parseFloat(e.target.value))}
                                className="w-full"
                            />
                            <span className="font-display text-[8px] text-muted-foreground whitespace-nowrap">
                                {Math.round(volume * 100)}%
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                        <div className="pixel-box p-4">
                            <p className="font-display text-[8px] text-primary mb-2">COLA RECIENTE</p>
                            {!recentQueue.length && <p className="text-sm text-muted-foreground">Sin reproducciones recientes.</p>}
                            <div className="space-y-1 max-h-56 overflow-auto">
                                {recentQueue.map((item, idx) => (
                                    <button
                                        key={`recent-top-${item.id}-${idx}`}
                                        onClick={() => {
                                            sfx("confirm");
                                            onRecentPlay(item, recentQueue);
                                        }}
                                        className="w-full text-left px-2 py-2 hover:bg-secondary flex items-center gap-2"
                                    >
                                        <img
                                            src={item.artwork_url || "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="}
                                            alt={item.title}
                                            className="w-8 h-8 border-2 border-border object-cover"
                                        />
                                        <div className="min-w-0">
                                            <p className="text-sm truncate">{item.title}</p>
                                            <p className="text-xs text-muted-foreground truncate">{item.artist || item.subtitle || "SoundCloud"}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {(searchLoading || searchResults.length > 0) && (
                        <div className="pixel-box p-4">
                            <p className="font-display text-[8px] text-primary mb-2">RESULTADOS DE BÚSQUEDA</p>
                            {searchLoading && (
                                <p className="font-display text-[8px] text-muted-foreground animate-pulse">BUSCANDO...</p>
                            )}
                            {!searchLoading && searchResults.length > 0 && (
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {searchResults.map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => {
                                                sfx("confirm");
                                                onSearchTrackPlay(item);
                                            }}
                                            className="w-full flex items-center gap-2 p-2 hover:bg-secondary transition-colors text-left"
                                        >
                                            {item.artwork_url ? (
                                                <img
                                                    src={item.artwork_url.replace("-large", "-small")}
                                                    alt={item.title}
                                                    className="w-8 h-8 flex-shrink-0 pixel-border object-cover"
                                                />
                                            ) : (
                                                <div className="w-8 h-8 flex-shrink-0 bg-secondary border-2 border-border flex items-center justify-center">
                                                    <PixelIcon icon={Music} size="sm" className="text-muted-foreground" />
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-xs truncate">{item.title}</p>
                                                <p className="font-display text-[7px] text-muted-foreground truncate">
                                                    {item.artist || item.subtitle || "SoundCloud"}
                                                </p>
                                            </div>
                                            <PixelIcon icon={Play} size="sm" className="flex-shrink-0 ml-auto text-primary" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        )}

                        {showLibraryPanel && (
                            <div className="pixel-box p-4">
                            <div className="flex items-center justify-between mb-2">
                                <p className="font-display text-[8px] text-primary">MI BIBLIOTECA</p>
                                {isAuthenticated && (
                                    <button
                                        onClick={onRefreshLibrary}
                                        className="retro-btn-secondary !text-[7px] !px-2 !py-1"
                                        disabled={libraryLoading}
                                    >
                                        {libraryLoading ? "..." : "Refresh"}
                                    </button>
                                )}
                            </div>
                            {isAuthenticated && (
                                <div className="grid grid-cols-3 gap-1 mb-3">
                                    {sectionMeta.map((section) => {
                                        const isActive = section.key === activeSection;
                                        const count = libraryBySection[section.key]?.length || 0;
                                        return (
                                            <button
                                                key={section.key}
                                                onClick={() => {
                                                    sfx("select");
                                                    setActiveSection(section.key);
                                                }}
                                                className={`px-2 py-1 font-display text-[7px] border-2 ${
                                                    isActive ? "border-primary bg-secondary text-primary" : "border-border text-muted-foreground"
                                                }`}
                                            >
                                                {section.label} ({count})
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            {!isAuthenticated && <p className="text-sm text-muted-foreground">Conecta tu cuenta para ver tu biblioteca.</p>}
                            {isAuthenticated && !activeLibraryItems.length && !libraryLoading && (
                                <p className="text-sm text-muted-foreground">Sin elementos en {activeSection}.</p>
                            )}
                            {isAuthenticated && libraryLoading && <p className="text-sm text-muted-foreground">Cargando biblioteca...</p>}
                            {expandedPlaylist ? (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <button onClick={() => { sfx("cancel"); onCloseExpandedPlaylist(); }} className="retro-btn-secondary !text-[7px] !px-2 !py-1">
                                            ← Volver
                                        </button>
                                        <p className="font-display text-[8px] text-primary truncate flex-1 mx-2">{expandedPlaylist.title}</p>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => { sfx("confirm"); if (expandedPlaylist.tracks.length) onPlaylistPlay(expandedPlaylist.tracks[0], expandedPlaylist.tracks); }}
                                                className="retro-btn-secondary !text-[7px] !px-2 !py-1"
                                                disabled={!expandedPlaylist.tracks.length}
                                                title="Reproducir todo"
                                            >
                                                ▶ Todo
                                            </button>
                                            <button
                                                onClick={() => {
                                                    sfx("confirm");
                                                    if (expandedPlaylist.tracks.length) {
                                                        const shuffled = [...expandedPlaylist.tracks].sort(() => Math.random() - 0.5);
                                                        onPlaylistPlay(shuffled[0], shuffled);
                                                    }
                                                }}
                                                className="retro-btn-secondary !text-[7px] !px-2 !py-1"
                                                disabled={!expandedPlaylist.tracks.length}
                                                title="Reproducir aleatoriamente"
                                            >
                                                ⇄ Shuffle
                                            </button>
                                        </div>
                                    </div>
                                    {expandedPlaylistLoading ? (
                                        <p className="text-sm text-muted-foreground">Cargando tracks...</p>
                                    ) : !expandedPlaylist.tracks.length ? (
                                        <p className="text-sm text-muted-foreground">Sin tracks disponibles.</p>
                                    ) : (
                                        <div className="space-y-1 max-h-56 overflow-auto">
                                            {expandedPlaylist.tracks.map((track, idx) => (
                                                <button
                                                    key={`${track.id}-${idx}`}
                                                    onClick={() => { sfx("confirm"); onPlaylistPlay(track, expandedPlaylist.tracks); }}
                                                    className="w-full flex items-center gap-2 px-2 py-2 hover:bg-secondary text-left"
                                                >
                                                    <img
                                                        src={track.artwork_url || "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="}
                                                        alt={track.title}
                                                        className="w-8 h-8 flex-shrink-0 border-2 border-border object-cover"
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm truncate">{track.title}</p>
                                                        <p className="text-xs text-muted-foreground truncate">{track.artist || "SoundCloud"}</p>
                                                    </div>
                                                    <PixelIcon icon={Play} size="sm" className="flex-shrink-0 text-primary" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                            <div className="space-y-1 max-h-56 overflow-auto">
                                {activeLibraryItems.map((playlist) => (
                                    <div
                                        key={`${activeSection}-${playlist.id}`}
                                        className="flex items-center gap-2 px-2 py-2 hover:bg-secondary"
                                    >
                                        <button
                                            className="flex items-center gap-2 flex-1 min-w-0 text-left"
                                            onClick={() => {
                                                sfx("confirm");
                                                if (playlist.kind === "playlist") {
                                                    onOpenPlaylist(playlist);
                                                } else {
                                                    onPlaylistPlay(playlist, activeLibraryItems);
                                                }
                                            }}
                                        >
                                            <img
                                                src={playlist.artwork_url || "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="}
                                                alt={playlist.title}
                                                className="w-8 h-8 flex-shrink-0 border-2 border-border object-cover"
                                            />
                                            <div className="min-w-0">
                                                <p className="text-sm truncate">{playlist.title}</p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {playlist.artist || playlist.subtitle || "SoundCloud"}{" "}
                                                    {playlist.kind === "playlist" ? `· ${playlist.track_count || 0} tracks` : ""}
                                                </p>
                                            </div>
                                        </button>
                                    </div>
                                ))}
                            </div>
                            )}
                            {isAuthenticated && hasMoreInSection && (
                                <button
                                    onClick={() => onLoadMoreSection(activeSection)}
                                    className="retro-btn-secondary !text-[7px] !px-2 !py-1 mt-3"
                                    disabled={loadingMoreInSection}
                                >
                                    {loadingMoreInSection ? "Cargando..." : "Cargar mas"}
                                </button>
                            )}
                        </div>
                        )}
                    </div>

                    <div className="pixel-box p-3">
                        <iframe
                            ref={iframeRef}
                            key={iframeSrc}
                            title="SoundCloud Player"
                            width="100%"
                            height="166"
                            scrolling="no"
                            frameBorder="no"
                            allow="autoplay"
                            src={iframeSrc}
                            style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 1, height: 1, overflow: "hidden" }}
                        />
                        <p className="font-display text-[7px] text-muted-foreground">
                            SPACE: PLAY/PAUSE · ←/→: SEEK · ↑/↓: VOLUMEN · M: MUTE · N/B: NEXT/PREV
                        </p>
                    </div>
                </div>
            </div>

            {/* Playlist modal */}
            <Dialog open={showPlaylistModal} onOpenChange={setShowPlaylistModal}>
                <DialogContent className="max-w-sm w-full max-h-[80vh] flex flex-col gap-4 border-4 border-border bg-background"
                    style={{ boxShadow: "inset 2px 2px 0 hsl(var(--primary) / 0.3), inset -2px -2px 0 hsl(240 25% 8%), 6px 6px 0 hsl(240 30% 4% / 0.7)" }}>
                    <DialogHeader>
                        <DialogTitle className="font-display text-[10px] text-primary">AGREGAR A PLAYLIST</DialogTitle>
                    </DialogHeader>
                    {membershipLoading ? (
                        <p className="text-sm text-muted-foreground">Cargando playlists...</p>
                    ) : libraryBySection.playlists.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No tienes playlists en tu biblioteca.</p>
                    ) : (
                        <div className="space-y-1 overflow-y-auto flex-1">
                            {libraryBySection.playlists.map((pl) => {
                                const inPlaylist = Boolean(trackPlaylistMembership[pl.id]);
                                return (
                                    <button
                                        key={pl.id}
                                        onClick={() => { sfx("select"); void onToggleTrackInPlaylist(pl); }}
                                        className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-secondary ${inPlaylist ? "bg-secondary" : ""}`}
                                    >
                                        <img
                                            src={pl.artwork_url || "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="}
                                            alt={pl.title}
                                            className="w-8 h-8 flex-shrink-0 border-2 border-border object-cover"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm truncate">{pl.title}</p>
                                            <p className="text-xs text-muted-foreground">{pl.track_count ?? 0} tracks</p>
                                        </div>
                                        <span className={`flex-shrink-0 w-5 h-5 border-2 font-display text-[10px] flex items-center justify-center transition-colors ${
                                            inPlaylist
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : "border-border text-muted-foreground"
                                        }`}>
                                            {inPlaylist ? "✓" : "+"}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default SoundcloudScreen;
