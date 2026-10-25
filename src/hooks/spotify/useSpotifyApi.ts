import { useCallback } from "react";
import type { MutableRefObject } from "react";
import { toast } from "@/hooks/use-toast";
import { SPOTIFY_API_BASE_URL } from "@/lib/spotify/config";
import { extractSpotifyErrorMessage, sleep } from "@/lib/spotify/http";
import type { SpotifyApiOptions } from "@/lib/spotify/types";

interface UseSpotifyApiParams {
    accessTokenRef: MutableRefObject<string | null>;
    refreshAccessToken: () => Promise<boolean>;
}

/** Authorized Web API client: bearer token, refresh on 401, backoff on 429/5xx/network errors and error toasts. */
export const useSpotifyApi = ({ accessTokenRef, refreshAccessToken }: UseSpotifyApiParams) => {
    const fetchWithRetry = useCallback(
        async (url: string, init: RequestInit = {}, retries = 2, backoffMs = 400): Promise<Response> => {
            try {
                const response = await fetch(url, init);
                if (response.status === 401) {
                    const refreshed = await refreshAccessToken();
                    if (refreshed && retries > 0) {
                        return fetchWithRetry(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${accessTokenRef.current}` } }, retries - 1, backoffMs * 1.6);
                    }
                }
                if ((response.status === 429 || (response.status >= 500 && response.status < 600)) && retries > 0) {
                    const retryAfter = Number(response.headers.get("Retry-After") || "0");
                    await sleep(Math.max(backoffMs, retryAfter * 1000));
                    return fetchWithRetry(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${accessTokenRef.current}` } }, retries - 1, backoffMs * 1.6);
                }
                return response;
            } catch (error) {
                if (retries > 0) {
                    await sleep(backoffMs);
                    return fetchWithRetry(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${accessTokenRef.current}` } }, retries - 1, backoffMs * 1.6);
                }
                throw error;
            }
        },
        [refreshAccessToken, accessTokenRef]
    );

    const api = useCallback(
        async (path: string, init: RequestInit = {}, opts: SpotifyApiOptions = {}) => {
            const token = accessTokenRef.current;
            if (!token) throw new Error("Missing access token");
            const url = path.startsWith("http") ? path : `${SPOTIFY_API_BASE_URL}${path}`;
            const headers = {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                ...(init.headers || {}),
            };
            const response = await fetchWithRetry(url, { ...init, headers });
            if (!opts.silent && !response.ok && response.status !== 204) {
                const msg = await extractSpotifyErrorMessage(response);
                const details = msg ? ` · ${msg}` : "";
                toast({
                    variant: "destructive",
                    title: "Error de Spotify",
                    description: `La API respondio ${response.status}${details}.`,
                });
            }
            return response;
        },
        [fetchWithRetry, accessTokenRef]
    );

    return api;
};
