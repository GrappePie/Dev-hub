import { generateRandomString } from "@/lib/oauth";
import { browserStorage, createTokenStore } from "@/lib/storage";
import {
    SOUNDCLOUD_AUTHORIZE_URL,
    SOUNDCLOUD_CLIENT_ID,
    SOUNDCLOUD_REDIRECT_URI,
    SOUNDCLOUD_STATE_PREFIX,
    SOUNDCLOUD_STORAGE_KEYS,
    hasSoundcloudCredentials,
} from "./config";
import type { SoundcloudTokenResponse } from "./types";

export const soundcloudTokenStore = createTokenStore({
    accessToken: SOUNDCLOUD_STORAGE_KEYS.ACCESS_TOKEN,
    refreshToken: SOUNDCLOUD_STORAGE_KEYS.REFRESH_TOKEN,
    expiresAt: SOUNDCLOUD_STORAGE_KEYS.EXPIRES_AT,
    alsoClear: [SOUNDCLOUD_STORAGE_KEYS.OAUTH_STATE, SOUNDCLOUD_STORAGE_KEYS.PKCE_VERIFIER],
});

/** Persisted OAuth `state`, checked against the callback to reject forged redirects. */
export const soundcloudOAuthState = {
    create: () => {
        const state = `${SOUNDCLOUD_STATE_PREFIX}${generateRandomString(24)}`;
        browserStorage.setItem(SOUNDCLOUD_STORAGE_KEYS.OAUTH_STATE, state);
        return state;
    },
    read: () => browserStorage.getItem(SOUNDCLOUD_STORAGE_KEYS.OAUTH_STATE),
    clear: () => browserStorage.removeItem(SOUNDCLOUD_STORAGE_KEYS.OAUTH_STATE),
};

export const isSoundcloudState = (value?: string | null) => Boolean(value && value.startsWith(SOUNDCLOUD_STATE_PREFIX));

/** Absolute expiry in epoch ms: one hour when unknown, never less than a minute. */
export const getTokenExpiry = (expiresIn?: number) => {
    if (!expiresIn || !Number.isFinite(expiresIn)) return Date.now() + 3600 * 1000;
    return Date.now() + Math.max(60, expiresIn) * 1000;
};

export const buildSoundcloudAuthorizeUrl = (state: string, codeChallenge: string) => {
    const authUrl = new URL(SOUNDCLOUD_AUTHORIZE_URL);
    authUrl.search = new URLSearchParams({
        client_id: SOUNDCLOUD_CLIENT_ID,
        response_type: "code",
        redirect_uri: SOUNDCLOUD_REDIRECT_URI,
        state,
        scope: "*",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
    }).toString();
    return authUrl.toString();
};

/** Calls the token endpoint (`authorization_code` or `refresh_token` grant). */
export const requestSoundcloudToken = async (body: Record<string, string>): Promise<SoundcloudTokenResponse> => {
    if (!hasSoundcloudCredentials()) {
        throw new Error("Missing SoundCloud credentials");
    }
    const response = await fetch("/api/soundcloud/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            redirect_uri: SOUNDCLOUD_REDIRECT_URI,
            ...body,
        }),
    });
    if (!response.ok) {
        const raw = await response.text();
        throw new Error(`SoundCloud token error (${response.status}) ${raw}`);
    }
    return (await response.json()) as SoundcloudTokenResponse;
};
