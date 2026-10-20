import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { YouTubeTrack } from "@/lib/youtube/types";
import { useYoutubePlayer } from "./useYoutubePlayer";

vi.mock("@/lib/sdk", () => ({
    loadGoogleIdentity: () => new Promise<never>(() => {}),
    loadYouTubeIframeApi: () => Promise.resolve(),
}));

const players: FakePlayer[] = [];

class FakePlayer implements YouTubePlayer {
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

    constructor(
        _element: HTMLElement | string,
        private readonly options: YouTubePlayerOptions,
    ) {
        players.push(this);
    }

    becomeReady() {
        act(() => this.options.events?.onReady?.({ target: this }));
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

        players[0].becomeReady();
        expect(players).toHaveLength(1);
        expect(players[0].loadVideoById).toHaveBeenCalledWith("abc123");
    });
});
