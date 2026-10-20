import { act, renderHook } from "@testing-library/react";
import { useReducer } from "react";
import { describe, expect, it } from "vitest";
import {
    createInitialSessionState,
    sessionReducer,
    type SessionAction,
    type SessionState,
} from "@/lib/session/sessionReducer";
import { useSessionTransitions } from "./useSessionTransitions";

interface HarnessProps {
    initial: Partial<SessionState>;
    spotifyAuthenticated: boolean;
}

const useSessionHarness = ({ initial, spotifyAuthenticated }: HarnessProps) => {
    const [state, dispatch] = useReducer(sessionReducer, initial, (overrides) => ({
        ...createInitialSessionState({ isLoggedIn: false, selectedPlatform: "spotify" }),
        ...overrides,
    }));
    useSessionTransitions(state, dispatch, { spotifyAuthenticated, showOAuthBridge: false });
    return { state, dispatch };
};

const setup = (initialProps: HarnessProps) => {
    const hook = renderHook((props: HarnessProps) => useSessionHarness(props), { initialProps });
    const dispatch = (action: SessionAction) => act(() => hook.result.current.dispatch(action));
    /** Mimics PixelTransition: only a running transition covers and then uncovers the screen. */
    const runTransition = () => {
        expect(hook.result.current.state.transitioning).toBe(true);
        dispatch({ type: "transitionCompleted" });
        dispatch({ type: "transitionEnded" });
    };
    return { ...hook, dispatch, runTransition };
};

describe("useSessionTransitions", () => {
    it("runs a request made while the overlay uncovers once the running transition ends", () => {
        const { result, dispatch, runTransition } = setup({
            initial: { showCharacterSelect: true, isCharacterVisible: true },
            spotifyAuthenticated: false,
        });

        dispatch({ type: "characterSelectClosed" });
        expect(result.current.state.transitioning).toBe(true);
        dispatch({ type: "transitionCompleted" });
        // PRESS START clicked while the login screen is still being uncovered.
        dispatch({ type: "characterSelectOpened" });
        dispatch({ type: "transitionEnded" });

        runTransition();
        expect(result.current.state).toMatchObject({ isCharacterVisible: true, transitioning: false });
    });

    it("shows the character select after logging out of Spotify", () => {
        const { result, rerender, dispatch, runTransition } = setup({
            initial: { isLoggedIn: true },
            spotifyAuthenticated: true,
        });

        dispatch({ type: "loginToggled", outcome: "logoutSpotify" });
        rerender({ initial: { isLoggedIn: true }, spotifyAuthenticated: false });

        runTransition();
        runTransition();
        expect(result.current.state).toMatchObject({ isLoggedIn: false, isCharacterVisible: true, transitioning: false });
    });
});
