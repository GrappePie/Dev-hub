import { describe, expect, it } from "vitest";
import { getNextShuffleMode } from "./shuffleMode";

describe("getNextShuffleMode", () => {
    it("toggles between off and shuffle without cycling into smart mode", () => {
        expect(getNextShuffleMode("off")).toBe("shuffle");
        expect(getNextShuffleMode("shuffle")).toBe("off");
    });

    it("cycles into smart mode when smart shuffle is enabled", () => {
        expect(getNextShuffleMode("off", { smart: true })).toBe("shuffle");
        expect(getNextShuffleMode("shuffle", { smart: true })).toBe("smart");
        expect(getNextShuffleMode("smart", { smart: true })).toBe("off");
    });

    it("turns smart shuffle off when toggled", () => {
        expect(getNextShuffleMode("smart")).toBe("off");
    });
});
