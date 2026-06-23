import { useEffect, useRef, useState } from "react";

const MIN_BPM = 55;
const MAX_BPM = 180;
const MIN_BEAT_INTERVAL_MS = 60000 / MAX_BPM; // ~333 ms
const ONSET_HISTORY_SIZE = 90;  // ~1.5s at 60fps
const BEAT_BUFFER_SIZE = 16;
const ONSET_THRESHOLD = 1.6;
const MIN_ENERGY = 20;

// Reject a new raw BPM if it deviates more than this fraction from current estimate.
// Allows ~1 BPM drift at 120 BPM before being accepted each beat.
const MAX_BPM_DRIFT = 0.18;

/**
 * Detects BPM in real time from an AnalyserNode using spectral flux (onset strength).
 *
 * Stability mechanism: once an estimate is established, raw readings that deviate
 * more than MAX_BPM_DRIFT (18%) from the current smoothed value are discarded.
 * This prevents hi-hats, snares, or transient noise from shifting the tempo.
 */
export const useBpmDetector = (analyser: AnalyserNode | null) => {
    const [bpm, setBpm] = useState<number | null>(null);
    const beatRef = useRef(0);

    const rafRef = useRef(0);
    const onsetHistRef = useRef<number[]>([]);
    const beatTimesRef = useRef<number[]>([]);
    const lastBeatTimeRef = useRef(0);
    const prevEnergyRef = useRef(0);
    const smoothBpmRef = useRef<number | null>(null);
    const lastDisplayedBpm = useRef<number | null>(null);

    useEffect(() => {
        cancelAnimationFrame(rafRef.current);

        if (!analyser) {
            setBpm(null);
            smoothBpmRef.current = null;
            lastDisplayedBpm.current = null;
            onsetHistRef.current = [];
            beatTimesRef.current = [];
            prevEnergyRef.current = 0;
            return;
        }

        const bufLen = analyser.frequencyBinCount;
        const data = new Uint8Array(bufLen);
        const bassEnd = Math.max(2, Math.floor(bufLen * 0.04));

        const tick = (now: number) => {
            analyser.getByteFrequencyData(data);

            let sum = 0;
            for (let i = 0; i < bassEnd; i++) sum += data[i];
            const energy = sum / bassEnd;

            const onset = Math.max(0, energy - prevEnergyRef.current);
            prevEnergyRef.current = energy;

            const hist = onsetHistRef.current;
            hist.push(onset);
            if (hist.length > ONSET_HISTORY_SIZE) hist.shift();

            if (hist.length >= 30 && energy > MIN_ENERGY) {
                const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
                const timeSinceLast = now - lastBeatTimeRef.current;

                const isBeat =
                    onset > ONSET_THRESHOLD * mean &&
                    onset > 3 &&
                    timeSinceLast > MIN_BEAT_INTERVAL_MS;

                if (isBeat) {
                    lastBeatTimeRef.current = now;
                    beatRef.current += 1;

                    const beats = beatTimesRef.current;
                    beats.push(now);
                    if (beats.length > BEAT_BUFFER_SIZE) beats.shift();

                    if (beats.length >= 6) {
                        const intervals: number[] = [];
                        for (let i = 1; i < beats.length; i++) {
                            const iv = beats[i] - beats[i - 1];
                            if (iv > 0) intervals.push(iv);
                        }
                        intervals.sort((a, b) => a - b);
                        const median = intervals[Math.floor(intervals.length / 2)];
                        const raw = 60000 / median;

                        if (raw >= MIN_BPM && raw <= MAX_BPM) {
                            const current = smoothBpmRef.current;

                            // Rejection filter: once we have an estimate, discard readings
                            // that are too far from it (likely false-positive beats).
                            if (current !== null) {
                                const deviation = Math.abs(raw - current) / current;
                                if (deviation > MAX_BPM_DRIFT) {
                                    rafRef.current = requestAnimationFrame(tick);
                                    return;
                                }
                            }

                            // Strong EMA smoothing — slow to change, fast to establish
                            smoothBpmRef.current = current === null
                                ? raw
                                : current * 0.92 + raw * 0.08;

                            const rounded = Math.round(smoothBpmRef.current);
                            if (rounded !== lastDisplayedBpm.current) {
                                lastDisplayedBpm.current = rounded;
                                setBpm(rounded);
                            }
                        }
                    }
                }
            }

            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [analyser]);

    return { bpm, beatRef };
};
