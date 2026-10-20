import { browserStorage, createStoredVolume, createTokenStore } from "@/lib/storage";
import { YOUTUBE_STORAGE_KEYS } from "./config";

export const youtubeTokenStore = createTokenStore({
    accessToken: YOUTUBE_STORAGE_KEYS.ACCESS_TOKEN,
    expiresAt: YOUTUBE_STORAGE_KEYS.EXPIRES_AT,
    alsoClear: [YOUTUBE_STORAGE_KEYS.ACCOUNT_NAME],
});

/** Cached channel name, shown while the library is still loading. */
export const youtubeAccountNameStore = {
    read: () => browserStorage.getItem(YOUTUBE_STORAGE_KEYS.ACCOUNT_NAME) || "",
    save: (name: string) => browserStorage.setItem(YOUTUBE_STORAGE_KEYS.ACCOUNT_NAME, name),
};

export const youtubeVolumeStore = createStoredVolume(YOUTUBE_STORAGE_KEYS.VOLUME);
