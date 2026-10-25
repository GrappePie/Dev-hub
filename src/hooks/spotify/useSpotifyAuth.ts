import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "@/hooks/use-toast";
import { useOAuthPopupListener } from "@/hooks/useOAuthPopupListener";
import {
    assertOAuthState,
    generateCodeChallenge,
    generateRandomString,
    isOAuthPopupWindow,
    openOAuthPopup,
    postOAuthResultToOpener,
    readOAuthCallbackParams,
} from "@/lib/oauth";
import { browserStorage } from "@/lib/storage";
import {
    SPOTIFY_AUTHORIZE_URL,
    SPOTIFY_CLIENT_ID,
    SPOTIFY_OAUTH_MESSAGE_TYPE,
    SPOTIFY_OAUTH_POPUP_NAME,
    SPOTIFY_REDIRECT_URI,
    SPOTIFY_SCOPES,
    SPOTIFY_STATE_PREFIX,
    SPOTIFY_STORAGE_KEYS,
} from "@/lib/spotify/config";
import { spotifyTokenStore } from "@/lib/spotify/storage";
import type { AuthFeedback, OAuthPopupMessage, TokenResponse } from "@/lib/spotify/types";

interface UseSpotifyAuthParams {
    setAccessToken: Dispatch<SetStateAction<string | null>>;
    setRefreshToken: Dispatch<SetStateAction<string | null>>;
    setTokenExpiresAt: Dispatch<SetStateAction<number | null>>;
    setStatusText: Dispatch<SetStateAction<string>>;
    clearAuthState: () => void;
    applyTokenResponse: (data: TokenResponse) => void;
    tokenRequest: (body: Record<string, string>) => Promise<TokenResponse>;
}

/**
 * OAuth Authorization Code + PKCE flow: login popup, callback handling (popup and full-page redirect)
 * and restoration of a stored session on mount.
 */
