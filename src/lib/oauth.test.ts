import { afterEach, describe, expect, it, vi } from "vitest";
import { generateCodeChallenge, generateRandomString } from "./oauth";

describe("generateCodeChallenge", () => {
    it("matches the RFC 7636 S256 test vector", async () => {
        await expect(generateCodeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).resolves.toBe(
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    });
});

describe("generateRandomString", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns alphanumeric strings of the requested length", () => {
        expect(generateRandomString(128)).toMatch(/^[A-Za-z0-9]{128}$/);
        expect(generateRandomString(0)).toBe("");
    });

    it("discards bytes that would bias the distribution and draws again", () => {
        const fill = (values: number[]) => (array: Uint8Array) => {
            array.set(values);
            return array;
        };
        vi.spyOn(crypto, "getRandomValues")
            .mockImplementationOnce(fill([255, 0, 61]))
            .mockImplementationOnce(fill([62, 250, 251]));

        expect(generateRandomString(3)).toBe("A9A");
    });
});
