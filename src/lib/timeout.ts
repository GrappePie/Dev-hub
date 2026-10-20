export class TimeoutError extends Error {
    constructor(readonly timeoutMs: number) {
        super(`Operation timed out after ${timeoutMs}ms`);
        this.name = "TimeoutError";
    }
}

/**
 * Runs `task` with a signal that aborts when `signal` aborts or once `timeoutMs` elapses.
 * A timeout rejects with {@link TimeoutError}, so callers can tell it apart from a cancellation.
 */
export const withTimeout = <T>(
    signal: AbortSignal,
    timeoutMs: number,
    task: (signal: AbortSignal) => Promise<T>,
): Promise<T> => {
    const controller = new AbortController();
    const aborted = new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => reject(controller.signal.reason), { once: true });
    });
    const forwardAbort = () => controller.abort(signal.reason);
    const timeoutId = setTimeout(() => controller.abort(new TimeoutError(timeoutMs)), timeoutMs);
    if (signal.aborted) forwardAbort();
    else signal.addEventListener("abort", forwardAbort, { once: true });

    return Promise.race([task(controller.signal), aborted]).finally(() => {
        clearTimeout(timeoutId);
        signal.removeEventListener("abort", forwardAbort);
    });
};
