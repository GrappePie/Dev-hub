export type ShuffleMode = "off" | "shuffle" | "smart";

interface ShuffleModeOptions {
    smart?: boolean;
}

export const getNextShuffleMode = (mode: ShuffleMode, options: ShuffleModeOptions = {}): ShuffleMode =>
    mode === "off" ? "shuffle" : options.smart && mode === "shuffle" ? "smart" : "off";
