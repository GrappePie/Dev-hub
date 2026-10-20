import { useEffect, type Dispatch } from "react";
import type { SessionAction, SessionState } from "@/lib/session/sessionReducer";

type TransitionState = Pick<SessionState, "transitioning" | "isLoggedIn" | "showCharacterSelect" | "isCharacterVisible">;

interface TransitionTriggers {
    spotifyAuthenticated: boolean;
    showOAuthBridge: boolean;
}

/**
 * Starts the pixel transition whenever the requested screen (character select, Spotify session)
 * differs from the one on display.
 *
 * Transitions run one at a time: a request made while the overlay is running waits until it ends.
 * Once the overlay has covered the screen its pending changes are already applied, so starting a
 * new one mid-run would be dropped and leave the shell stuck on the previous screen.
 */
export const useSessionTransitions = (
    { transitioning, isLoggedIn, showCharacterSelect, isCharacterVisible }: TransitionState,
    dispatch: Dispatch<SessionAction>,
    { spotifyAuthenticated, showOAuthBridge }: TransitionTriggers,
) => {
    useEffect(() => {
        if (transitioning || isLoggedIn || showOAuthBridge) return;
        if (showCharacterSelect === isCharacterVisible) return;
        dispatch({ type: "characterTransitionStarted", visible: showCharacterSelect });
    }, [dispatch, isCharacterVisible, isLoggedIn, showCharacterSelect, showOAuthBridge, transitioning]);

    useEffect(() => {
        if (transitioning || spotifyAuthenticated === isLoggedIn) return;
        dispatch({ type: "loginTransitionStarted", loggedIn: spotifyAuthenticated });
    }, [dispatch, isLoggedIn, spotifyAuthenticated, transitioning]);
};
