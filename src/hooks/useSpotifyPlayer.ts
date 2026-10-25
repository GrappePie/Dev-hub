import { useCallback, useMemo } from "react";
import { useSpotifyApi } from "@/hooks/spotify/useSpotifyApi";
import { useSpotifyAuth } from "@/hooks/spotify/useSpotifyAuth";
import { useSpotifyDevices } from "@/hooks/spotify/useSpotifyDevices";
import { useSpotifyKeyboardShortcuts } from "@/hooks/spotify/useSpotifyKeyboardShortcuts";
import { useSpotifyLibrary } from "@/hooks/spotify/useSpotifyLibrary";
import { useSpotifyPlayback } from "@/hooks/spotify/useSpotifyPlayback";
import { useSpotifyPreviewAudio } from "@/hooks/spotify/useSpotifyPreviewAudio";
import { useSpotifySdkPlayer } from "@/hooks/spotify/useSpotifySdkPlayer";
import { useSpotifySession } from "@/hooks/spotify/useSpotifySession";
import { useSpotifySessionCountdown } from "@/hooks/spotify/useSpotifySessionCountdown";
import { formatMs, toProgressPercent } from "@/lib/format";

export type { CurrentTrack, QueueTrack, ArtistData, ArtistTopTrack } from "@/types/player";

export type { DeviceItem, PlaylistItem, SearchAlbumItem, SearchArtistItem, SearchResults, SearchTrackItem } from "@/lib/spotify/types";

/**
 * Spotify provider facade (composition root).
 * The sub-hook call order is deliberate: React runs effects in declaration order, and this order
 * reproduces the effect sequence of the original single hook (preview audio, token mirrors, smart shuffle,
 * auth bootstrap + popup listener, SDK, session countdown, keyboard shortcuts).
 */
export const useSpotifyPlayer = () => {
    const previewAudioRef = useSpotifyPreviewAudio();

    const {
        accessToken,
        setAccessToken,
        setRefreshToken,
        tokenExpiresAt,
        setTokenExpiresAt,
        accessTokenRef,
        tokenExpiresAtRef,
        statusText,
        setStatusText,
        clearAuthState,
        applyTokenResponse,
        tokenRequest,
        refreshAccessToken,
    } = useSpotifySession();

    const api = useSpotifyApi({ accessTokenRef, refreshAccessToken });

    const {
        devices,
        activeDeviceName,
        fetchDevices,
        executeWithDeviceRecovery,
        transferPlayback,
        selectSdkDevice,
        resetDeviceSelection,
        clearDevices,
    } = useSpotifyDevices({ api });

    const {
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
    } = useSpotifyPlayback({ api, executeWithDeviceRecovery, setStatusText });

    const {
        playlists,
        playlistsLoading,
        playlistsHasMore,
        searchResults,
        searchLoading,
        loadPlaylists,
        ensureLibraryLoaded,
        searchCatalog,
        fetchPlaylistTracks,
        clearSearchResults,
        searchAndPlay,
        playPreviewForTrackId,
        playSearchTrack,
        fetchArtistData,
        resetLibrary,
    } = useSpotifyLibrary({ api, accessTokenRef, previewAudioRef, playUris });

    const { isAuthLoading, authFeedback, startLogin } = useSpotifyAuth({
        setAccessToken,
        setRefreshToken,
        setTokenExpiresAt,
        setStatusText,
        clearAuthState,
        applyTokenResponse,
        tokenRequest,
    });

    const sdkReady = useSpotifySdkPlayer({
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
    });

    const sessionCountdown = useSpotifySessionCountdown({ tokenExpiresAt, refreshAccessToken });

    useSpotifyKeyboardShortcuts({ accessToken, playerRef, togglePlayPause, setVolumeLevel, volume, fetchDevices });

    const logout = useCallback(() => {
        releasePlayer();
        resetDeviceSelection();
        clearAuthState();
        resetPlaybackState();
        clearDevices();
        resetLibrary();
        setStatusText("Sesion cerrada. Conectate de nuevo.");
    }, [clearAuthState, clearDevices, releasePlayer, resetDeviceSelection, resetLibrary, resetPlaybackState, setStatusText]);

    const progress = useMemo(() => toProgressPercent(positionMs, durationMs), [durationMs, positionMs]);

    return {
        isAuthenticated: Boolean(accessToken),
        isAuthLoading,
        sdkReady,
        statusText,
        sessionCountdown,
        currentTrack,
        queue,
        isPlaying,
        shuffleMode,
        repeatMode,
        volume,
        isLiked,
        progress,
        positionMs,
        durationMs,
        currentTime: formatMs(positionMs),
        totalTime: formatMs(durationMs || currentTrack?.durationMs || 0),
        devices,
        activeDeviceName,
        playlists,
        playlistsLoading,
        playlistsHasMore,
        searchResults,
        searchLoading,
        authFeedback,
        startLogin,
        logout,
        searchAndPlay,
        searchCatalog,
        fetchPlaylistTracks,
        clearSearchResults,
        playSearchTrack,
        playPreviewForTrackId,
        playAlbum,
        addToQueue,
        playFavorites,
        playPlaylist,
        ensureLibraryLoaded,
        loadPlaylists,
        fetchDevices,
        transferPlayback,
        togglePlayPause,
        nextTrack,
        prevTrack,
        cycleShuffle,
        cycleRepeat,
        seekToProgress,
        setVolumeLevel,
        toggleLike,
        shareCurrent,
        refreshQueue,
        playQueueTrack,
        fetchArtistData,
    };
};

export default useSpotifyPlayer;