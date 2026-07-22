import defaultAlbumArt from "@/assets/album-art-placeholder.svg";
import AlbumArtDisplay from "./AlbumArtDisplay";
import PlayerControls from "./PlayerControls";
import QueuePanel from "./QueuePanel";
import CommentsPanel from "./CommentsPanel";
import type { CurrentTrack, QueueTrack } from "@/hooks/useSpotifyPlayer";
import type { YouTubeComment } from "@/hooks/useYoutubePlayer";
import type { MutableRefObject } from "react";

interface PlayerScreenProps {
    currentTrack: CurrentTrack | null;
    queueTracks: QueueTrack[];
    isPlaying: boolean;
    progress: number;
    volume: number;
    shuffleMode: "off" | "shuffle" | "smart";
    repeatMode: number;
    isLiked: boolean;
    currentTime: string;
    totalTime: string;
    onPlayPause: () => void;
    onNext: () => void;
    onPrev: () => void;
    onShuffleCycle: () => void;
    onRepeatToggle: () => void;
    onProgressChange: (value: number) => void;
    onVolumeChange: (value: number) => void;
    onLikeToggle: () => void;
    onShare: () => void;
    onQueueRefresh: () => void;
    onQueueTrackSelect: (trackId: string) => void;
    onArtistClick?: (name: string) => void;
    comments?: YouTubeComment[];
    commentsLoading?: boolean;
    analyser?: AnalyserNode | null;
    onRequestCapture?: () => void;
    playerHostRef?: (node: HTMLDivElement | null) => void;
    showVideo?: boolean;
    pipMode?: boolean;
    onToggleVideoMode?: () => void;
    onTogglePipMode?: () => void;
    bpm?: number | null;
    bpmConfidence?: number;
    beatSignal?: MutableRefObject<number>;
}

const PlayerScreen = ({
                          currentTrack,
                          queueTracks,
                          isPlaying,
                          progress,
                          volume,
                          shuffleMode,
                          repeatMode,
                          isLiked,
                          currentTime,
                          totalTime,
                          onPlayPause,
                          onNext,
                          onPrev,
                          onShuffleCycle,
                          onRepeatToggle,
                          onProgressChange,
                          onVolumeChange,
                          onLikeToggle,
                          onShare,
                          onQueueRefresh,
                          onQueueTrackSelect,
                          onArtistClick,
                          comments,
                          commentsLoading = false,
                          analyser,
                          onRequestCapture,
                          playerHostRef,
                          showVideo = false,
                          pipMode = false,
                          onToggleVideoMode,
                          onTogglePipMode,
                          bpm,
                          bpmConfidence,
                          beatSignal,
                      }: PlayerScreenProps) => {
    const activeTrack = currentTrack ?? {
        id: "fallback",
        uri: "",
        title: "Sin reproducción",
        artist: "Conecta tu Spotify para empezar",
        artistNames: ["Conecta tu Spotify para empezar"],
        albumArt: defaultAlbumArt,
        duration: "0:00",
        durationMs: 0,
    };

    const showComments = comments !== undefined;

    return (
        <div className="px-4 py-5 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 lg:gap-6">
                <AlbumArtDisplay
                    albumArt={activeTrack.albumArt}
                    title={activeTrack.title}
                    artist={activeTrack.artist}
                    artistNames={activeTrack.artistNames}
                    isPlaying={isPlaying}
                    isLiked={isLiked}
                    onLikeToggle={onLikeToggle}
                    onShare={onShare}
                    onArtistClick={onArtistClick}
                    analyser={analyser}
                    onRequestCapture={onRequestCapture}
                    playerHostRef={playerHostRef}
                    showVideo={showVideo}
                    pipMode={pipMode}
                    onToggleVideoMode={onToggleVideoMode}
                    onTogglePipMode={onTogglePipMode}
                    bpm={bpm}
                    bpmConfidence={bpmConfidence}
                    beatSignal={beatSignal}
                />

                <div className="space-y-5">
                    <PlayerControls
                        isPlaying={isPlaying}
                        shuffleMode={shuffleMode}
                        repeatMode={repeatMode}
                        progress={progress}
                        volume={volume}
                        currentTime={currentTime}
                        totalTime={totalTime || activeTrack.duration}
                        onPlayPause={onPlayPause}
                        onNext={onNext}
                        onPrev={onPrev}
                        onShuffleCycle={onShuffleCycle}
                        onRepeatToggle={onRepeatToggle}
                        onProgressChange={onProgressChange}
                        onVolumeChange={onVolumeChange}
                    />

                    <div className={`grid gap-5 ${showComments ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
                        <QueuePanel
                            tracks={queueTracks}
                            onRefresh={onQueueRefresh}
                            onTrackSelect={onQueueTrackSelect}
                        />
                        {showComments && (
                            <CommentsPanel
                                comments={comments!}
                                loading={commentsLoading}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlayerScreen;

