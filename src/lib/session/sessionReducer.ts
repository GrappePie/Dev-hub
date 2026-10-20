import type { PlatformId } from "@/components/CharacterSelectScreen";

/** Providers that run as an in-app "mode" instead of a Spotify login. */
export type StreamingMode = "soundcloud" | "youtube";

/**
 * App-shell session state: active platform, the pixel transition between the
 * login / character-select / player screens and the header panels.
 *
 * Side effects (provider resets, toasts, sfx, login/logout) stay in the page;
 * this module only describes how the state changes, so it can be unit tested.
 */
export interface SessionState {
    selectedPlatform: PlatformId;
    previewPlatform: PlatformId | null;
    isLoggedIn: boolean;
    isAuthRedirecting: boolean;
    showCharacterSelect: boolean;
    isCharacterVisible: boolean;
    transitioning: boolean;
    /** Login state applied when the running pixel transition covers the screen. */
    pendingLoggedIn: boolean | null;
    /** Character-select visibility applied when the running transition covers the screen. */
    pendingCharacterVisible: boolean | null;
    pendingModeActivation: StreamingMode | null;
    pendingModeDeactivation: StreamingMode | null;
    soundcloudMode: boolean;
    youtubeMode: boolean;
    fileaMode: boolean;
    libraryOpen: boolean;
    devicesOpen: boolean;
    searchQuery: string;
}

export type LoginToggleOutcome = "exitFilea" | "exitSoundcloud" | "exitYoutube" | "logoutSpotify" | "openSelector";

export type SessionAction =
    | { type: "searchQueryChanged"; query: string }
    | { type: "previewChanged"; platform: PlatformId | null }
    | { type: "characterTransitionStarted"; visible: boolean }
    | { type: "loginTransitionStarted"; loggedIn: boolean }
    | { type: "transitionCompleted" }
    | { type: "transitionEnded" }
    | { type: "platformSelected"; platform: PlatformId }
    | { type: "authRedirectFailed" }
    | { type: "loginToggled"; outcome: LoginToggleOutcome }
    | { type: "characterSelectOpened" }
    | { type: "characterSelectClosed" }
    | { type: "libraryToggled" }
    | { type: "devicesToggled" }
    | { type: "escapePressed" };

export interface ActiveModes {
    isSoundcloudMode: boolean;
    isYouTubeMode: boolean;
    isFileaMode: boolean;
}

export const createInitialSessionState = ({
    isLoggedIn,
    selectedPlatform,
}: {
    isLoggedIn: boolean;
    selectedPlatform: PlatformId;
}): SessionState => ({
    selectedPlatform,
    previewPlatform: null,
    isLoggedIn,
    isAuthRedirecting: false,
    showCharacterSelect: false,
    isCharacterVisible: false,
    transitioning: false,
    pendingLoggedIn: null,
    pendingCharacterVisible: null,
    pendingModeActivation: null,
    pendingModeDeactivation: null,
    soundcloudMode: false,
    youtubeMode: false,
    fileaMode: false,
    libraryOpen: false,
    devicesOpen: false,
    searchQuery: "",
});

/** A mode only counts while its platform is the selected one. */
export const selectActiveModes = (
    state: Pick<SessionState, "selectedPlatform" | "soundcloudMode" | "youtubeMode" | "fileaMode">,
): ActiveModes => ({
    isSoundcloudMode: state.selectedPlatform === "soundcloud" && state.soundcloudMode,
    isYouTubeMode: state.selectedPlatform === "youtube" && state.youtubeMode,
    isFileaMode: state.selectedPlatform === "filea" && state.fileaMode,
});

/** Decides what the header login/exit button does in the current session. */
export const resolveLoginToggle = (modes: ActiveModes, spotifyAuthenticated: boolean): LoginToggleOutcome => {
    if (modes.isFileaMode) return "exitFilea";
    if (modes.isSoundcloudMode) return "exitSoundcloud";
    if (modes.isYouTubeMode) return "exitYoutube";
    return spotifyAuthenticated ? "logoutSpotify" : "openSelector";
};

const NO_PENDING_MODE = { pendingModeActivation: null, pendingModeDeactivation: null } as const;
const NO_MODE = { soundcloudMode: false, youtubeMode: false, fileaMode: false } as const;
const CLOSED_BROWSING = { libraryOpen: false, devicesOpen: false, searchQuery: "" } as const;

/** Applies changes, returning the same object when nothing changed so React can skip the render. */
const patch = (state: SessionState, changes: Partial<SessionState>): SessionState => {
    const keys = Object.keys(changes) as (keyof SessionState)[];
    return keys.some((key) => !Object.is(state[key], changes[key])) ? { ...state, ...changes } : state;
};

