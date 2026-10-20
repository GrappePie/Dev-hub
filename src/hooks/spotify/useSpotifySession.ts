import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { SPOTIFY_CLIENT_ID, SPOTIFY_TOKEN_URL } from "@/lib/spotify/config";
import { extractTokenErrorMessage } from "@/lib/spotify/http";
import { spotifyTokenStore } from "@/lib/spotify/storage";
import type { SpotifyTokenError, TokenResponse } from "@/lib/spotify/types";

/**
 * OAuth session: token state mirrored into refs (read synchronously by the API client and the SDK),
 * token persistence, refresh-token exchange and the shared status line.
 */
export const useSpotifySession = () => {
    const accessTokenRef = useRef<string | null>(null);
    const refreshTokenRef = useRef<string | null>(null);
    const tokenExpiresAtRef = useRef<number | null>(null);

    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState<string | null>(null);
    const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);
    const [statusText, setStatusText] = useState("Conecta tu cuenta para empezar.");

    useEffect(() => {
        accessTokenRef.current = accessToken;
    }, [accessToken]);

    useEffect(() => {
        refreshTokenRef.current = refreshToken;
    }, [refreshToken]);

    useEffect(() => {
        tokenExpiresAtRef.current = tokenExpiresAt;
    }, [tokenExpiresAt]);

    const clearAuthState = useCallback(() => {
        setAccessToken(null);
        setRefreshToken(null);
        setTokenExpiresAt(null);
        spotifyTokenStore.clear();
    }, []);

    const applyTokenResponse = useCallback((data: TokenResponse) => {
        const expiresAt = Date.now() + data.expires_in * 1000;
        // Update refs synchronously so getOAuthToken reads the new token immediately,
        // without waiting for React to flush the state update via useEffect.
        accessTokenRef.current = data.access_token;
        tokenExpiresAtRef.current = expiresAt;
        setAccessToken(data.access_token);
        setTokenExpiresAt(expiresAt);
        // `undefined` keeps the stored refresh token when the response does not rotate it.
        spotifyTokenStore.save({ accessToken: data.access_token, expiresAt, refreshToken: data.refresh_token || undefined });
        if (data.refresh_token) {
            refreshTokenRef.current = data.refresh_token;
            setRefreshToken(data.refresh_token);
        }
    }, []);

    const tokenRequest = useCallback(async (body: Record<string, string>) => {
        const response = await fetch(SPOTIFY_TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams(body),
        });
        if (!response.ok) {
            let details = "";
            try {
                const payload = (await response.json()) as SpotifyTokenError;
                details = payload.error_description || payload.error || "";
            } catch {
                details = "";
            }
            throw new Error(details ? `Token endpoint error (${response.status}): ${details}` : `Token endpoint error (${response.status})`);
        }
        return (await response.json()) as TokenResponse;
    }, []);

    const refreshAccessToken = useCallback(async () => {
        const currentRefreshToken = refreshTokenRef.current;
        if (!currentRefreshToken) return false;
        try {
            const data = await tokenRequest({
                client_id: SPOTIFY_CLIENT_ID,
                grant_type: "refresh_token",
                refresh_token: currentRefreshToken,
            });
            applyTokenResponse(data);
            toast({ title: "Sesion actualizada", description: "El token se refresco automaticamente." });
            return true;
        } catch (error) {
            const message = extractTokenErrorMessage(error).toLowerCase();
            const isPermanentError = message.includes("invalid_grant") || message.includes("invalid_client");
            if (isPermanentError) {
                clearAuthState();
                setStatusText("Sesion expirada. Vuelve a conectar Spotify.");
            } else {
                setStatusText("No se pudo refrescar la sesion automaticamente. Reintentaremos.");
            }
            console.error(error);
            return false;
        }
    }, [applyTokenResponse, clearAuthState, tokenRequest]);

    return {
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
    };
};
