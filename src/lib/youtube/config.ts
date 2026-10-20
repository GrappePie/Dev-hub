export const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
export const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || "";
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
export const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
export const DEFAULT_VIDEO_ID = "dQw4w9WgXcQ";
/** YouTube "Music" category, used to bias searches towards songs. */
export const YOUTUBE_MUSIC_CATEGORY_ID = "10";

export const YOUTUBE_STORAGE_KEYS = {
    ACCESS_TOKEN: "yt_access_token",
    EXPIRES_AT: "yt_token_expires_at",
    ACCOUNT_NAME: "yt_account_name",
    VOLUME: "mh_yt_vol",
} as const;
