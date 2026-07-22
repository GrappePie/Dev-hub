import { useEffect, useMemo, useState, type MutableRefObject, type ReactNode } from "react";
import fallbackAlbumArt from "@/assets/album-art-placeholder.svg";
import type { CurrentTrack, QueueTrack } from "@/hooks/useSpotifyPlayer";
import type { YouTubeComment, YouTubeLibraryItem, YouTubeTrack } from "@/hooks/useYoutubePlayer";
import type { YouTubeConnectController } from "@/hooks/useYoutubeConnect";
import useRetroSfx from "@/hooks/useRetroSfx";
import PixelIcon from "@/components/PixelIcon";
import Visualizer from "@/components/Visualizer";
import { Play } from "pixelarticons/react/Play";
import { ArrowLeftBox } from "pixelarticons/react/ArrowLeftBox";
import { ArrowRightBox } from "pixelarticons/react/ArrowRightBox";
import { Shuffle } from "pixelarticons/react/Shuffle";
import { Repeat } from "pixelarticons/react/Repeat";
import { Link } from "pixelarticons/react/Link";
import { PictureInPicture } from "pixelarticons/react/PictureInPicture";
import { ThumbsUp } from "pixelarticons/react/ThumbsUp";
import { ThumbsDown } from "pixelarticons/react/ThumbsDown";
import { MoreVertical } from "pixelarticons/react/MoreVertical";
import { ExternalLink } from "pixelarticons/react/ExternalLink";
import { Radio } from "pixelarticons/react/Radio";
import { ListBox } from "pixelarticons/react/ListBox";
import { User } from "pixelarticons/react/User";
import { CloudServer } from "pixelarticons/react/CloudServer";
import { Copy } from "pixelarticons/react/Copy";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type YoutubeView = "home" | "library" | "likes" | "playlist";

interface YoutubeMusicScreenProps {
    accountName: string;
    isAuthenticated: boolean;
    libraryLoading: boolean;
    playlists: YouTubeLibraryItem[];
    likes: YouTubeLibraryItem[];
    searchQuery: string;
    searchResults: YouTubeTrack[];
    searchLoading: boolean;
    currentTrack: CurrentTrack | null;
    queueTracks: QueueTrack[];
    recentTracks: YouTubeTrack[];
    comments: YouTubeComment[];
    commentsLoading: boolean;
    isPlaying: boolean;
    progress: number;
    volume: number;
    currentRating: "like" | "dislike" | "none";
    ratingLoading: boolean;
    shuffleMode: "off" | "shuffle" | "smart";
    repeatMode: number;
    currentTime: string;
    totalTime: string;
    connect: YouTubeConnectController;
    playerHostRef: (node: HTMLDivElement | null) => void;
    pipMode: boolean;
    onTogglePipMode: () => void;
    onPlayPause: () => void;
    onNext: () => void;
    onPrev: () => void;
    onShuffleCycle: () => void;
    onRepeatToggle: () => void;
    onSeek: (value: number) => void;
    onVolume: (value: number) => void;
    onRate: (rating: "like" | "dislike") => void;
    onQueueNext: () => void;
    onQueueLast: () => void;
    onClearQueue: () => void;
    onStartMix: () => void;
    onSaveToPlaylist: (playlistId: string, playlistTitle: string) => void;
    onShare: () => void;
    onPlayLibraryItem: (item: YouTubeLibraryItem) => void | Promise<void>;
    onPlaySearchTrack: (track: YouTubeTrack) => void;
    onAddToQueue: (track: YouTubeTrack) => void;
    onPlayQueueTrack: (trackId: string) => void;
    onRefreshLibrary: () => void | Promise<void>;
    onLoadMorePlaylists: () => void | Promise<void>;
    playlistsHaveMore: boolean;
    playlistsLoadingMore: boolean;
    analyser?: AnalyserNode | null;
    onRequestCapture?: () => void;
    bpm?: number | null;
    bpmConfidence?: number;
    beatSignal?: MutableRefObject<number>;
}

const isPlaylist = (item: YouTubeLibraryItem): item is Extract<YouTubeLibraryItem, { kind: "playlist" }> =>
    item.kind === "playlist";

