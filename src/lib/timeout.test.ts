import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimeoutError, withTimeout } from "./timeout";

const neverSettles = (onSignal: (signal: AbortSignal) => void) => (signal: AbortSignal) => {
    onSignal(signal);
    return new Promise<never>(() => {});
};

describe("withTimeout", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("rejects with a TimeoutError and aborts the task when it takes too long", async () => {
        let taskSignal: AbortSignal | undefined;
        const result = withTimeout(new AbortController().signal, 1000, neverSettles((signal) => (taskSignal = signal)));
        const assertion = expect(result).rejects.toBeInstanceOf(TimeoutError);

        await vi.advanceTimersByTimeAsync(1000);
        await assertion;
        expect(taskSignal?.aborted).toBe(true);
    });

    it("rejects with the cancellation reason instead of a TimeoutError when the caller aborts", async () => {
        const caller = new AbortController();
        let taskSignal: AbortSignal | undefined;
        const result = withTimeout(caller.signal, 1000, neverSettles((signal) => (taskSignal = signal)));

        caller.abort(new Error("cancelled"));
        await expect(result).rejects.toThrow("cancelled");
        expect(taskSignal?.aborted).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("resolves with the task value and clears the timer", async () => {
        await expect(withTimeout(new AbortController().signal, 1000, async () => "ok")).resolves.toBe("ok");
        expect(vi.getTimerCount()).toBe(0);
    });
});
