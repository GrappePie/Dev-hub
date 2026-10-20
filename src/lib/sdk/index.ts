import { loadScript } from "./loadScript";

export { loadScript } from "./loadScript";

export const SPOTIFY_SDK_SRC = "https://sdk.scdn.co/spotify-player.js";
export const YOUTUBE_IFRAME_API_SRC = "https://www.youtube.com/iframe_api";
export const GOOGLE_IDENTITY_SRC = "https://accounts.google.com/gsi/client";
export const SOUNDCLOUD_WIDGET_API_SRC = "https://w.soundcloud.com/player/api.js";

export const loadSpotifySdk = () =>
    loadScript(SPOTIFY_SDK_SRC, {
        isReady: () => Boolean(window.Spotify),
        readyCallback: "onSpotifyWebPlaybackSDKReady",
        errorMessage: "No se pudo cargar Spotify Web Playback SDK",
    });

export const loadYouTubeIframeApi = () =>
    loadScript(YOUTUBE_IFRAME_API_SRC, {
        isReady: () => Boolean(window.YT?.Player),
        readyCallback: "onYouTubeIframeAPIReady",
        errorMessage: "No se pudo cargar YouTube IFrame API",
    });

export const loadGoogleIdentity = () =>
    loadScript(GOOGLE_IDENTITY_SRC, {
        isReady: () => Boolean(window.google?.accounts?.oauth2),
        errorMessage: "No se pudo cargar Google Identity Services",
    });

export const loadSoundcloudWidgetApi = () =>
    loadScript(SOUNDCLOUD_WIDGET_API_SRC, {
        isReady: () => Boolean(window.SC?.Widget),
        errorMessage: "No se pudo cargar SoundCloud Widget API",
    });
