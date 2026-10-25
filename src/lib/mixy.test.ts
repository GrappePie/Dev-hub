import { describe, expect, it, vi } from "vitest";
import {
    buildFederatedMixyTrack,
    extrapolateMixyPosition,
    pickMixySource,
    scoreMixyCandidate,
    type MixyPlayback,
    type MixySearchCandidate,
} from "@/lib/mixy";

const candidate = (overrides: Partial<MixySearchCandidate> = {}): MixySearchCandidate => ({
    provider: "spotify",
    id: "source-1",
    uri: "spotify:track:source-1",
    title: "Moon Lord",
    artist: "RichaaDEB",
    image: "https://example.com/cover.jpg",
    durationMs: 219_000,
    offsetMs: 0,
    available: true,
    ...overrides,
});

describe("Mixy federated tracks", () => {
    it("matches equivalent recordings and rejects a different version", () => {
        const reference = candidate();
        const equivalent = candidate({ provider: "youtube", id: "yt", uri: "https://youtube.com/watch?v=yt", title: "Moon Lord (Official Audio)", durationMs: 220_000 });
        const remix = candidate({ provider: "soundcloud", id: "sc", uri: "https://soundcloud.com/a/remix", title: "Moon Lord Nightcore Remix", durationMs: 168_000 });

        expect(scoreMixyCandidate(reference, equivalent)).toBeGreaterThan(0.8);
        expect(scoreMixyCandidate(reference, remix)).toBeLessThan(0.68);
    });

    it("builds alternatives and chooses a source available on this device", () => {
        vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
        const spotify = candidate();
        const youtube = candidate({ provider: "youtube", id: "yt", uri: "https://youtube.com/watch?v=yt", title: "Moon Lord (Official Audio)" });
        const track = buildFederatedMixyTrack(spotify, [spotify, youtube], "device", "Grappe Pie");

        expect(track.sources.spotify?.id).toBe("source-1");
        expect(track.sources.youtube?.id).toBe("yt");
        expect(pickMixySource(track, ["youtube"])?.provider).toBe("youtube");
        expect(pickMixySource(track, ["soundcloud"])).toBeNull();
    });
});

describe("Mixy synchronized clock", () => {
    const playback: MixyPlayback = {
        trackId: "track",
        queueIndex: 0,
        isPlaying: true,
        positionMs: 10_000,
        durationMs: 30_000,
        effectiveAt: 2_000,
        updatedAt: 2_000,
        revision: 2,
    };

    it("waits for the scheduled start and advances from the server timestamp", () => {
        expect(extrapolateMixyPosition(playback, 1_500)).toBe(10_000);
        expect(extrapolateMixyPosition(playback, 5_000)).toBe(13_000);
        expect(extrapolateMixyPosition(playback, 50_000)).toBe(30_000);
    });
});
