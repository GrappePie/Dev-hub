/** Formats a duration in milliseconds as `m:ss`. */
export const formatMs = (ms = 0) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** Playback progress as a 0-100 percentage. */
export const toProgressPercent = (positionMs: number, durationMs: number) => {
    if (!durationMs) return 0;
    return Math.max(0, Math.min(100, (positionMs / durationMs) * 100));
};
