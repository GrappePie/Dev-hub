import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "@/hooks/use-toast";
import { clamp01 } from "@/lib/format";
import { getNextShuffleMode } from "@/lib/shuffleMode";
import { extractSpotifyErrorMessage } from "@/lib/spotify/http";
import { mapQueue, mapTrack } from "@/lib/spotify/mappers";
import { spotifyVolumeStore } from "@/lib/spotify/storage";
import type { ExecuteWithDeviceRecovery, SpotifyApiRequest, SpotifyRecommendationsResponse } from "@/lib/spotify/types";
import { getSmartShuffleCandidate, getSpotifyArtistTopTracksPath, getSpotifyRecommendationsPath } from "@/lib/spotifySmartShuffle";
import type { CurrentTrack, QueueTrack, ShuffleMode } from "@/types/player";

interface UseSpotifyPlaybackParams {
    api: SpotifyApiRequest;
    executeWithDeviceRecovery: ExecuteWithDeviceRecovery;
    setStatusText: Dispatch<SetStateAction<string>>;
}

/**
 * Playback state synced from the Web Playback SDK and the playback commands
 * (play, queue, transport, shuffle/smart shuffle, repeat, seek, volume, like, share).
 */
export const useSpotifyPlayback = ({ api, executeWithDeviceRecovery, setStatusText }: UseSpotifyPlaybackParams) => {
    const playerRef = useRef<SpotifyPlayer | null>(null);
    const lastLikeTrackIdRef = useRef<string | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [shuffleMode, setShuffleMode] = useState<ShuffleMode>("off");
    const shuffleModeRef = useRef<ShuffleMode>("off");
    const prevSmartTrackIdRef = useRef<string | null>(null);
    const [repeatMode, setRepeatMode] = useState(0);
    const [volume, setVolume] = useState(spotifyVolumeStore.read);
    const [positionMs, setPositionMs] = useState(0);
    const [durationMs, setDurationMs] = useState(0);
    const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null);
    const [queue, setQueue] = useState<QueueTrack[]>([]);
    const [isLiked, setIsLiked] = useState(false);

    const updateLikeStatus = useCallback(
        async (trackId?: string | null) => {
            if (!trackId) {
                setIsLiked(false);
                return;
            }
            if (lastLikeTrackIdRef.current === trackId) return;
            lastLikeTrackIdRef.current = trackId;
            const response = await api(`/me/tracks/contains?ids=${trackId}`, {}, { silent: true });
            if (!response.ok) return;
            const data = (await response.json()) as boolean[];
            setIsLiked(Boolean(data?.[0]));
        },
        [api]
    );

    const syncFromPlayerState = useCallback(
        async (state: SpotifyPlayerState | null) => {
            if (!state) return;
            const mappedTrack = mapTrack(state.track_window?.current_track);
            setCurrentTrack(mappedTrack);
            setIsPlaying(!state.paused);
            setPositionMs(state.position || 0);
            setDurationMs(state.duration || mappedTrack?.durationMs || 0);
            setRepeatMode(state.repeat_mode || 0);
            setQueue(mapQueue(state.track_window?.next_tracks || []));
            await updateLikeStatus(mappedTrack?.id);
        },
        [updateLikeStatus]
    );

    const notifyCommandFailure = useCallback(async (response: Response | null, fallback = "No se pudo ejecutar el comando de reproduccion.") => {
        if (!response) return;
        if (response.ok) return;
        const msg = await extractSpotifyErrorMessage(response);
        toast({
            variant: "destructive",
            title: "Error de Spotify",
            description: msg ? `La API respondio ${response.status} · ${msg}.` : fallback,
        });
    }, []);

    const loadFavorites = useCallback(async () => {
        setStatusText('Cargando tus "Me Gusta"...');
        const response = await api("/me/tracks?limit=50");
        if (!response.ok) {
            setStatusText("No se pudieron cargar tus favoritos.");
            return [] as SpotifyWebTrack[];
        }
        const data = (await response.json()) as { items?: Array<{ track: SpotifyWebTrack }> };
        const tracks = (data.items || []).map((item) => item.track).filter(Boolean);
        setStatusText(tracks.length ? "Favoritos cargados." : "No tienes favoritos cargados.");
        return tracks;
    }, [api, setStatusText]);

    const playUris = useCallback(
        async (uris: string[]) => {
            if (!uris.length) return;
            const response = await executeWithDeviceRecovery((deviceId) =>
                api(`/me/player/play?device_id=${deviceId}`, {
                    method: "PUT",
                    body: JSON.stringify({ uris }),
                }, { silent: true })
            );
            if (!response) return;
            if (!response.ok) {
                await notifyCommandFailure(response, "No se pudo iniciar la reproduccion.");
                return;
            }
            setStatusText("Reproduciendo...");
        },
        [api, executeWithDeviceRecovery, notifyCommandFailure, setStatusText]
    );

    const refreshQueue = useCallback(async () => {
        const state = await playerRef.current?.getCurrentState();
        if (state) setQueue(mapQueue(state.track_window?.next_tracks || []));
    }, []);

    const addToQueue = useCallback(
        async (uri: string) => {
            if (!uri) return;
            const response = await executeWithDeviceRecovery((deviceId) =>
                api(`/me/player/queue?uri=${encodeURIComponent(uri)}&device_id=${deviceId}`, {
                    method: "POST",
                }, { silent: true })
            );
            if (!response) return;
            if (!response.ok) {
                await notifyCommandFailure(response, "No se pudo agregar a la cola.");
                return;
            }
            toast({ title: "Cola actualizada", description: "Cancion agregada a la cola." });
            await refreshQueue();
        },
        [api, executeWithDeviceRecovery, notifyCommandFailure, refreshQueue]
    );

    const playFavorites = useCallback(async () => {
        const favorites = await loadFavorites();
        if (!favorites.length) {
            toast({ title: "Sin canciones", description: "No se encontraron favoritos para reproducir." });
            return;
        }
        await playUris(favorites.map((track) => track.uri));
    }, [loadFavorites, playUris]);

    const playPlaylist = useCallback(
        async (playlistId: string) => {
            if (!playlistId) return;
            const response = await executeWithDeviceRecovery((deviceId) =>
                api(`/me/player/play?device_id=${deviceId}`, {
                    method: "PUT",
                    body: JSON.stringify({ context_uri: `spotify:playlist:${playlistId}` }),
                }, { silent: true })
            );
            if (!response) return;
            if (!response.ok) {
                await notifyCommandFailure(response, "No se pudo reproducir la playlist.");
                return;
            }
            setStatusText("Reproduciendo playlist...");
        },
        [api, executeWithDeviceRecovery, notifyCommandFailure, setStatusText]
    );

    const playAlbum = useCallback(
        async (albumId: string) => {
            if (!albumId) return;
            const response = await executeWithDeviceRecovery((deviceId) =>
                api(`/me/player/play?device_id=${deviceId}`, {
                    method: "PUT",
                    body: JSON.stringify({ context_uri: `spotify:album:${albumId}` }),
                }, { silent: true })
            );
            if (!response) return;
            if (!response.ok) {
                await notifyCommandFailure(response, "No se pudo reproducir el album.");
                return;
            }
            setStatusText("Reproduciendo album...");
        },
        [api, executeWithDeviceRecovery, notifyCommandFailure, setStatusText]
    );

    const togglePlayPause = useCallback(async () => {
        if (!currentTrack) {
            await playFavorites();
            return;
        }
        await playerRef.current?.togglePlay();
    }, [currentTrack, playFavorites]);

    const nextTrack = useCallback(async () => {
        await playerRef.current?.nextTrack();
    }, []);

    const prevTrack = useCallback(async () => {
        await playerRef.current?.previousTrack();
    }, []);

    const queueRecommendation = useCallback(
        async (track: CurrentTrack) => {
            let response = await api(getSpotifyRecommendationsPath(track.id), {}, { silent: true });
            if (!response.ok && track.artistId) {
                response = await api(getSpotifyArtistTopTracksPath(track.artistId), {}, { silent: true });
            }
            if (!response.ok) return;
            const data = (await response.json()) as SpotifyRecommendationsResponse;
            const pickUri = getSmartShuffleCandidate(data.tracks || [], track.id)?.uri;
            if (!pickUri) return;
            await executeWithDeviceRecovery((deviceId) =>
                api(
                    `/me/player/queue?uri=${encodeURIComponent(pickUri)}&device_id=${deviceId}`,
                    { method: "POST" },
                    { silent: true }
                )
            );
        },
        [api, executeWithDeviceRecovery]
    );

    useEffect(() => {
        shuffleModeRef.current = shuffleMode;
    }, [shuffleMode]);

    useEffect(() => {
        if (shuffleMode !== "smart" || !currentTrack?.id) return;
        if (currentTrack.id === prevSmartTrackIdRef.current) return;
        prevSmartTrackIdRef.current = currentTrack.id;
        void queueRecommendation(currentTrack);
    }, [currentTrack, shuffleMode, queueRecommendation]);

    const cycleShuffle = useCallback(async () => {
        const next = getNextShuffleMode(shuffleMode, { smart: true });
        const spotifyNative = next === "shuffle";
        const response = await executeWithDeviceRecovery((deviceId) =>
            api(`/me/player/shuffle?state=${spotifyNative}&device_id=${deviceId}`, { method: "PUT" }, { silent: true })
        );
        if (!response?.ok) {
            await notifyCommandFailure(response || null, "No se pudo cambiar el modo shuffle.");
            return;
        }
        setShuffleMode(next);
        shuffleModeRef.current = next;
        if (next !== "smart") prevSmartTrackIdRef.current = null;
    }, [api, executeWithDeviceRecovery, shuffleMode, notifyCommandFailure]);

    const cycleRepeat = useCallback(async () => {
        const modes = ["off", "context", "track"] as const;
        const nextMode = ((repeatMode + 1) % 3) as 0 | 1 | 2;
        const response = await executeWithDeviceRecovery((deviceId) =>
            api(`/me/player/repeat?state=${modes[nextMode]}&device_id=${deviceId}`, { method: "PUT" }, { silent: true })
        );
        if (!response?.ok) {
            await notifyCommandFailure(response || null, "No se pudo cambiar el modo repeat.");
            return;
        }
        setRepeatMode(nextMode);
    }, [api, executeWithDeviceRecovery, notifyCommandFailure, repeatMode]);

    const seekToProgress = useCallback(
        async (pct: number) => {
            const target = Math.max(0, Math.min(100, pct));
            const position = Math.floor((target / 100) * (durationMs || 0));
            await playerRef.current?.seek(position);
            setPositionMs(position);
        },
        [durationMs]
    );

    const setVolumeLevel = useCallback(async (value: number) => {
        const nextVolume = clamp01(value);
        setVolume(nextVolume);
        spotifyVolumeStore.write(nextVolume);
        await playerRef.current?.setVolume(nextVolume);
    }, []);

    const toggleLike = useCallback(async () => {
        if (!currentTrack?.id) return;
        const method = isLiked ? "DELETE" : "PUT";
        await api(`/me/tracks?ids=${currentTrack.id}`, { method });
        setIsLiked((prev) => !prev);
        toast({
            title: isLiked ? "Quitado de favoritos" : "Guardado en favoritos",
            description: currentTrack.title,
        });
    }, [api, currentTrack, isLiked]);

    const shareCurrent = useCallback(async () => {
        if (!currentTrack?.externalUrl) return;
        await navigator.clipboard.writeText(currentTrack.externalUrl);
        toast({ title: "Enlace copiado", description: currentTrack.title });
    }, [currentTrack]);

    const playQueueTrack = useCallback(
        async (track: QueueTrack) => {
            if (!track.uri) return;
            await playUris([track.uri]);
        },
        [playUris]
    );

    const releasePlayer = useCallback(() => {
        playerRef.current?.disconnect();
        playerRef.current = null;
    }, []);

    const resetPlaybackState = useCallback(() => {
        setCurrentTrack(null);
        setQueue([]);
        setIsPlaying(false);
        setPositionMs(0);
        setDurationMs(0);
    }, []);

    return {
        playerRef,
        isPlaying,
        shuffleMode,
        repeatMode,
        volume,
        positionMs,
        setPositionMs,
        durationMs,
        currentTrack,
        queue,
        isLiked,
        syncFromPlayerState,
        loadFavorites,
        playUris,
        refreshQueue,
        addToQueue,
        playFavorites,
        playPlaylist,
        playAlbum,
        togglePlayPause,
        nextTrack,
        prevTrack,
        cycleShuffle,
        cycleRepeat,
        seekToProgress,
        setVolumeLevel,
        toggleLike,
        shareCurrent,
        playQueueTrack,
        releasePlayer,
        resetPlaybackState,
    };
};