const YoutubeMusicScreen = ({
    accountName,
    isAuthenticated,
    libraryLoading,
    playlists,
    likes,
    searchQuery,
    searchResults,
    searchLoading,
    currentTrack,
    queueTracks,
    recentTracks,
    comments,
    commentsLoading,
    isPlaying,
    progress,
    volume,
    currentRating,
    ratingLoading,
    shuffleMode,
    repeatMode,
    currentTime,
    totalTime,
    connect,
    playerHostRef,
    pipMode,
    onTogglePipMode,
    onPlayPause,
    onNext,
    onPrev,
    onShuffleCycle,
    onRepeatToggle,
    onSeek,
    onVolume,
    onRate,
    onQueueNext,
    onQueueLast,
    onClearQueue,
    onStartMix,
    onSaveToPlaylist,
    onShare,
    onPlayLibraryItem,
    onPlaySearchTrack,
    onAddToQueue,
    onPlayQueueTrack,
    onRefreshLibrary,
    onLoadMorePlaylists,
    playlistsHaveMore,
    playlistsLoadingMore,
    analyser,
    onRequestCapture,
    bpm,
    bpmConfidence,
    beatSignal,
}: YoutubeMusicScreenProps) => {
    const sfx = useRetroSfx();
    const [view, setView] = useState<YoutubeView>("home");
    const [selectedPlaylist, setSelectedPlaylist] = useState<Extract<YouTubeLibraryItem, { kind: "playlist" }> | null>(null);
    const isSearching = searchQuery.trim().length > 0;
    const playlistItems = useMemo(() => playlists.filter(isPlaylist), [playlists]);
    const likedTracks = useMemo(() => likes.filter((item) => item.kind === "track"), [likes]);
    const heroArt = currentTrack?.albumArt || playlistItems[0]?.image || fallbackAlbumArt;
    const activeView = isSearching ? "search" : view;

    useEffect(() => {
        if (!isAuthenticated) setView("home");
    }, [isAuthenticated]);

    const navigate = (next: YoutubeView) => {
        sfx("navigate");
        setView(next);
        if (next !== "playlist") setSelectedPlaylist(null);
    };

    const openPlaylist = (item: Extract<YouTubeLibraryItem, { kind: "playlist" }>) => {
        sfx("confirm");
        setSelectedPlaylist(item);
        setView("playlist");
        void onPlayLibraryItem(item);
    };

    const playLikedTrack = (item: YouTubeLibraryItem) => {
        if (item.kind !== "track") return;
        sfx("confirm");
        void onPlayLibraryItem(item);
    };

    return (
        <div className="youtube-music-shell">
            <aside className="youtube-music-sidebar">
                <div className="youtube-music-brand">
                    <span className="youtube-music-brand-orb">▶</span>
                    <div>
                        <p>TUBY//MUSIC</p>
                        <span>PLAYER ONE</span>
                    </div>
                </div>

                <nav className="youtube-music-nav" aria-label="Navegación de YouTube">
                    <button className={view === "home" ? "is-active" : ""} onClick={() => navigate("home")}>
                        <span>[H]</span> INICIO
                    </button>
                    <button className={view === "library" ? "is-active" : ""} onClick={() => navigate("library")}>
                        <span>[B]</span> BIBLIOTECA
                    </button>
                    <button className={view === "likes" ? "is-active" : ""} onClick={() => navigate("likes")}>
                        <span>[♥]</span> LIKES
                    </button>
                </nav>

                <div className="youtube-music-side-library">
                    <div className="youtube-music-side-heading">
                        <span>PLAYLISTS</span>
                        <span>{playlistItems.length.toString().padStart(2, "0")}</span>
                    </div>
                    {playlistItems.slice(0, 7).map((item, index) => (
                        <button key={item.id} onClick={() => openPlaylist(item)}>
                            <span className="youtube-music-slot">{String(index + 1).padStart(2, "0")}</span>
                            <span className="truncate">{item.title}</span>
                        </button>
                    ))}
                    {!playlistItems.length && (
                        <p>{isAuthenticated ? "SIN DATOS" : "CONECTA TU CUENTA"}</p>
                    )}
                </div>

                <div className="youtube-music-profile">
                    <span>{(accountName || "YT").slice(0, 2).toUpperCase()}</span>
                    <div className="min-w-0">
                        <p className="truncate">{accountName || "INVITADO"}</p>
                        <small>{isAuthenticated ? "LINK OK" : "OFFLINE"}</small>
                    </div>
                </div>
            </aside>

            <section className="youtube-music-stage">
                <div className="youtube-music-stage-grid">
                    <main className="youtube-music-content">
                        {activeView === "search" ? (
                            <SearchView
                                query={searchQuery}
                                loading={searchLoading}
                                tracks={searchResults}
                                onPlay={onPlaySearchTrack}
                                onQueue={onAddToQueue}
                            />
                        ) : activeView === "library" ? (
                            <LibraryView
                                loading={libraryLoading}
                                playlists={playlistItems}
                                onOpen={openPlaylist}
                                onRefresh={onRefreshLibrary}
                                onLoadMore={onLoadMorePlaylists}
                                hasMore={playlistsHaveMore}
                                loadingMore={playlistsLoadingMore}
                            />
                        ) : activeView === "likes" ? (
                            <TracksView
                                eyebrow="AUTO-SAVE SLOT"
                                title="MÚSICA QUE TE GUSTÓ"
                                subtitle={`${likedTracks.length} tracks sincronizados desde YouTube`}
                                image={likedTracks[0]?.image || heroArt}
                                tracks={likedTracks.map((item) => ({
                                    id: item.id,
                                    title: item.title,
                                    artist: item.artist,
                                    duration: item.duration,
                                    image: item.image,
                                }))}
                                onTrackClick={(id) => {
                                    const item = likedTracks.find((track) => track.id === id);
                                    if (item) playLikedTrack(item);
                                }}
                            />
                        ) : activeView === "playlist" && selectedPlaylist ? (
                            <TracksView
                                eyebrow="PLAYLIST DE {PLAYER}"
                                title={selectedPlaylist.title}
                                subtitle={`${selectedPlaylist.artist} · ${selectedPlaylist.trackCount || queueTracks.length} tracks`}
                                image={selectedPlaylist.image}
                                tracks={queueTracks.map((track) => ({ ...track, image: selectedPlaylist.image }))}
                                onTrackClick={onPlayQueueTrack}
                                onPlayAll={() => void onPlayLibraryItem(selectedPlaylist)}
                            />
                        ) : (
                            <HomeView
                                accountName={accountName}
                                currentTrack={currentTrack}
                                heroArt={heroArt}
                                playlists={playlistItems}
                                likes={likedTracks}
                                recentTracks={recentTracks}
                                onOpenPlaylist={openPlaylist}
                                onPlayLike={playLikedTrack}
                                onPlayRecent={onPlaySearchTrack}
                                onLibrary={() => navigate("library")}
                            />
                        )}
                    </main>

                    <NowPlayingDock
                        currentTrack={currentTrack}
                        playerHostRef={playerHostRef}
                        pipMode={pipMode}
                        onTogglePipMode={onTogglePipMode}
                        comments={comments}
                        commentsLoading={commentsLoading}
                        analyser={analyser}
                        onRequestCapture={onRequestCapture}
                        bpm={bpm}
                        bpmConfidence={bpmConfidence}
                        beatSignal={beatSignal}
                        isPlaying={isPlaying}
                    />
                </div>

                <CompactPlayerBar
                    currentTrack={currentTrack}
                    playlists={playlistItems}
                    isPlaying={isPlaying}
                    progress={progress}
                    volume={volume}
                    currentRating={currentRating}
                    ratingLoading={ratingLoading}
                    shuffleMode={shuffleMode}
                    repeatMode={repeatMode}
                    currentTime={currentTime}
                    totalTime={totalTime}
                    connect={connect}
                    onPlayPause={onPlayPause}
                    onNext={onNext}
                    onPrev={onPrev}
                    onShuffleCycle={onShuffleCycle}
                    onRepeatToggle={onRepeatToggle}
                    onSeek={onSeek}
                    onVolume={onVolume}
                    onRate={onRate}
                    onQueueNext={onQueueNext}
                    onQueueLast={onQueueLast}
                    onClearQueue={onClearQueue}
                    onStartMix={onStartMix}
                    onSaveToPlaylist={onSaveToPlaylist}
                    onTogglePipMode={onTogglePipMode}
                    onShare={onShare}
                />
            </section>
        </div>
    );
};

