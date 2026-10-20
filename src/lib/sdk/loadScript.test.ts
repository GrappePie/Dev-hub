import { afterEach, describe, expect, it, vi } from "vitest";
import { loadScript } from "./loadScript";

const scriptsFor = (src: string) => document.querySelectorAll<HTMLScriptElement>(`script[src="${src}"]`);
const notReady = { isReady: () => false, errorMessage: "boom" };

afterEach(() => {
    document.querySelectorAll("script").forEach((script) => script.remove());
    delete window.onYouTubeIframeAPIReady;
});

describe("loadScript", () => {
    it("injects the script once and shares the pending promise", async () => {
        const src = "https://example.test/shared.js";
        const first = loadScript(src, notReady);

        expect(loadScript(src, notReady)).toBe(first);
        expect(scriptsFor(src)).toHaveLength(1);

        scriptsFor(src)[0].dispatchEvent(new Event("load"));
        await expect(first).resolves.toBeUndefined();
    });

    it("skips loading when the SDK is already available", async () => {
        const src = "https://example.test/ready.js";
        await loadScript(src, { ...notReady, isReady: () => true });
        expect(scriptsFor(src)).toHaveLength(0);
    });

    it("waits for an existing tag instead of injecting a duplicate", async () => {
        const src = "https://example.test/existing.js";
        const existing = document.createElement("script");
        existing.src = src;
        document.body.appendChild(existing);

        const promise = loadScript(src, notReady);
        expect(scriptsFor(src)).toHaveLength(1);

        existing.dispatchEvent(new Event("load"));
        await expect(promise).resolves.toBeUndefined();
    });

    it("resolves through the SDK ready callback and keeps the previous handler", async () => {
        const previous = vi.fn();
        window.onYouTubeIframeAPIReady = previous;

        const promise = loadScript("https://example.test/callback.js", { ...notReady, readyCallback: "onYouTubeIframeAPIReady" });
        window.onYouTubeIframeAPIReady?.();

        await expect(promise).resolves.toBeUndefined();
        expect(previous).toHaveBeenCalledTimes(1);
    });

    it("evicts failed loads so a later call can retry", async () => {
        const src = "https://example.test/flaky.js";
        const failed = loadScript(src, notReady);
        scriptsFor(src)[0].dispatchEvent(new Event("error"));

        await expect(failed).rejects.toThrow("boom");
        expect(scriptsFor(src)).toHaveLength(0);

        const retry = loadScript(src, notReady);
        expect(retry).not.toBe(failed);
        expect(scriptsFor(src)).toHaveLength(1);
    });
});