const completeTransition = (state: SessionState): SessionState => {
    let next = state;
    if (state.pendingLoggedIn !== null) {
        const loggedIn = state.pendingLoggedIn;
        next = patch(next, { isLoggedIn: loggedIn, pendingLoggedIn: null });
        if (loggedIn !== state.isLoggedIn) {
            next = patch(next, loggedIn ? { isAuthRedirecting: false } : CLOSED_BROWSING);
        }
    }
    if (state.pendingCharacterVisible !== null) {
        next = patch(next, { isCharacterVisible: state.pendingCharacterVisible, pendingCharacterVisible: null });
    }
    if (state.pendingModeActivation !== null) {
        const mode = state.pendingModeActivation;
        return patch(next, {
            soundcloudMode: mode === "soundcloud",
            youtubeMode: mode === "youtube",
            libraryOpen: false,
            isAuthRedirecting: false,
            showCharacterSelect: false,
            searchQuery: "",
            pendingModeActivation: null,
        });
    }
    if (state.pendingModeDeactivation !== null) {
        return patch(next, {
            ...CLOSED_BROWSING,
            soundcloudMode: false,
            youtubeMode: false,
            isAuthRedirecting: false,
            pendingModeDeactivation: null,
        });
    }
    return next;
};

const selectPlatform = (state: SessionState, platform: PlatformId): SessionState => {
    const selection = { selectedPlatform: platform, previewPlatform: platform };
    if (platform === "soundcloud" || platform === "youtube") {
        return patch(state, {
            ...selection,
            pendingModeDeactivation: null,
            pendingModeActivation: platform,
            fileaMode: false,
            showCharacterSelect: false,
        });
    }
    if (platform === "filea") {
        return patch(state, {
            ...selection,
            ...NO_PENDING_MODE,
            ...NO_MODE,
            fileaMode: true,
            isAuthRedirecting: false,
            showCharacterSelect: false,
        });
    }
    return patch(state, {
        ...selection,
        ...NO_PENDING_MODE,
        ...NO_MODE,
        isAuthRedirecting: true,
        showCharacterSelect: true,
    });
};

const toggleLogin = (state: SessionState, outcome: LoginToggleOutcome): SessionState => {
    switch (outcome) {
        case "exitFilea":
            return patch(state, { ...NO_PENDING_MODE, fileaMode: false, isAuthRedirecting: false, showCharacterSelect: true });
        case "exitSoundcloud":
            return patch(state, { pendingModeActivation: null, pendingModeDeactivation: "soundcloud", showCharacterSelect: true });
        case "exitYoutube":
            return patch(state, { pendingModeActivation: null, pendingModeDeactivation: "youtube", showCharacterSelect: true });
        case "logoutSpotify":
            return patch(state, { ...CLOSED_BROWSING, ...NO_MODE, ...NO_PENDING_MODE, isAuthRedirecting: false, showCharacterSelect: true });
        case "openSelector":
            return patch(state, { ...NO_MODE, ...NO_PENDING_MODE, isAuthRedirecting: false, showCharacterSelect: true });
    }
};

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
    switch (action.type) {
        case "searchQueryChanged":
            return patch(state, { searchQuery: action.query });
        case "previewChanged":
            return patch(state, { previewPlatform: action.platform });
        case "characterTransitionStarted":
            return patch(state, { pendingCharacterVisible: action.visible, transitioning: true });
        case "loginTransitionStarted":
            return patch(state, { pendingLoggedIn: action.loggedIn, transitioning: true });
        case "transitionCompleted":
            return completeTransition(state);
        case "transitionEnded":
            return patch(state, { transitioning: false });
        case "platformSelected":
            return selectPlatform(state, action.platform);
        case "authRedirectFailed":
            return patch(state, { isAuthRedirecting: false });
        case "loginToggled":
            return toggleLogin(state, action.outcome);
        case "characterSelectOpened":
            return patch(state, { showCharacterSelect: true });
        case "characterSelectClosed":
            return patch(state, { previewPlatform: null, isAuthRedirecting: false, showCharacterSelect: false });
        case "libraryToggled":
            return patch(state, { libraryOpen: !state.libraryOpen, devicesOpen: false });
        case "devicesToggled":
            return patch(state, { devicesOpen: !state.devicesOpen, libraryOpen: false });
        case "escapePressed":
            return patch(state, CLOSED_BROWSING);
        default:
            return state;
    }
}
