import { describe, expect, it } from "vitest";
import {
    createInitialSessionState,
    resolveLoginToggle,
    selectActiveModes,
    sessionReducer,
    type SessionAction,
    type SessionState,
} from "./sessionReducer";

const initial = (overrides: Partial<SessionState> = {}): SessionState => ({
    ...createInitialSessionState({ isLoggedIn: false, selectedPlatform: "spotify" }),
    ...overrides,
});

const reduce = (state: SessionState, ...actions: SessionAction[]) => actions.reduce(sessionReducer, state);

const NO_MODES = { isSoundcloudMode: false, isYouTubeMode: false, isFileaMode: false };

describe("sessionReducer", () => {
    it("enters a streaming mode only when the pixel transition completes", () => {
        let state = reduce(
            initial({ showCharacterSelect: true, isCharacterVisible: true, searchQuery: "lofi", libraryOpen: true }),
            { type: "platformSelected", platform: "youtube" },
            { type: "characterTransitionStarted", visible: false },
        );
        expect(state).toMatchObject({
            selectedPlatform: "youtube",
            previewPlatform: "youtube",
            pendingModeActivation: "youtube",
            showCharacterSelect: false,
            youtubeMode: false,
            transitioning: true,
        });

        state = reduce(state, { type: "transitionCompleted" }, { type: "transitionEnded" });
        expect(state).toMatchObject({
            isCharacterVisible: false,
            youtubeMode: true,
            soundcloudMode: false,
            libraryOpen: false,
            searchQuery: "",
            pendingModeActivation: null,
            pendingCharacterVisible: null,
            transitioning: false,
        });
        expect(selectActiveModes(state)).toEqual({ ...NO_MODES, isYouTubeMode: true });
    });

    it("leaves a streaming mode and closes the browsing panels on the next transition", () => {
        const inMode = initial({ selectedPlatform: "soundcloud", soundcloudMode: true, libraryOpen: true, searchQuery: "ambient" });
        const outcome = resolveLoginToggle(selectActiveModes(inMode), false);

        let state = reduce(inMode, { type: "loginToggled", outcome });
        expect(state).toMatchObject({ pendingModeDeactivation: "soundcloud", showCharacterSelect: true, soundcloudMode: true });

        state = reduce(state, { type: "characterTransitionStarted", visible: true }, { type: "transitionCompleted" });
        expect(state).toMatchObject({
            isCharacterVisible: true,
            soundcloudMode: false,
            libraryOpen: false,
            devicesOpen: false,
            searchQuery: "",
            pendingModeDeactivation: null,
        });
    });

    it("activates Filea immediately and drops pending mode changes", () => {
        const state = reduce(
            initial({ pendingModeActivation: "soundcloud", soundcloudMode: true, isAuthRedirecting: true, showCharacterSelect: true }),
            { type: "platformSelected", platform: "filea" },
        );
        expect(state).toMatchObject({
            fileaMode: true,
            soundcloudMode: false,
            pendingModeActivation: null,
            isAuthRedirecting: false,
            showCharacterSelect: false,
        });
        expect(selectActiveModes(state)).toEqual({ ...NO_MODES, isFileaMode: true });
    });

    it("starts the Spotify auth redirect and lets a failed redirect be cancelled", () => {
        const state = reduce(initial({ selectedPlatform: "youtube", youtubeMode: true }), { type: "platformSelected", platform: "spotify" });
        expect(state).toMatchObject({ selectedPlatform: "spotify", youtubeMode: false, isAuthRedirecting: true, showCharacterSelect: true });
        expect(reduce(state, { type: "authRedirectFailed" }).isAuthRedirecting).toBe(false);
    });

    it("finishes the auth redirect when the Spotify session starts", () => {
        const state = reduce(
            initial({ isAuthRedirecting: true, showCharacterSelect: true }),
            { type: "loginTransitionStarted", loggedIn: true },
            { type: "transitionCompleted" },
        );
        expect(state).toMatchObject({ isLoggedIn: true, pendingLoggedIn: null, isAuthRedirecting: false });
    });

    it("closes the browsing panels only when the Spotify session actually ends", () => {
        const browsing = { libraryOpen: true, searchQuery: "daft punk" };
        const loggedOut = reduce(
            initial({ ...browsing, isLoggedIn: true }),
            { type: "loginTransitionStarted", loggedIn: false },
            { type: "transitionCompleted" },
        );
        expect(loggedOut).toMatchObject({ isLoggedIn: false, libraryOpen: false, searchQuery: "" });

        const unchanged = reduce(initial({ ...browsing, pendingLoggedIn: false }), { type: "transitionCompleted" });
        expect(unchanged).toMatchObject(browsing);
    });

    it("resets modes and panels when logging out of Spotify from the header", () => {
        const state = reduce(
            initial({ isLoggedIn: true, devicesOpen: true, searchQuery: "q", pendingModeActivation: "youtube" }),
            { type: "loginToggled", outcome: "logoutSpotify" },
        );
        expect(state).toMatchObject({
            devicesOpen: false,
            libraryOpen: false,
            searchQuery: "",
            pendingModeActivation: null,
            showCharacterSelect: true,
        });
    });

    it("keeps the library and devices panels mutually exclusive and closes both on Escape", () => {
        let state = reduce(initial(), { type: "libraryToggled" });
        expect(state).toMatchObject({ libraryOpen: true, devicesOpen: false });

        state = reduce(state, { type: "devicesToggled" });
        expect(state).toMatchObject({ libraryOpen: false, devicesOpen: true });

        state = reduce({ ...state, searchQuery: "q" }, { type: "escapePressed" });
        expect(state).toMatchObject({ libraryOpen: false, devicesOpen: false, searchQuery: "" });
    });

    it("clears the preview and any auth redirect when the selector is closed", () => {
        const state = reduce(
            initial({ showCharacterSelect: true, previewPlatform: "youtube", isAuthRedirecting: true }),
            { type: "characterSelectClosed" },
        );
        expect(state).toMatchObject({ showCharacterSelect: false, previewPlatform: null, isAuthRedirecting: false });
    });

    it("returns the same state object when an action changes nothing", () => {
        const state = initial();
        expect(sessionReducer(state, { type: "escapePressed" })).toBe(state);
        expect(sessionReducer(state, { type: "previewChanged", platform: null })).toBe(state);
    });
});

describe("selectActiveModes", () => {
    it("ignores mode flags of platforms that are not selected", () => {
        expect(selectActiveModes(initial({ soundcloudMode: true, youtubeMode: true, fileaMode: true }))).toEqual(NO_MODES);
    });
});

describe("resolveLoginToggle", () => {
    it("exits the active mode before touching the Spotify session", () => {
        expect(resolveLoginToggle({ ...NO_MODES, isFileaMode: true }, true)).toBe("exitFilea");
        expect(resolveLoginToggle({ ...NO_MODES, isSoundcloudMode: true }, true)).toBe("exitSoundcloud");
        expect(resolveLoginToggle({ ...NO_MODES, isYouTubeMode: true }, true)).toBe("exitYoutube");
        expect(resolveLoginToggle(NO_MODES, true)).toBe("logoutSpotify");
        expect(resolveLoginToggle(NO_MODES, false)).toBe("openSelector");
    });
});
