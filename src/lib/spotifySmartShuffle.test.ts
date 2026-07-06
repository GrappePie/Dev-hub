import { describe, expect, it } from "vitest";
import { getSmartShuffleCandidate, getSpotifyRecommendationsPath } from "./spotifySmartShuffle";

describe("spotify smart shuffle", () => {
    it("uses Spotify recommendations seeded from the current track", () => {
        expect(getSpotifyRecommendationsPath("track-123")).toBe("/recommendations?seed_tracks=track-123&limit=5");
    });

    it("picks a queued candidate without repeating the current track", () => {
        const candidate = getSmartShuffleCandidate(
            [
                { id: "current", uri: "spotify:track:current" },
                { id: "next", uri: "spotify:track:next" },
            ],
            "current",
            () => 0
        );

        expect(candidate?.uri).toBe("spotify:track:next");
    });
});
