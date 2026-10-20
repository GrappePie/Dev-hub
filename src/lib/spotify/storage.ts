import { createStoredVolume, createTokenStore } from "@/lib/storage";
import { SPOTIFY_STORAGE_KEYS } from "@/lib/spotify/config";

export const spotifyTokenStore = createTokenStore({
    accessToken: SPOTIFY_STORAGE_KEYS.ACCESS_TOKEN,
    expiresAt: SPOTIFY_STORAGE_KEYS.EXPIRES_AT,
    refreshToken: SPOTIFY_STORAGE_KEYS.REFRESH_TOKEN,
    alsoClear: [SPOTIFY_STORAGE_KEYS.CODE_VERIFIER, SPOTIFY_STORAGE_KEYS.OAUTH_STATE],
});

export const spotifyVolumeStore = createStoredVolume(SPOTIFY_STORAGE_KEYS.VOLUME);