export const useSpotifyAuth = ({
    setAccessToken,
    setRefreshToken,
    setTokenExpiresAt,
    setStatusText,
    clearAuthState,
    applyTokenResponse,
    tokenRequest,
}: UseSpotifyAuthParams) => {
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [authFeedback, setAuthFeedback] = useState<AuthFeedback | null>(null);

    const emitAuthFeedback = useCallback((kind: AuthFeedback["kind"]) => {
        setAuthFeedback({
            id: Date.now() + Math.floor(Math.random() * 1000),
            kind,
        });
    }, []);

    const completeOAuthLogin = useCallback(
        async (code: string, state?: string | null) => {
            const expectedState = browserStorage.getItem(SPOTIFY_STORAGE_KEYS.OAUTH_STATE);
            assertOAuthState(expectedState, state);

            const codeVerifier = browserStorage.getItem(SPOTIFY_STORAGE_KEYS.CODE_VERIFIER);
            if (!codeVerifier) {
                throw new Error("Missing PKCE code verifier");
            }

            const data = await tokenRequest({
                client_id: SPOTIFY_CLIENT_ID,
                grant_type: "authorization_code",
                code,
                redirect_uri: SPOTIFY_REDIRECT_URI,
                code_verifier: codeVerifier,
            });

            applyTokenResponse(data);
            browserStorage.removeItem(SPOTIFY_STORAGE_KEYS.CODE_VERIFIER);
            browserStorage.removeItem(SPOTIFY_STORAGE_KEYS.OAUTH_STATE);
            setStatusText("Autenticado con Spotify.");
            emitAuthFeedback("success");
        },
        [applyTokenResponse, emitAuthFeedback, tokenRequest, setStatusText]
    );

    const startLogin = useCallback(async () => {
        const codeVerifier = generateRandomString(128);
        const oauthState = `${SPOTIFY_STATE_PREFIX}${generateRandomString(32)}`;
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        browserStorage.setItem(SPOTIFY_STORAGE_KEYS.CODE_VERIFIER, codeVerifier);
        browserStorage.setItem(SPOTIFY_STORAGE_KEYS.OAUTH_STATE, oauthState);
        const authUrl = new URL(SPOTIFY_AUTHORIZE_URL);
        authUrl.search = new URLSearchParams({
            response_type: "code",
            client_id: SPOTIFY_CLIENT_ID,
            scope: SPOTIFY_SCOPES,
            redirect_uri: SPOTIFY_REDIRECT_URI,
            code_challenge_method: "S256",
            code_challenge: codeChallenge,
            state: oauthState,
        }).toString();
        openOAuthPopup(authUrl.toString(), SPOTIFY_OAUTH_POPUP_NAME);
    }, []);

    useEffect(() => {
        let mounted = true;
        const initializeAuth = async () => {
            setIsAuthLoading(true);
            const { code, state, error: authError } = readOAuthCallbackParams();
            const {
                accessToken: storedToken,
                expiresAt: storedExpiresAt,
                refreshToken: storedRefreshToken,
            } = spotifyTokenStore.read();

            try {
                const isPopup = isOAuthPopupWindow();
                const isSpotifyFlow = !state || state.startsWith(SPOTIFY_STATE_PREFIX);
                if (isPopup && isSpotifyFlow && (code || authError)) {
                    postOAuthResultToOpener({
                        type: SPOTIFY_OAUTH_MESSAGE_TYPE,
                        code,
                        state,
                        error: authError || undefined,
                    } satisfies OAuthPopupMessage);
                    return;
                }

                if (code && isSpotifyFlow) {
                    await completeOAuthLogin(code, state);
                    if (!mounted) return;
                    window.history.replaceState({}, "", SPOTIFY_REDIRECT_URI);
                } else if (storedToken && storedExpiresAt && Date.now() < storedExpiresAt) {
                    if (!mounted) return;
                    setAccessToken(storedToken);
                    setTokenExpiresAt(storedExpiresAt);
                    setRefreshToken(storedRefreshToken);
                    setStatusText("Sesion restaurada.");
                } else if (storedRefreshToken) {
                    if (!mounted) return;
                    setRefreshToken(storedRefreshToken);
                    const data = await tokenRequest({
                        client_id: SPOTIFY_CLIENT_ID,
                        grant_type: "refresh_token",
                        refresh_token: storedRefreshToken,
                    });
                    if (!mounted) return;
                    applyTokenResponse({ ...data, refresh_token: data.refresh_token || storedRefreshToken });
                    setStatusText("Sesion restaurada con refresh token.");
                } else {
                    clearAuthState();
                }
            } catch (error) {
                clearAuthState();
                emitAuthFeedback("error");
                toast({
                    variant: "destructive",
                    title: "Error de autenticacion",
                    description: "No se pudo iniciar sesion con Spotify.",
                });
                console.error(error);
            } finally {
                if (mounted) setIsAuthLoading(false);
            }
        };

        void initializeAuth();
        return () => {
            mounted = false;
        };
    }, [applyTokenResponse, clearAuthState, completeOAuthLogin, emitAuthFeedback, tokenRequest, setAccessToken, setRefreshToken, setStatusText, setTokenExpiresAt]);

    const handlePopupMessage = useCallback(
        (payload: OAuthPopupMessage) => {
            if (payload.error) {
                setIsAuthLoading(false);
                setStatusText("Autorizacion cancelada o rechazada.");
                emitAuthFeedback("error");
                toast({
                    variant: "destructive",
                    title: "Spotify no autorizado",
                    description: "No se completo el permiso en la ventana emergente.",
                });
                return;
            }

            if (!payload.code) return;
            setIsAuthLoading(true);
            void completeOAuthLogin(payload.code, payload.state)
                .catch((error) => {
                    clearAuthState();
                    emitAuthFeedback("error");
                    toast({
                        variant: "destructive",
                        title: "Error de autenticacion",
                        description: "No se pudo iniciar sesion con Spotify.",
                    });
                    console.error(error);
                })
                .finally(() => {
                    setIsAuthLoading(false);
                });
        },
        [clearAuthState, completeOAuthLogin, emitAuthFeedback, setStatusText]
    );

    useOAuthPopupListener<OAuthPopupMessage>(SPOTIFY_OAUTH_MESSAGE_TYPE, handlePopupMessage);

    return {
        isAuthLoading,
        authFeedback,
        startLogin,
    };
};
