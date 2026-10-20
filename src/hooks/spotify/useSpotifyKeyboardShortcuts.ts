import { useEffect } from "react";
import type { MutableRefObject } from "react";
import type { DeviceItem } from "@/lib/spotify/types";

interface UseSpotifyKeyboardShortcutsParams {
    accessToken: string | null;
    playerRef: MutableRefObject<SpotifyPlayer | null>;
    togglePlayPause: () => Promise<void>;
    setVolumeLevel: (value: number) => Promise<void>;
    volume: number;
    fetchDevices: () => Promise<DeviceItem[]>;
}

/** Global shortcuts while authenticated: Space play/pause, Left/Right seek 5s, Up/Down volume, M refresh devices. */
export const useSpotifyKeyboardShortcuts = ({
    accessToken,
    playerRef,
    togglePlayPause,
    setVolumeLevel,
    volume,
    fetchDevices,
}: UseSpotifyKeyboardShortcutsParams) => {
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
    }, [accessToken, fetchDevices, setVolumeLevel, togglePlayPause, volume, playerRef]);
};
