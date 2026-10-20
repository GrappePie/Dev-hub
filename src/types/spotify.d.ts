export {};

declare global {
    interface Window {
        onSpotifyWebPlaybackSDKReady?: () => void;
        onYouTubeIframeAPIReady?: () => void;
        Spotify?: {
            Player: new (options: {
                name: string;
                getOAuthToken: (cb: (token: string) => void) => void;
                volume?: number;
            }) => SpotifyPlayer;
        };
        YT?: YouTubeNamespace;
        google?: GoogleIdentity;
        SC?: {
            Widget: SoundcloudWidgetFactory;
        };
    }

    interface SpotifyPlayerError {
        message: string;
    }

    interface SpotifyPlayerEventMap {
        ready: { device_id: string };
        not_ready: { device_id: string };
        player_state_changed: SpotifyPlayerState | null;
        autoplay_failed: undefined;
        initialization_error: SpotifyPlayerError;
        authentication_error: SpotifyPlayerError;
        account_error: SpotifyPlayerError;
        playback_error: SpotifyPlayerError;
    }

    interface SpotifyPlayer {
        connect: () => Promise<boolean>;
        disconnect: () => void;
        addListener: <E extends keyof SpotifyPlayerEventMap>(
            event: E,
            cb: (payload: SpotifyPlayerEventMap[E]) => void
        ) => boolean;
        removeListener: <E extends keyof SpotifyPlayerEventMap>(
            event: E,
            cb?: (payload: SpotifyPlayerEventMap[E]) => void
        ) => boolean;
        togglePlay: () => Promise<void>;
        nextTrack: () => Promise<void>;
        previousTrack: () => Promise<void>;
        seek: (positionMs: number) => Promise<void>;
        getCurrentState: () => Promise<SpotifyPlayerState | null>;
        setVolume: (volume: number) => Promise<void>;
    }

    interface SpotifyPlayerState {
        paused: boolean;
        position: number;
        duration: number;
        repeat_mode: 0 | 1 | 2;
        shuffle: boolean;
        track_window: {
            current_track: SpotifyWebTrack;
            next_tracks: SpotifyWebTrack[];
        };
    }

    interface SpotifyWebTrack {
        id: string;
        uri: string;
        name: string;
        duration_ms: number;
        type?: string;
        is_local?: boolean;
        artists?: Array<{ id?: string; name: string; uri?: string }>;
        album?: {
            name?: string;
            images?: Array<{
                url: string;
                width?: number;
                height?: number;
            }>;
        };
        external_urls?: {
            spotify?: string;
        };
    }

    interface SoundcloudWidgetFactory {
        (iframe: HTMLIFrameElement): SoundcloudWidget;
        Events: {
            READY: string;
            PLAY: string;
            PAUSE: string;
            FINISH: string;
            PLAY_PROGRESS: string;
            ERROR: string;
        };
    }

    /** Payload passed by the SoundCloud Widget API to event callbacks. */
    interface SoundcloudWidgetEventData {
        currentPosition?: number;
        relativePosition?: number;
        loadProgress?: number;
        soundId?: number;
    }

    interface SoundcloudSound {
        id?: number | string;
        title?: string;
        permalink_url?: string;
        artwork_url?: string | null;
        duration?: number;
        user?: {
            id?: number | string;
            username?: string;
            avatar_url?: string | null;
        };
    }

    interface SoundcloudWidget {
        bind: (event: string, callback: (data?: SoundcloudWidgetEventData) => void) => void;
        unbind: (event: string) => void;
        load: (
            url: string,
            options?: {
                auto_play?: boolean;
                hide_related?: boolean;
                show_comments?: boolean;
                show_user?: boolean;
                show_reposts?: boolean;
                visual?: boolean;
            }
        ) => void;
        play: () => void;
        pause: () => void;
        toggle: () => void;
        next: () => void;
        prev: () => void;
        seekTo: (milliseconds: number) => void;
        setVolume: (value: number) => void;
        getVolume: (callback: (value: number) => void) => void;
        getDuration: (callback: (milliseconds: number) => void) => void;
        getPosition: (callback: (milliseconds: number) => void) => void;
        getCurrentSound: (callback: (sound: SoundcloudSound | null) => void) => void;
    }

    interface YouTubeNamespace {
        Player: new (element: HTMLElement | string, options: YouTubePlayerOptions) => YouTubePlayer;
        PlayerState: {
            UNSTARTED: -1;
            ENDED: 0;
            PLAYING: 1;
            PAUSED: 2;
            BUFFERING: 3;
            CUED: 5;
        };
    }

    interface YouTubePlayerOptions {
        width?: string;
        height?: string;
        videoId?: string;
        playerVars?: Record<string, string | number>;
        events?: {
            onReady?: (event: { target: YouTubePlayer }) => void;
            onStateChange?: (event: { data: number; target: YouTubePlayer }) => void;
            onError?: (event: { data: number; target: YouTubePlayer }) => void;
        };
    }

    interface YouTubePlayer {
        playVideo: () => void;
        pauseVideo: () => void;
        loadVideoById: (videoId: string) => void;
        cueVideoById: (videoId: string) => void;
        getPlayerState: () => number;
        getCurrentTime: () => number;
        getDuration: () => number;
        setVolume: (volume: number) => void;
        setSize: (width: number, height: number) => void;
        seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
        destroy: () => void;
    }

    interface GoogleTokenClientConfig {
        client_id: string;
        scope: string;
        callback: (response: GoogleTokenResponse) => void;
        error_callback?: (error: unknown) => void;
    }

    interface GoogleTokenClient {
        callback: (response: GoogleTokenResponse) => void;
        requestAccessToken: (options?: { prompt?: string }) => void;
    }

    interface GoogleTokenResponse {
        access_token?: string;
        expires_in?: number;
        error?: string;
        error_description?: string;
    }

    interface GoogleOauth2 {
        initTokenClient: (config: GoogleTokenClientConfig) => GoogleTokenClient;
    }

    interface GoogleAccounts {
        oauth2: GoogleOauth2;
    }

    interface GoogleIdentity {
        accounts: GoogleAccounts;
    }
}
