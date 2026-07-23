import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type useSoundcloudPlayer from "@/hooks/useSoundcloudPlayer";
import type useSpotifyPlayer from "@/hooks/useSpotifyPlayer";
import type useYoutubePlayer from "@/hooks/useYoutubePlayer";
import type { MixyRoomController } from "@/hooks/useMixyRoom";
import {
    extrapolateMixyPosition,
    pickMixySource,
    type MixyProvider,
    type MixySource,
} from "@/lib/mixy";

type SpotifyPlayer = ReturnType<typeof useSpotifyPlayer>;
type YoutubePlayer = ReturnType<typeof useYoutubePlayer>;
type SoundcloudPlayer = ReturnType<typeof useSoundcloudPlayer>;

interface UseMixyPlaybackOptions {
    enabled: boolean;
    mixy: MixyRoomController;
    spotify: SpotifyPlayer;
    youtube: YoutubePlayer;
    soundcloud: SoundcloudPlayer;
}

const formatMs = (value: number) => {
    const seconds = Math.max(0, Math.floor(value / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

export const useMixyPlayback = ({ enabled, mixy, spotify, youtube, soundcloud }: UseMixyPlaybackOptions) => {
    const [activeProvider, setActiveProvider] = useState<MixyProvider | null>(null);
    const [syncOffsetMs, setSyncOffsetMs] = useState<number | null>(null);
    const [message, setMessage] = useState("ESPERANDO UNA CANCION");
    const handledRevisionRef = useRef("");
    const autoNextRevisionRef = useRef(-1);
    const scheduledRef = useRef<number>();
    const adaptersRef = useRef({ spotify, youtube, soundcloud });
    const syncStateRef = useRef({ room: mixy.room, serverOffsetMs: mixy.serverOffsetMs, source: null as MixySource | null });
    adaptersRef.current = { spotify, youtube, soundcloud };

    const providers = useMemo<MixyProvider[]>(() => {
        const next: MixyProvider[] = [];
        if (spotify.isAuthenticated) next.push("spotify");
        if (youtube.isReady) next.push("youtube");
        if (soundcloud.sdkReady) next.push("soundcloud");
        return next;
    }, [soundcloud.sdkReady, spotify.isAuthenticated, youtube.isReady]);

    const source = useMemo(
        () => mixy.activeTrack ? pickMixySource(mixy.activeTrack, providers) : null,
        [mixy.activeTrack, providers],
    );
    const sourceId = source?.id;
    const sourceProvider = source?.provider;
    syncStateRef.current = { room: mixy.room, serverOffsetMs: mixy.serverOffsetMs, source };

    const getAdapterState = useCallback((provider: MixyProvider) => {
        const players = adaptersRef.current;
        if (provider === "spotify") return {
            isPlaying: players.spotify.isPlaying,
            positionMs: players.spotify.positionMs,
            durationMs: players.spotify.durationMs,
        };
        if (provider === "youtube") return {
            isPlaying: players.youtube.isPlaying,
            positionMs: players.youtube.positionMs,
            durationMs: players.youtube.durationMs,
        };
        if (provider === "soundcloud") return {
            isPlaying: players.soundcloud.isPlaying,
            positionMs: players.soundcloud.positionMs,
            durationMs: players.soundcloud.durationMs,
        };
        return { isPlaying: false, positionMs: 0, durationMs: 0 };
    }, []);

    const seekSource = useCallback((activeSource: MixySource, targetMs: number) => {
        const players = adaptersRef.current;
        const state = getAdapterState(activeSource.provider);
        const duration = state.durationMs || activeSource.durationMs || syncStateRef.current.room?.playback.durationMs || 0;
        if (!duration) return;
        const progress = Math.max(0, Math.min(100, ((targetMs + activeSource.offsetMs) / duration) * 100));
        if (activeSource.provider === "spotify") players.spotify.seekToProgress(progress);
        if (activeSource.provider === "youtube") players.youtube.seekToProgress(progress);
        if (activeSource.provider === "soundcloud") players.soundcloud.seekToProgress(progress);
    }, [getAdapterState]);

    const setPlaying = useCallback((provider: MixyProvider, desired: boolean) => {
        const players = adaptersRef.current;
        const state = getAdapterState(provider);
        if (state.isPlaying === desired) return;
        if (provider === "spotify") void players.spotify.togglePlayPause();
        if (provider === "youtube") players.youtube.togglePlayPause();
        if (provider === "soundcloud") players.soundcloud.togglePlayPause();
    }, [getAdapterState]);

    const loadSource = useCallback((activeSource: MixySource) => {
        const players = adaptersRef.current;
        if (activeSource.provider === "spotify") {
            void players.spotify.playSearchTrack({
                id: activeSource.id,
                uri: activeSource.uri,
                name: activeSource.title,
                artist: activeSource.artist,
                image: activeSource.image,
            });
        }
        if (activeSource.provider === "youtube") {
            players.youtube.playSearchTrack({
                id: `mixy-${activeSource.id}`,
                videoId: activeSource.id,
                uri: activeSource.uri,
                title: activeSource.title,
                artist: activeSource.artist,
                image: activeSource.image,
                durationMs: activeSource.durationMs,
                duration: formatMs(activeSource.durationMs),
            });
        }
        if (activeSource.provider === "soundcloud") {
            players.soundcloud.loadTrack(activeSource.uri, true, {
                id: Number(activeSource.id) || Date.now(),
                title: activeSource.title,
                artist: activeSource.artist,
                artwork_url: activeSource.image,
                duration_ms: activeSource.durationMs,
            });
        }
    }, []);

    useEffect(() => {
        if (!enabled || !mixy.room || !mixy.ready || !mixy.activeTrack) {
            if (scheduledRef.current) window.clearTimeout(scheduledRef.current);
            handledRevisionRef.current = "";
            setActiveProvider(null);
            setSyncOffsetMs(null);
            setMessage(mixy.room && !mixy.ready ? "PULSA READY PARA ACTIVAR EL AUDIO" : "ESPERANDO UNA CANCION");
            return;
        }
        if (!source) {
            setActiveProvider(null);
            setSyncOffsetMs(null);
            setMessage("NINGUNA FUENTE COMPATIBLE EN ESTE DISPOSITIVO");
            return;
        }

        const playback = mixy.room.playback;
        const revisionKey = `${playback.trackId}:${playback.revision}:${source.provider}:${source.id}`;
        if (handledRevisionRef.current === revisionKey) return;
        if (scheduledRef.current) window.clearTimeout(scheduledRef.current);
        handledRevisionRef.current = revisionKey;
        setActiveProvider(source.provider);
        setMessage(`SYNC VIA ${source.provider.toUpperCase()}`);

        const now = Date.now() + mixy.serverOffsetMs;
        const delay = Math.max(0, playback.effectiveAt - now);
        const execute = () => {
            const state = getAdapterState(source.provider);
            const isSameTrack = source.provider === "spotify"
                ? adaptersRef.current.spotify.currentTrack?.id === source.id
                : source.provider === "youtube"
                    ? adaptersRef.current.youtube.currentTrack?.videoId === source.id
                    : String(adaptersRef.current.soundcloud.currentTrack?.id) === String(source.id);
            if (!isSameTrack) loadSource(source);
            window.setTimeout(() => {
                const target = extrapolateMixyPosition(playback, Date.now() + mixy.serverOffsetMs);
                seekSource(source, target);
                setPlaying(source.provider, playback.isPlaying);
                const current = getAdapterState(source.provider).positionMs;
                setSyncOffsetMs(current - target - source.offsetMs);
            }, isSameTrack ? 80 : 850);
            if (isSameTrack) setPlaying(source.provider, playback.isPlaying);
            void state;
        };
        scheduledRef.current = window.setTimeout(execute, delay);
    }, [enabled, getAdapterState, loadSource, mixy.activeTrack, mixy.ready, mixy.room, mixy.serverOffsetMs, seekSource, setPlaying, source]);

    useEffect(() => () => {
        if (scheduledRef.current) window.clearTimeout(scheduledRef.current);
    }, []);

    useEffect(() => {
        if (!enabled || !mixy.ready || !sourceId || !sourceProvider) return;
        const interval = window.setInterval(() => {
            const state = syncStateRef.current;
            if (!state.room?.playback.isPlaying || !state.source) return;
            const target = extrapolateMixyPosition(state.room.playback, Date.now() + state.serverOffsetMs);
            const local = getAdapterState(state.source.provider).positionMs - state.source.offsetMs;
            const offset = local - target;
            setSyncOffsetMs(Math.round(offset));
            if (Math.abs(offset) > 1_200) seekSource(state.source, target);
        }, 4_000);
        return () => window.clearInterval(interval);
    }, [enabled, getAdapterState, mixy.ready, seekSource, sourceId, sourceProvider]);

    useEffect(() => {
        const playback = mixy.room?.playback;
        if (!enabled || !mixy.isHost || !playback?.isPlaying || !mixy.activeTrack) return;
        if (!playback.durationMs || autoNextRevisionRef.current === playback.revision) return;
        const remaining = playback.durationMs - extrapolateMixyPosition(playback, Date.now() + mixy.serverOffsetMs);
        if (remaining > 800) return;
        autoNextRevisionRef.current = playback.revision;
        void mixy.control({ type: "next" });
    }, [enabled, mixy]);

    return { providers, source, activeProvider, syncOffsetMs, message };
};

export default useMixyPlayback;
