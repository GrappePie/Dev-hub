import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSpotifyPlayer } from "@/hooks/useSpotifyPlayer";
import { useSpotifyApi } from "./useSpotifyApi";

vi.mock("@/lib/sdk", () => ({ loadSpotifySdk: () => Promise.resolve() }));

describe("Spotify integration with Mixy", () => {
    beforeEach(() => {
        vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
        localStorage.clear();
        localStorage.setItem("spotify_access_token", "test-access");
        localStorage.setItem("spotify_token_expires_at", String(Date.now() + 3_600_000));
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); });

    it("returns searchable tracks and playlist durations to Mixy after restoring a session", async () => {
        const track = { id: "song", uri: "spotify:track:song", name: "Song", artists: [{ name: "Band" }], duration_ms: 123000 };
        vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(JSON.stringify(
            url.includes("/search?") ? { tracks: { items: [track] } } : { items: [{ track }] },
        ))));
        const { result, unmount } = renderHook(() => useSpotifyPlayer());
        await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
        await act(async () => {
            const results = await result.current.searchCatalog("song");
            expect(results.tracks[0]).toMatchObject({ id: "song", durationMs: 123000 });
            const playlist = await result.current.fetchPlaylistTracks("playlist");
            expect(playlist[0]).toMatchObject({ id: "song", durationMs: 123000 });
        });
        expect(result.current.positionMs).toBe(0);
        expect(result.current.durationMs).toBe(0);
        unmount();
    });

    it("retries a rejected API request using the refreshed bearer", async () => {
        const accessTokenRef = { current: "expired" };
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response("", { status: 401 }))
            .mockResolvedValueOnce(new Response("{}"));
        vi.stubGlobal("fetch", fetchMock);
        const { result } = renderHook(() => useSpotifyApi({
            accessTokenRef,
            refreshAccessToken: async () => { accessTokenRef.current = "fresh"; return true; },
        }));
        await result.current("/me", {}, { silent: true });
        expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer expired");
        expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer fresh");
    });
});
