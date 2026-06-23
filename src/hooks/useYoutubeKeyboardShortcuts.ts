import { useEffect } from "react";
import type useYoutubePlayer from "@/hooks/useYoutubePlayer";

type YoutubePlayer = ReturnType<typeof useYoutubePlayer>;

export function useYoutubeKeyboardShortcuts(
    youtube: YoutubePlayer,
    isYouTubeMode: boolean,
    volumeBeforeMuteRef: React.MutableRefObject<number>,
) {
    useEffect(() => {
        if (!isYouTubeMode) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.target as HTMLElement)?.closest("input, textarea")) return;

            if (event.code === "Space") {
                event.preventDefault();
                youtube.togglePlayPause();
                return;
            }
            if (event.code === "ArrowRight") {
                event.preventDefault();
                const step = youtube.durationMs > 0 ? (5000 / youtube.durationMs) * 100 : 5;
                youtube.seekToProgress(Math.min(100, youtube.progress + step));
                return;
            }
            if (event.code === "ArrowLeft") {
                event.preventDefault();
                const step = youtube.durationMs > 0 ? (5000 / youtube.durationMs) * 100 : 5;
                youtube.seekToProgress(Math.max(0, youtube.progress - step));
                return;
            }
            if (event.code === "ArrowUp") {
                event.preventDefault();
                youtube.setVolumeLevel(Math.min(1, youtube.volume + 0.05));
                return;
            }
            if (event.code === "ArrowDown") {
                event.preventDefault();
                youtube.setVolumeLevel(Math.max(0, youtube.volume - 0.05));
                return;
            }
            if (event.code === "KeyM") {
                event.preventDefault();
                if (youtube.volume > 0.01) {
                    volumeBeforeMuteRef.current = youtube.volume;
                    youtube.setVolumeLevel(0);
                } else {
                    youtube.setVolumeLevel(Math.max(0.15, volumeBeforeMuteRef.current || 0.5));
                }
                return;
            }
            if (event.code === "KeyN") {
                event.preventDefault();
                youtube.nextTrack();
                return;
            }
            if (event.code === "KeyB") {
                event.preventDefault();
                youtube.prevTrack();
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isYouTubeMode, youtube, volumeBeforeMuteRef]);
}
