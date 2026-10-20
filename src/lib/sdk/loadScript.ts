type GlobalReadyCallbackName = "onSpotifyWebPlaybackSDKReady" | "onYouTubeIframeAPIReady";

export interface LoadScriptOptions {
    /** True when the SDK global is already usable; loading is skipped entirely. */
    isReady: () => boolean;
    /** Global callback the SDK invokes once initialised. Without it the script `load` event resolves the promise. */
    readyCallback?: GlobalReadyCallbackName;
    errorMessage: string;
}

const pendingLoads = new Map<string, Promise<void>>();

/**
 * Loads a third-party SDK script at most once per page (one shared promise per `src`).
 * Reuses an existing `<script>` tag, chains any previously registered ready callback,
 * and evicts failed loads from the cache so a later call can retry.
 */
export const loadScript = (src: string, { isReady, readyCallback, errorMessage }: LoadScriptOptions): Promise<void> => {
    if (isReady()) return Promise.resolve();
    const pending = pendingLoads.get(src);
    if (pending) return pending;

    const promise = new Promise<void>((resolve, reject) => {
        if (readyCallback) {
            const previous = window[readyCallback];
            window[readyCallback] = () => {
                previous?.();
                resolve();
            };
        }

        const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
        const script = existing ?? document.createElement("script");
        if (!readyCallback) script.addEventListener("load", () => resolve(), { once: true });
        script.addEventListener(
            "error",
            () => {
                pendingLoads.delete(src);
                script.remove();
                reject(new Error(errorMessage));
            },
            { once: true }
        );

        if (!existing) {
            script.src = src;
            script.async = true;
            document.body.appendChild(script);
        }
    });

    pendingLoads.set(src, promise);
    return promise;
};
