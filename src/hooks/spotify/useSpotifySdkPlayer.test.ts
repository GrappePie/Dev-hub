import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useSpotifySdkPlayer } from "./useSpotifySdkPlayer";

vi.mock("@/lib/sdk", () => ({ loadSpotifySdk: () => Promise.resolve() }));

afterEach(() => { delete window.Spotify; });

it("keeps the connected Spotify player when the volume changes", async () => {
    const player: SpotifyPlayer = {
        connect: vi.fn(async () => true), disconnect: vi.fn(),
        addListener: vi.fn(() => true), removeListener: vi.fn(() => true),
        activateElement: vi.fn(async () => {}), pause: vi.fn(async () => {}), resume: vi.fn(async () => {}),
        togglePlay: vi.fn(async () => {}), nextTrack: vi.fn(async () => {}), previousTrack: vi.fn(async () => {}),
        seek: vi.fn(async () => {}), getCurrentState: vi.fn(async () => null), setVolume: vi.fn(async () => {}),
    };
    const Player = vi.fn(function () { return player; });
    window.Spotify = { Player: Player as unknown as NonNullable<Window["Spotify"]>["Player"] };
    const params = {
        accessToken: "token", accessTokenRef: { current: "token" },
        tokenExpiresAtRef: { current: Date.now() + 3600000 },
        refreshAccessToken: vi.fn(async () => true), setStatusText: vi.fn(),
        playerRef: { current: null as SpotifyPlayer | null }, selectSdkDevice: vi.fn(),
        transferPlayback: vi.fn(async () => true), fetchDevices: vi.fn(async () => []),
        loadFavorites: vi.fn(async () => []), syncFromPlayerState: vi.fn(async () => {}),
        isPlaying: false, durationMs: 0, setPositionMs: vi.fn(),
    };
    const { rerender, unmount } = renderHook(({ volume }) => useSpotifySdkPlayer({ ...params, volume }), {
        initialProps: { volume: 0.5 },
    });
    await waitFor(() => expect(player.connect).toHaveBeenCalledOnce());
    rerender({ volume: 0.3 });
    expect(Player).toHaveBeenCalledOnce();
    expect(player.disconnect).not.toHaveBeenCalled();
    unmount();
    expect(player.disconnect).toHaveBeenCalledOnce();
});
