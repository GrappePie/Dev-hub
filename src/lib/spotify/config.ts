import { getDefaultRedirectUri } from "@/lib/oauth";
import type { SearchResults } from "@/lib/spotify/types";

export const SPOTIFY_STORAGE_KEYS = {
    ACCESS_TOKEN: "spotify_access_token",
    REFRESH_TOKEN: "spotify_refresh_token",
    EXPIRES_AT: "spotify_token_expires_at",
    CODE_VERIFIER: "spotify_code_verifier",
    OAUTH_STATE: "spotify_oauth_state",
    VOLUME: "mh_vol",
} as const;

const normalizeRedirectUri = (uri: string) => {
    try {
        const parsed = new URL(uri.trim());
        if (parsed.hostname === "localhost") {
            parsed.hostname = "127.0.0.1";
        }
        return parsed.toString();
    } catch {
        return uri.trim();
    }
};

export const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || "70c6ed29b0e84d2ca00a2a9d157520cc";
// Evaluated once at module load so the authorize request and the token exchange always send the same redirect_uri.
export const SPOTIFY_REDIRECT_URI = normalizeRedirectUri(import.meta.env.VITE_SPOTIFY_REDIRECT_URI || getDefaultRedirectUri());
/** Prefix of the OAuth `state`, used to tell Spotify callbacks apart from other providers sharing the redirect URI. */
export const SPOTIFY_STATE_PREFIX = "sp_";
export const SPOTIFY_SCOPES = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-library-read",
    "user-read-playback-state",
    "user-modify-playback-state",
    "playlist-read-private",
    "playlist-read-collaborative",
    "user-library-modify",
    "user-read-currently-playing",
].join(" ");

export const SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
export const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
export const SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1";

export const SPOTIFY_OAUTH_MESSAGE_TYPE = "spotify-oauth-callback";
export const SPOTIFY_OAUTH_POPUP_NAME = "spotify_oauth_popup";

export const EMPTY_SEARCH_RESULTS: SearchResults = {
    tracks: [],
    albums: [],
    artists: [],
};
