import { describe, expect, it } from "vitest";
import {
    extrapolateConnectPosition,
    formatConnectCode,
    normalizeConnectCode,
    type ConnectSessionState,
} from "@/lib/youtubeConnect";

describe("YouTube Dev Hub Connect", () => {
    it("normaliza y presenta códigos de emparejamiento", () => {
        expect(normalizeConnectCode("abcd-efgh 2345-6789-extra")).toBe("ABCDEFGH23456789");
        expect(formatConnectCode("ABCDEFGH23456789")).toBe("ABCD-EFGH-2345-6789");
    });

    it("extrapola la posición únicamente durante reproducción", () => {
        const state = {
            positionMs: 15_000,
            durationMs: 20_000,
            isPlaying: true,
            updatedAt: 1_000,
        } as ConnectSessionState;
        expect(extrapolateConnectPosition(state, 4_000)).toBe(18_000);
        expect(extrapolateConnectPosition({ ...state, isPlaying: false }, 4_000)).toBe(15_000);
        expect(extrapolateConnectPosition(state, 20_000)).toBe(20_000);
    });
});
