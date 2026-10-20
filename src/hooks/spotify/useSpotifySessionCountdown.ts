import { useEffect, useRef, useState } from "react";

interface UseSpotifySessionCountdownParams {
    tokenExpiresAt: number | null;
    refreshAccessToken: () => Promise<boolean>;
}

/** Remaining access-token lifetime (`h:mm:ss` / `m:ss`); triggers one automatic refresh 2 minutes before expiry. */
export const useSpotifySessionCountdown = ({ tokenExpiresAt, refreshAccessToken }: UseSpotifySessionCountdownParams) => {
    const autoRefreshTriggeredRef = useRef(false);
    const [sessionCountdown, setSessionCountdown] = useState("—");

    useEffect(() => {
        if (!tokenExpiresAt) {
            setSessionCountdown("-");
            return;
        }
        autoRefreshTriggeredRef.current = false;
        const tick = () => {
            const remainingMs = Math.max(0, tokenExpiresAt - Date.now());
            if (remainingMs <= 120000 && !autoRefreshTriggeredRef.current) {
                autoRefreshTriggeredRef.current = true;
                void refreshAccessToken();
            }
            const total = Math.floor(remainingMs / 1000);
            const hours = Math.floor(total / 3600);
            const mins = Math.floor((total % 3600) / 60);
            const secs = total % 60;
            if (hours > 0) {
                setSessionCountdown(`${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
            } else {
                setSessionCountdown(`${mins}:${String(secs).padStart(2, "0")}`);
            }
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [refreshAccessToken, tokenExpiresAt]);

    return sessionCountdown;
};
