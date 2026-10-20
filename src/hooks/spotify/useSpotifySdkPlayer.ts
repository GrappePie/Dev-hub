import { useEffect, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { toast } from "@/hooks/use-toast";
import { loadSpotifySdk } from "@/lib/sdk";
import type { DeviceItem } from "@/lib/spotify/types";

interface UseSpotifySdkPlayerParams {
    accessToken: string | null;
    accessTokenRef: MutableRefObject<string | null>;
    tokenExpiresAtRef: MutableRefObject<number | null>;
    refreshAccessToken: () => Promise<boolean>;
    setStatusText: Dispatch<SetStateAction<string>>;
    playerRef: MutableRefObject<SpotifyPlayer | null>;
    selectSdkDevice: (deviceId: string) => void;
    transferPlayback: (deviceId: string, opts?: { notify?: boolean }) => Promise<boolean>;
    fetchDevices: () => Promise<DeviceItem[]>;
    loadFavorites: () => Promise<SpotifyWebTrack[]>;
    syncFromPlayerState: (state: SpotifyPlayerState | null) => Promise<void>;
    volume: number;
    isPlaying: boolean;
    durationMs: number;
    setPositionMs: Dispatch<SetStateAction<number>>;
}

/**
 * Web Playback SDK lifecycle: script loading, browser player creation/teardown, SDK event wiring
 * and local position interpolation between SDK state events.
 */
export const useSpotifySdkPlayer = ({
    accessToken,
    accessTokenRef,
    tokenExpiresAtRef,
    refreshAccessToken,
    setStatusText,
    playerRef,
    selectSdkDevice,
    transferPlayback,
    fetchDevices,
    loadFavorites,
    syncFromPlayerState,
    volume,
    isPlaying,
    durationMs,
    setPositionMs,
}: UseSpotifySdkPlayerParams) => {
    const sdkAuthRecoveringRef = useRef(false);
    const [sdkReady, setSdkReady] = useState(false);

    useEffect(() => {
        let active = true;
        loadSpotifySdk()
            .then(() => {
                if (active) setSdkReady(true);
            })
            .catch((error) => console.error(error));
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!accessToken || !sdkReady || playerRef.current || !window.Spotify?.Player) return;

        const player = new window.Spotify.Player({
            name: "Dev Hub Web Player",
            getOAuthToken: (cb) => {
                (async () => {
                    try {
                        const token = accessTokenRef.current;
                        const expiresAt = tokenExpiresAtRef.current;
                        const shouldRefresh = !token || (expiresAt && Date.now() >= (expiresAt - 60000));
                        if (shouldRefresh) {
                            await refreshAccessToken();
                        }
                    } catch (err) {
                        console.error("Error refreshing token for Spotify SDK:", err);
                    }
                    cb(accessTokenRef.current || "");
                })();
            },
            volume,
        });
        playerRef.current = player;

        const handleReady = ({ device_id }: { device_id: string }) => {
            selectSdkDevice(device_id);
            void transferPlayback(device_id, { notify: false });
            void loadFavorites();
            void fetchDevices();
            setStatusText("Player conectado.");
        };

        const handleStateChanged = (state: SpotifyPlayerState | null) => {
            void syncFromPlayerState(state);
        };

        const handleAuthError = ({ message }: { message: string }) => {
            console.error(message);
            if (sdkAuthRecoveringRef.current) return;
            sdkAuthRecoveringRef.current = true;
            setStatusText("Spotify SDK reporto error de autenticacion. Reintentando...");
            toast({
                variant: "destructive",
                title: "Sesion de reproduccion inestable",
                description: "Se detecto un error del SDK. Intentaremos recuperar la sesion sin cerrarte.",
            });
            void refreshAccessToken().finally(() => {
                sdkAuthRecoveringRef.current = false;
            });
        };

        player.addListener("ready", handleReady);
        player.addListener("player_state_changed", handleStateChanged);
        player.addListener("authentication_error", handleAuthError);
        player.addListener("account_error", ({ message }: { message: string }) => {
            console.error(message);
            setStatusText("Tu cuenta de Spotify no permite Web Playback SDK (normalmente requiere Premium).");
            toast({
                variant: "destructive",
                title: "Cuenta no compatible",
                description: "Spotify Web Playback SDK suele requerir cuenta Premium.",
            });
        });
        player.addListener("initialization_error", ({ message }: { message: string }) => console.error(message));
        player.addListener("playback_error", ({ message }: { message: string }) => console.error(message));

        void player.connect();

        return () => {
            player.removeListener("ready", handleReady);
            player.removeListener("player_state_changed", handleStateChanged);
            player.removeListener("authentication_error", handleAuthError);
            player.disconnect();
            if (playerRef.current === player) playerRef.current = null;
        };
    }, [
        accessToken,
        fetchDevices,
        loadFavorites,
        refreshAccessToken,
        sdkReady,
        syncFromPlayerState,
        transferPlayback,
        accessTokenRef,
        playerRef,
        selectSdkDevice,
        setStatusText,
        tokenExpiresAtRef,
    ]);

    // The SDK only emits state changes, so the position is advanced locally while playing.
    useEffect(() => {
        if (!isPlaying || !durationMs) return;
        const interval = setInterval(() => {
            setPositionMs((prev) => Math.min(durationMs, prev + 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [durationMs, isPlaying, setPositionMs]);

    return sdkReady;
};
