import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { YouTubeTrack } from "@/lib/youtube/types";
import type { ConnectSessionState } from "@/lib/youtubeConnect";
import { useYoutubePlayer } from "./useYoutubePlayer";

vi.mock("@/lib/sdk", () => ({
    loadGoogleIdentity: () => new Promise<never>(() => {}),
    loadYouTubeIframeApi: () => Promise.resolve(),
}));

const players: FakePlayer[] = [];
const connectHarness = vi.hoisted(() => ({
    takeover: null as ((state: ConnectSessionState, position: number) => void) | null,
}));
// Isolate SDK lifecycle tests from Connect polling while exposing its handoff callback.
vi.mock("@/hooks/useYoutubeConnect", () => ({
    default: (options: { onTakeover: NonNullable<typeof connectHarness.takeover> }) => {
        connectHarness.takeover = options.onTakeover;
        return { isConnected: false, isActiveDevice: true };
    },
}));

class FakePlayer implements YouTubePlayer {
    unMute = vi.fn();
    isMuted = vi.fn(() => false);
    playVideo = vi.fn();
    pauseVideo = vi.fn();
    loadVideoById = vi.fn();
    cueVideoById = vi.fn();
    getPlayerState = vi.fn(() => -1);
    getCurrentTime = vi.fn(() => 0);
    getDuration = vi.fn(() => 0);
    setVolume = vi.fn();
    setSize = vi.fn();
    seekTo = vi.fn();
    destroy = vi.fn();
    getIframe?: () => HTMLIFrameElement | null;

    constructor(
        _element: HTMLElement | string,
        private readonly options: YouTubePlayerOptions,
    ) {
        players.push(this);
    }

    becomeReady() {
        act(() => this.options.events?.onReady?.({ target: this }));
    }

    emitStaleEvents() {
        this.options.events?.onReady?.({ target: this });
        this.options.events?.onStateChange?.({ data: 1, target: this });
        this.options.events?.onError?.({ data: 100, target: this });
    }
}

const track: YouTubeTrack = {
    id: "yt-abc123",
    videoId: "abc123",
    uri: "https://www.youtube.com/watch?v=abc123",
    title: "Song",
    artist: "Artist",
    image: "",
    durationMs: 0,
    duration: "0:00",
};

const mountPlayer = async () => {
    const hook = renderHook(() => useYoutubePlayer());
    act(() => hook.result.current.playerHostRef(document.createElement("div")));
    await waitFor(() => expect(players).toHaveLength(1));
    return hook;
};

describe("useYoutubePlayer", () => {
    beforeEach(() => {
        window.YT = {
            Player: FakePlayer,
            PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
        };
        vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}"))));
    });

    afterEach(() => {
        vi.useRealTimers();
        delete window.YT;
        players.length = 0;
        vi.unstubAllGlobals();
    });

    it("keeps the same player when it becomes ready and when the volume changes", async () => {
        const { result } = await mountPlayer();

        players[0].becomeReady();
        act(() => result.current.setVolumeLevel(0.3));

        expect(players).toHaveLength(1);
        expect(players[0].destroy).not.toHaveBeenCalled();
        expect(players[0].setVolume).toHaveBeenLastCalledWith(30);
    });

    it("plays a track requested before the player was ready", async () => {
        const { result } = await mountPlayer();

        act(() => result.current.playSearchTrack(track));
        expect(players[0].loadVideoById).not.toHaveBeenCalled();

        await act(async () => { players[0].becomeReady(); });
        expect(players).toHaveLength(1);
        expect(players[0].loadVideoById).toHaveBeenCalledWith("abc123");
    });

    it("ignores callbacks from a player after its host has been removed", async () => {
        const { result } = await mountPlayer();
        const oldPlayer = players[0];
        act(() => result.current.playerHostRef(null));
        const status = result.current.statusText;
        act(() => oldPlayer.emitStaleEvents());
        expect(result.current.isReady).toBe(false);
        expect(result.current.isPlaying).toBe(false);
        expect(result.current.statusText).toBe(status);
        expect(oldPlayer.destroy).toHaveBeenCalledOnce();
    });

    it.each([false, true])("cancels a Connect resume on teardown (already ready: %s)", async (ready) => {
        const { result, unmount } = await mountPlayer();
        const player = players[0];
        if (ready) player.becomeReady();
        vi.useFakeTimers();
        const state: ConnectSessionState = {
            track, queue: [track], queueIndex: 0, positionMs: 10000, durationMs: 120000,
            isPlaying: true, shuffleMode: "off", repeatMode: 0, volume: 0.5,
            activeDeviceId: "other-device", activeDeviceName: "Other", version: 1, updatedAt: Date.now(),
        };
        await act(async () => { connectHarness.takeover?.(state, 10000); });
        if (!ready) player.becomeReady();
        act(() => result.current.playerHostRef(null));
        await act(async () => { await vi.advanceTimersByTimeAsync(300); });
        expect(player.seekTo).not.toHaveBeenCalled();
        unmount();
    });

    it("handles a detached iframe without calling its broken destroy method", async () => {
        const { result } = await mountPlayer();
        const player = players[0];
        player.getIframe = () => null;
        expect(() => act(() => result.current.playerHostRef(null))).not.toThrow();
        expect(player.destroy).not.toHaveBeenCalled();
    });
});
