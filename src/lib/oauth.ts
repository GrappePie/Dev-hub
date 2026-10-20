const RANDOM_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
// Largest multiple of the charset size that fits in a byte; higher bytes are rejected to avoid modulo bias.
const MAX_UNBIASED_BYTE = 256 - (256 % RANDOM_CHARSET.length);

/** Cryptographically secure alphanumeric string (OAuth `state`, PKCE verifier). */
export const generateRandomString = (length: number): string => {
    const chars: string[] = [];
    const bytes = new Uint8Array(length);
    while (chars.length < length) {
        crypto.getRandomValues(bytes);
        for (const byte of bytes) {
            if (chars.length === length) break;
            if (byte < MAX_UNBIASED_BYTE) chars.push(RANDOM_CHARSET[byte % RANDOM_CHARSET.length]);
        }
    }
    return chars.join("");
};

/** PKCE S256 code challenge (RFC 7636). */
export const generateCodeChallenge = async (codeVerifier: string) => {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
};

export interface OAuthCallbackParams {
    code: string | null;
    state: string | null;
    error: string | null;
}

export const readOAuthCallbackParams = (search = window.location.search): OAuthCallbackParams => {
    const params = new URLSearchParams(search);
    return { code: params.get("code"), state: params.get("state"), error: params.get("error") };
};

export const isOAuthPopupWindow = () => Boolean(window.opener && window.opener !== window);

/** Sends the OAuth result from the popup back to the opener window and closes the popup. */
export const postOAuthResultToOpener = <T extends { type: string }>(message: T) => {
    window.opener?.postMessage(message, window.location.origin);
    window.close();
};

const POPUP_WIDTH = 520;
const POPUP_HEIGHT = 760;

/** Opens a centred OAuth popup, falling back to a full-page redirect when popups are blocked. */
export const openOAuthPopup = (url: string, windowName: string) => {
    const left = Math.max(0, window.screenX + Math.round((window.outerWidth - POPUP_WIDTH) / 2));
    const top = Math.max(0, window.screenY + Math.round((window.outerHeight - POPUP_HEIGHT) / 2));
    const popup = window.open(
        url,
        windowName,
        `popup=yes,width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
    if (popup && !popup.closed) {
        popup.focus();
        return;
    }
    window.location.href = url;
};

export const getDefaultRedirectUri = () => `${window.location.origin}${window.location.pathname}`;
