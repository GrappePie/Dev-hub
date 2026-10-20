import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeAudioContext {
    state: AudioContextState = "running";
    resume = vi.fn(() => {
        this.state = "running";
        return Promise.resolve();
    });
}

const loadModule = () => import("./sharedAudioContext");

describe("getSharedAudioContext", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.stubGlobal("AudioContext", FakeAudioContext);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("lazily creates a single app-owned context", async () => {
        const { getSharedAudioContext } = await loadModule();
        const context = getSharedAudioContext();

        expect(context).toBeInstanceOf(FakeAudioContext);
        expect(getSharedAudioContext()).toBe(context);
        expect((context as AudioContext & { __devhubOwned?: boolean }).__devhubOwned).toBe(true);
    });

    it("resumes a suspended context and recreates a closed one", async () => {
        const { getSharedAudioContext } = await loadModule();
        const first = getSharedAudioContext() as unknown as FakeAudioContext;

        first.state = "suspended";
        expect(getSharedAudioContext()).toBe(first);
        expect(first.resume).toHaveBeenCalledTimes(1);

        first.state = "closed";
        expect(getSharedAudioContext()).not.toBe(first);
    });

    it("returns null when Web Audio is unavailable", async () => {
        vi.stubGlobal("AudioContext", undefined);
        const { getSharedAudioContext } = await loadModule();
        expect(getSharedAudioContext()).toBeNull();
    });
});