const SectionHeading = ({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) => (
    <div className="youtube-music-section-heading">
        <div>
            <span>{eyebrow}</span>
            <h2>{title}</h2>
        </div>
        {action}
    </div>
);

const HomeView = ({
    accountName,
    currentTrack,
    heroArt,
    playlists,
    likes,
    recentTracks,
    onOpenPlaylist,
    onPlayLike,
    onPlayRecent,
    onLibrary,
}: {
    accountName: string;
    currentTrack: CurrentTrack | null;
    heroArt: string;
    playlists: Array<Extract<YouTubeLibraryItem, { kind: "playlist" }>>;
    likes: Array<Extract<YouTubeLibraryItem, { kind: "track" }>>;
    recentTracks: YouTubeTrack[];
    onOpenPlaylist: (item: Extract<YouTubeLibraryItem, { kind: "playlist" }>) => void;
    onPlayLike: (item: YouTubeLibraryItem) => void;
    onPlayRecent: (track: YouTubeTrack) => void;
    onLibrary: () => void;
}) => (
    <div className="space-y-8">
        <section className="youtube-music-hero">
            <div className="youtube-music-hero-copy">
                <span className="youtube-music-kicker">WELCOME BACK, {(accountName || "PLAYER").toUpperCase()}</span>
                <h1>{currentTrack ? "CONTINUE YOUR RUN" : "PRESS PLAY TO BEGIN"}</h1>
                <p>{currentTrack ? `${currentTrack.title} · ${currentTrack.artist}` : "Tu biblioteca musical está lista para otra partida."}</p>
                <button className="retro-btn !text-[8px]" onClick={onLibrary}>ABRIR BIBLIOTECA</button>
            </div>
            <div className="youtube-music-hero-art">
                <img src={heroArt} alt="Selección destacada" />
                <span>STAGE 01</span>
            </div>
        </section>

        <section>
            <SectionHeading eyebrow="CONTINUE SELECT" title="TUS PLAYLISTS" action={<button onClick={onLibrary}>VER TODAS →</button>} />
            <div className="youtube-music-card-grid">
                {playlists.slice(0, 6).map((item, index) => (
                    <button key={item.id} className="youtube-music-card" onClick={() => onOpenPlaylist(item)}>
                        <div className="youtube-music-card-art">
                            <img src={item.image} alt={item.title} />
                            <span>{String(index + 1).padStart(2, "0")}</span>
                        </div>
                        <strong>{item.title}</strong>
                        <small>{item.trackCount || 0} tracks · {item.artist}</small>
                    </button>
                ))}
            </div>
        </section>

        {!!recentTracks.length && (
            <section>
                <SectionHeading eyebrow="RECENT DROPS" title="VOLVER A ESCUCHAR" />
                <div className="youtube-music-wide-grid">
                    {recentTracks.slice(0, 4).map((track) => (
                        <button key={track.id} onClick={() => onPlayRecent(track)}>
                            <img src={track.image} alt={track.title} />
                            <span><strong>{track.title}</strong><small>{track.artist}</small></span>
                            <b>▶</b>
                        </button>
                    ))}
                </div>
            </section>
        )}

        <section>
            <SectionHeading eyebrow="FAVORITES BUFFER" title="LIKES RECIENTES" />
            <div className="youtube-music-track-list">
                {likes.slice(0, 6).map((item, index) => (
                    <button key={item.id} onClick={() => onPlayLike(item)}>
                        <span className="youtube-music-track-index">{String(index + 1).padStart(2, "0")}</span>
                        <img src={item.image} alt={item.title} />
                        <span className="min-w-0"><strong>{item.title}</strong><small>{item.artist}</small></span>
                        <time>{item.duration}</time>
                    </button>
                ))}
            </div>
        </section>
    </div>
);

const LibraryView = ({ loading, playlists, onOpen, onRefresh, onLoadMore, hasMore, loadingMore }: {
    loading: boolean;
    playlists: Array<Extract<YouTubeLibraryItem, { kind: "playlist" }>>;
    onOpen: (item: Extract<YouTubeLibraryItem, { kind: "playlist" }>) => void;
    onRefresh: () => void | Promise<void>;
    onLoadMore: () => void | Promise<void>;
    hasMore: boolean;
    loadingMore: boolean;
}) => (
    <section>
        <SectionHeading
            eyebrow="MEMORY CARD"
            title="BIBLIOTECA"
            action={<button className="retro-btn-secondary !text-[7px] !px-3 !py-2" disabled={loading} onClick={() => void onRefresh()}>{loading ? "SYNC..." : "REFRESH"}</button>}
        />
        <div className="youtube-music-library-grid">
            {playlists.map((item, index) => (
                <button key={item.id} className="youtube-music-library-card" onClick={() => onOpen(item)}>
                    <div><img src={item.image} alt={item.title} /><span>FILE {String(index + 1).padStart(2, "0")}</span></div>
                    <strong>{item.title}</strong>
                    <small>{item.artist} · {item.trackCount || 0} tracks</small>
                </button>
            ))}
        </div>
        {!playlists.length && !loading && <p className="youtube-music-empty">NO PLAYLIST DATA FOUND</p>}
        {hasMore && <button className="retro-btn-secondary mt-6 !text-[7px]" disabled={loadingMore} onClick={() => void onLoadMore()}>{loadingMore ? "LOADING..." : "LOAD MORE"}</button>}
    </section>
);

const SearchView = ({ query, loading, tracks, onPlay, onQueue }: {
    query: string;
    loading: boolean;
    tracks: YouTubeTrack[];
    onPlay: (track: YouTubeTrack) => void;
    onQueue: (track: YouTubeTrack) => void;
}) => (
    <section>
        <SectionHeading eyebrow="RADAR SEARCH" title={`RESULTADOS: ${query}`} />
        {loading && <p className="youtube-music-empty">SCANNING YOUTUBE...</p>}
        <div className="youtube-music-search-grid">
            {tracks.map((track) => (
                <article key={track.id}>
                    <button className="youtube-music-search-art" onClick={() => onPlay(track)}>
                        <img src={track.image} alt={track.title} />
                        <span>▶</span>
                    </button>
                    <div><strong>{track.title}</strong><small>{track.artist} · {track.duration}</small></div>
                    <button className="retro-btn-secondary !px-2 !py-1 !text-[6px]" onClick={() => onQueue(track)}>+ QUEUE</button>
                </article>
            ))}
        </div>
        {!loading && !tracks.length && <p className="youtube-music-empty">NO SIGNAL / SIN RESULTADOS</p>}
    </section>
);

const TracksView = ({ eyebrow, title, subtitle, image, tracks, onTrackClick, onPlayAll }: {
    eyebrow: string;
    title: string;
    subtitle: string;
    image: string;
    tracks: Array<{ id: string; title: string; artist: string; duration: string; image: string }>;
    onTrackClick: (id: string) => void;
    onPlayAll?: () => void;
}) => (
    <section>
        <div className="youtube-music-playlist-hero">
            <div className="youtube-music-playlist-art"><img src={image} alt={title} /><span>SELECT</span></div>
            <div>
                <span className="youtube-music-kicker">{eyebrow}</span>
                <h1>{title}</h1>
                <p>{subtitle}</p>
                {onPlayAll && <button className="retro-btn !text-[8px]" onClick={onPlayAll}>▶ PLAY ALL</button>}
            </div>
        </div>
        <div className="youtube-music-track-list youtube-music-track-list-large">
            {tracks.map((track, index) => (
                <button key={track.id} onClick={() => onTrackClick(track.id)}>
                    <span className="youtube-music-track-index">{String(index + 1).padStart(2, "0")}</span>
                    <img src={track.image} alt={track.title} />
                    <span className="min-w-0"><strong>{track.title}</strong><small>{track.artist}</small></span>
                    <span className="youtube-music-row-action">PLAY</span>
                    <time>{track.duration}</time>
                </button>
            ))}
        </div>
        {!tracks.length && <p className="youtube-music-empty">LOADING TRACK DATA...</p>}
    </section>
);

const NowPlayingDock = ({ currentTrack, playerHostRef, pipMode, onTogglePipMode, comments, commentsLoading, analyser, onRequestCapture, bpm, bpmConfidence, beatSignal, isPlaying }: {
    currentTrack: CurrentTrack | null;
    playerHostRef: (node: HTMLDivElement | null) => void;
    pipMode: boolean;
    onTogglePipMode: () => void;
    comments: YouTubeComment[];
    commentsLoading: boolean;
    analyser?: AnalyserNode | null;
    onRequestCapture?: () => void;
    bpm?: number | null;
    bpmConfidence?: number;
    beatSignal?: MutableRefObject<number>;
    isPlaying: boolean;
}) => (
    <aside className="youtube-music-now-playing">
        <div className="youtube-music-dock-heading"><span>LIVE VIDEO</span><i>{isPlaying ? "ON AIR" : "STANDBY"}</i></div>
        <div className={pipMode ? "youtube-music-video youtube-music-video-pip" : "youtube-music-video"}>
            <div ref={playerHostRef} className="yt-video-container h-full w-full" />
        </div>
        <button className="youtube-music-pip-button" onClick={onTogglePipMode} title="Alternar mini reproductor">
            <PixelIcon icon={PictureInPicture} size="sm" /> {pipMode ? "DOCK" : "POP OUT"}
        </button>
        <div className="youtube-music-dock-track">
            <img src={currentTrack?.albumArt || fallbackAlbumArt} alt={currentTrack?.title || "Sin reproducción"} />
            <div className="min-w-0"><strong>{currentTrack?.title || "SELECT A TRACK"}</strong><small>{currentTrack?.artist || "YouTube music mode"}</small></div>
        </div>
        <Visualizer isPlaying={isPlaying} analyser={analyser} onRequestCapture={onRequestCapture} bpm={bpm} bpmConfidence={bpmConfidence} beatSignal={beatSignal} />
        <div className="youtube-music-comments">
            <span>CHAT LOG</span>
            {commentsLoading ? <p>LOADING...</p> : comments.slice(0, 3).map((comment) => <p key={comment.id}><b>{comment.author}</b> {comment.text}</p>)}
            {!commentsLoading && !comments.length && <p>NO COMMENTS YET</p>}
        </div>
    </aside>
);

const CompactPlayerBar = ({ currentTrack, playlists, isPlaying, progress, volume, currentRating, ratingLoading, shuffleMode, repeatMode, currentTime, totalTime, connect, onPlayPause, onNext, onPrev, onShuffleCycle, onRepeatToggle, onSeek, onVolume, onRate, onQueueNext, onQueueLast, onClearQueue, onStartMix, onSaveToPlaylist, onTogglePipMode, onShare }: {
    currentTrack: CurrentTrack | null;
    playlists: Extract<YouTubeLibraryItem, { kind: "playlist" }>[];
    isPlaying: boolean;
    progress: number;
    volume: number;
    currentRating: "like" | "dislike" | "none";
    ratingLoading: boolean;
    shuffleMode: "off" | "shuffle" | "smart";
    repeatMode: number;
    currentTime: string;
    totalTime: string;
    connect: YouTubeConnectController;
    onPlayPause: () => void;
    onNext: () => void;
    onPrev: () => void;
    onShuffleCycle: () => void;
    onRepeatToggle: () => void;
    onSeek: (value: number) => void;
    onVolume: (value: number) => void;
    onRate: (rating: "like" | "dislike") => void;
    onQueueNext: () => void;
    onQueueLast: () => void;
    onClearQueue: () => void;
    onStartMix: () => void;
    onSaveToPlaylist: (playlistId: string, playlistTitle: string) => void;
    onTogglePipMode: () => void;
    onShare: () => void;
}) => (
    <footer className="youtube-music-playerbar">
        <div className="youtube-music-player-track">
            <img src={currentTrack?.albumArt || fallbackAlbumArt} alt={currentTrack?.title || "Sin reproducción"} />
            <span><strong>{currentTrack?.title || "NO TRACK SELECTED"}</strong><small>{currentTrack?.artist || "Choose music to begin"}</small></span>
        </div>
        <div className="youtube-music-player-center">
            <div className="youtube-music-player-buttons">
                <button
                    aria-label={shuffleMode === "smart" ? "Smart Shuffle activado" : shuffleMode === "shuffle" ? "Shuffle activado" : "Shuffle desactivado"}
                    className={shuffleMode === "smart" ? "is-on is-smart" : shuffleMode === "shuffle" ? "is-on" : ""}
                    onClick={onShuffleCycle}
                    title={shuffleMode === "smart" ? "SMART SHUFFLE" : shuffleMode === "shuffle" ? "SHUFFLE" : "SHUFFLE OFF"}
                >
                    <PixelIcon icon={Shuffle} size="sm" />
                    {shuffleMode === "smart" && <span className="youtube-music-smart-badge">S</span>}
                </button>
                <button onClick={onPrev}><PixelIcon icon={ArrowLeftBox} size="sm" /></button>
                <button className="is-primary" onClick={onPlayPause}>{isPlaying ? <span className="youtube-music-pause">Ⅱ</span> : <PixelIcon icon={Play} size="sm" />}</button>
                <button onClick={onNext}><PixelIcon icon={ArrowRightBox} size="sm" /></button>
                <button className={repeatMode > 0 ? "is-on" : ""} onClick={onRepeatToggle}><PixelIcon icon={Repeat} size="sm" /></button>
            </div>
            <div className="youtube-music-timeline"><time>{currentTime}</time><input aria-label="Progreso" type="range" min="0" max="100" value={progress} onChange={(event) => onSeek(Number(event.target.value))} /><time>{totalTime}</time></div>
        </div>
        <div className="youtube-music-player-utils">
            <Popover>
                <PopoverTrigger asChild>
                    <button
                        className={connect.isConnected ? "is-on youtube-connect-trigger" : "youtube-connect-trigger"}
                        title="Dev Hub Connect"
                        aria-label="Abrir Dev Hub Connect"
                    >
                        <PixelIcon icon={CloudServer} size="sm" />
                        {connect.isConnected && <span className={connect.isActiveDevice ? "youtube-connect-dot is-active" : "youtube-connect-dot"} />}
                    </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="end" className="youtube-connect-popover">
                    <div className="youtube-connect-heading">
                        <span>DEV HUB CONNECT</span>
                        <small>{connect.isConnected ? "LINK ONLINE" : "DEVICE HANDOFF"}</small>
                    </div>

                    {connect.isConnected && connect.session ? (
                        <div className="youtube-connect-session">
                            <div className="youtube-connect-status">
                                <span className={connect.isActiveDevice ? "is-active" : ""} />
                                <div>
                                    <strong>{connect.isActiveDevice ? "REPRODUCIENDO AQUÍ" : `ACTIVO EN ${connect.session.activeDeviceName.toUpperCase()}`}</strong>
                                    <small>{connect.session.track?.title || "Esperando una canción"}</small>
                                </div>
                            </div>
                            <button className="youtube-connect-code" onClick={() => void connect.copyCode()} title="Copiar código">
                                <span>{connect.formattedCode}</span>
                                <PixelIcon icon={Copy} size="sm" />
                            </button>
                            {!connect.isActiveDevice && (
                                <button className="retro-btn-primary youtube-connect-action" disabled={connect.busy} onClick={() => void connect.takeOver()}>
                                    {connect.busy ? "TRANSFIRIENDO..." : "REPRODUCIR AQUÍ"}
                                </button>
                            )}
                            <p className="youtube-connect-device">Este dispositivo: {connect.deviceName}</p>
                            <button className="youtube-connect-disconnect" onClick={connect.disconnect}>DESCONECTAR ESTE DISPOSITIVO</button>
                        </div>
                    ) : (
                        <div className="youtube-connect-setup">
                            <p>Crea una sesión o escribe el código que aparece en tu otro dispositivo.</p>
                            <button className="retro-btn-primary youtube-connect-action" disabled={connect.busy} onClick={() => void connect.createSession()}>
                                {connect.busy ? "CREANDO..." : "CREAR SESIÓN"}
                            </button>
                            <div className="youtube-connect-divider"><span>O</span></div>
                            <input
                                aria-label="Código de Dev Hub Connect"
                                autoComplete="off"
                                maxLength={19}
                                placeholder="XXXX-XXXX-XXXX-XXXX"
                                value={connect.joinCode}
                                onChange={(event) => connect.setJoinCode(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") void connect.joinSession();
                                }}
                            />
                            <button className="retro-btn-secondary youtube-connect-action" disabled={connect.busy || connect.joinCode.length < 19} onClick={() => void connect.joinSession()}>
                                UNIRME
                            </button>
                        </div>
                    )}
                    {connect.error && <p className="youtube-connect-error">{connect.error}</p>}
                    <p className="youtube-connect-note">Sincroniza Dev Hub con Dev Hub. No comparte tu token de YouTube.</p>
                </PopoverContent>
            </Popover>
            <button
                className={currentRating === "like" ? "is-on" : ""}
                disabled={!currentTrack || ratingLoading}
                onClick={() => onRate("like")}
                title="Me gusta"
                aria-label="Me gusta"
            ><PixelIcon icon={ThumbsUp} size="sm" /></button>
            <button
                className={currentRating === "dislike" ? "is-on" : ""}
                disabled={!currentTrack || ratingLoading}
                onClick={() => onRate("dislike")}
                title="No me gusta"
                aria-label="No me gusta"
            ><PixelIcon icon={ThumbsDown} size="sm" /></button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button disabled={!currentTrack} title="Más opciones" aria-label="Más opciones">
                        <PixelIcon icon={MoreVertical} size="sm" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="end" className="youtube-music-more-menu">
                    <DropdownMenuItem onSelect={onStartMix}>
                        <PixelIcon icon={Radio} size="sm" /> COMENZAR MIX
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={onQueueNext}>
                        <PixelIcon icon={ArrowRightBox} size="sm" /> REPRODUCIR A CONTINUACIÓN
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={onQueueLast}>
                        <PixelIcon icon={ListBox} size="sm" /> AGREGAR A LA FILA
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="youtube-music-more-subtrigger">
                            <PixelIcon icon={ListBox} size="sm" /> GUARDAR EN PLAYLIST
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="youtube-music-more-menu">
                            {playlists.length ? playlists.map((playlist) => (
                                <DropdownMenuItem key={playlist.playlistId} onSelect={() => onSaveToPlaylist(playlist.playlistId, playlist.title)}>
                                    {playlist.title}
                                </DropdownMenuItem>
                            )) : <DropdownMenuItem disabled>SIN PLAYLISTS</DropdownMenuItem>}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => onRate("like")}>
                        <PixelIcon icon={ThumbsUp} size="sm" />
                        {currentRating === "like" ? "QUITAR ME GUSTA" : "ME GUSTA"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onRate("dislike")}>
                        <PixelIcon icon={ThumbsDown} size="sm" />
                        {currentRating === "dislike" ? "QUITAR NO ME GUSTA" : "NO ME GUSTA"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={onShare}>
                        <PixelIcon icon={Link} size="sm" /> COMPARTIR
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={onTogglePipMode}>
                        <PixelIcon icon={PictureInPicture} size="sm" /> VENTANA FLOTANTE
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => currentTrack && window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(currentTrack.artist)}`, "_blank", "noopener,noreferrer")}>
                        <PixelIcon icon={User} size="sm" /> BUSCAR ARTISTA
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => currentTrack?.externalUrl && window.open(currentTrack.externalUrl, "_blank", "noopener,noreferrer")}>
                        <PixelIcon icon={ExternalLink} size="sm" /> ABRIR EN YOUTUBE
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={onClearQueue} className="youtube-music-menu-danger">
                        DESCARTAR FILA
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <button onClick={onShare} title="Compartir"><PixelIcon icon={Link} size="sm" /></button>
            <span>VOL</span>
            <input aria-label="Volumen" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => onVolume(Number(event.target.value))} />
        </div>
    </footer>
);

export default YoutubeMusicScreen;
