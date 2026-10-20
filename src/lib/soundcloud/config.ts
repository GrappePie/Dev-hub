import { getDefaultRedirectUri } from "@/lib/oauth";

export const SOUNDCLOUD_API_BASE = "https://api.soundcloud.com";
export const SOUNDCLOUD_AUTHORIZE_URL = "https://secure.soundcloud.com/authorize";
export const SOUNDCLOUD_TOKEN_URL = "https://secure.soundcloud.com/oauth/token";
/** Prefix of the OAuth `state`, used to tell SoundCloud callbacks apart from other providers sharing the redirect URI. */
export const SOUNDCLOUD_STATE_PREFIX = "sc_";
export const SOUNDCLOUD_OAUTH_MESSAGE_TYPE = "soundcloud-oauth-callback";
export const SOUNDCLOUD_OAUTH_POPUP_NAME = "soundcloud_oauth_popup";

export const SOUNDCLOUD_CLIENT_ID = import.meta.env.VITE_SOUNDCLOUD_CLIENT_ID || "";
export const SOUNDCLOUD_CLIENT_SECRET = import.meta.env.VITE_SOUNDCLOUD_CLIENT_SECRET || "";
export const SOUNDCLOUD_REDIRECT_URI = import.meta.env.VITE_SOUNDCLOUD_REDIRECT_URI || getDefaultRedirectUri();

export const DEFAULT_TRACK_URL = "https://soundcloud.com/forss/flickermood";

export const SOUNDCLOUD_STORAGE_KEYS = {
    ACCESS_TOKEN: "sc_access_token",
    REFRESH_TOKEN: "sc_refresh_token",
    EXPIRES_AT: "sc_token_expires_at",
    OAUTH_STATE: "sc_oauth_state",
} as const;

export const hasSoundcloudCredentials = () => Boolean(SOUNDCLOUD_CLIENT_ID && SOUNDCLOUD_CLIENT_SECRET);
