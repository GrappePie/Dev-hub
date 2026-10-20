type OwnedAudioContext = AudioContext & { __devhubOwned?: boolean };

let sharedContext: OwnedAudioContext | null = null;

/**
 * Single AudioContext for the whole app (Singleton), created lazily on first use and
 * recreated if it was closed. Suspended contexts are resumed on access. The context is
 * flagged `__devhubOwned` so the interceptor in index.html ignores its audio graph.
 * Returns `null` when Web Audio is unavailable.
 */
export const getSharedAudioContext = (): AudioContext | null => {
    if (!sharedContext || sharedContext.state === "closed") {
        if (typeof AudioContext === "undefined") return null;
        const context: OwnedAudioContext = new AudioContext();
        context.__devhubOwned = true;
        sharedContext = context;
    }
    if (sharedContext.state === "suspended") {
        sharedContext.resume().catch(() => {
            // Resuming requires a user gesture; the next access will try again.
        });
    }
    return sharedContext;
};
