import { useEffect } from "react";

/**
 * Subscribes to OAuth results posted by a popup window (see `postOAuthResultToOpener`).
 * Messages from other origins or with a different `type` are ignored.
 * Memoize `onMessage`: the listener is re-attached whenever its identity changes.
 */
export const useOAuthPopupListener = <T extends { type: string }>(type: T["type"], onMessage: (payload: T) => void) => {
    useEffect(() => {
        const handleMessage = (event: MessageEvent<T>) => {
            if (event.origin !== window.location.origin) return;
            const payload = event.data;
            if (!payload || payload.type !== type) return;
            onMessage(payload);
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [onMessage, type]);
};
