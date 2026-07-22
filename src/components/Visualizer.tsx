import { useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { AudioWaveform } from "pixelarticons/react/AudioWaveform";
import PixelIcon from "@/components/PixelIcon";

const BAR_COUNT = 16;
const MIN_SCALE = 0.08;

interface VisualizerProps {
    isPlaying: boolean;
    analyser?: AnalyserNode | null;
    onRequestCapture?: () => void;
    bpm?: number | null;
    bpmConfidence?: number;
    beatSignal?: React.MutableRefObject<number>;
}

const Visualizer = ({
    isPlaying,
    analyser,
    onRequestCapture,
    bpm,
    bpmConfidence = 0,
    beatSignal,
}: VisualizerProps) => {
    const rafRef = useRef<number | null>(null);
    const barsRef = useRef<Array<HTMLDivElement | null>>([]);
    const valuesRef = useRef<number[]>(Array(BAR_COUNT).fill(MIN_SCALE));

    const lastBeatCountRef = useRef(0);
    const ctaRef = useRef<HTMLButtonElement>(null);
    const bpmRef = useRef<HTMLSpanElement>(null);
    const ctaTlRef = useRef<gsap.core.Timeline | null>(null);

    const showCaptureCta = !analyser && !!onRequestCapture;

    const binRanges = useMemo(() => {
        if (!analyser) return [];
        const bufLen = analyser.frequencyBinCount;
        return Array.from({ length: BAR_COUNT }, (_, i) => {
            const lo = Math.floor(Math.pow(i / BAR_COUNT, 1.7) * bufLen * 0.75);
            const hi = Math.max(lo + 1, Math.floor(Math.pow((i + 1) / BAR_COUNT, 1.7) * bufLen * 0.75));
            return [lo, hi] as const;
        });
    }, [analyser]);

    const paintBars = (values: number[]) => {
        for (let i = 0; i < BAR_COUNT; i++) {
            const el = barsRef.current[i];
            if (!el) continue;
            const value = values[i];
            el.style.transform = `scaleY(${value})`;
            el.style.opacity = isPlaying ? "1" : "0.3";
            el.style.background =
                value > 0.7
                    ? "hsl(var(--destructive))"
                    : value > 0.4
                        ? "hsl(var(--primary))"
                        : "hsl(var(--accent))";
        }
    };

    // Main audio loop — direct DOM updates, zero React re-renders
    useEffect(() => {
        const stop = () => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };

        stop();

        if (!isPlaying) {
            valuesRef.current = Array(BAR_COUNT).fill(MIN_SCALE);
            paintBars(valuesRef.current);
            return stop;
        }

        if (!analyser) {
            let lastChange = 0;
            const tick = (now: number) => {
                if (now - lastChange > 150) {
                    lastChange = now;
                    valuesRef.current = valuesRef.current.map(() => MIN_SCALE + Math.random() * 0.65);
                    paintBars(valuesRef.current);
                }
                rafRef.current = requestAnimationFrame(tick);
            };
            rafRef.current = requestAnimationFrame(tick);
            return stop;
        }

        const data = new Uint8Array(analyser.frequencyBinCount);
        const smoothing = 0.35;

        const tick = () => {
            analyser.getByteFrequencyData(data);
            const nextValues = valuesRef.current.slice();
            for (let i = 0; i < BAR_COUNT; i++) {
                const [lo, hi] = binRanges[i];
                let sum = 0;
                for (let j = lo; j < hi; j++) sum += data[j];
                const avg = sum / Math.max(1, hi - lo);
                const target = Math.max(MIN_SCALE, avg / 255);
                nextValues[i] += (target - nextValues[i]) * smoothing;
            }
            valuesRef.current = nextValues;
            paintBars(nextValues);
            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
        return stop;
    }, [isPlaying, analyser, binRanges]);

    // Beat pop — rAF-based check, GSAP for the visual pop
    useEffect(() => {
        if (!beatSignal) return;
        let frame = 0;
        const checkBeat = () => {
            if (beatSignal.current !== lastBeatCountRef.current) {
                lastBeatCountRef.current = beatSignal.current;
                if (bpmRef.current) {
                    gsap.fromTo(
                        bpmRef.current,
                        { scale: 1.35, opacity: 1 },
                        { scale: 1, opacity: 0.75, duration: 0.18, ease: "power2.out", overwrite: true }
                    );
                }
            }
            frame = requestAnimationFrame(checkBeat);
        };
        frame = requestAnimationFrame(checkBeat);
        return () => cancelAnimationFrame(frame);
    }, [beatSignal]);

    // CTA pulse — GSAP repeat, no state
    useEffect(() => {
        ctaTlRef.current?.kill();
        if (!onRequestCapture || analyser || !ctaRef.current) return;
        ctaTlRef.current = gsap.timeline({ repeat: -1, yoyo: true })
            .to(ctaRef.current, { scale: 1.015, opacity: 0.9, duration: 0.8, ease: "sine.inOut" });
        return () => { ctaTlRef.current?.kill(); };
    }, [onRequestCapture, analyser]);

    return (
        <div className="w-full">
            <div className="flex items-center gap-1 mb-2">
                <PixelIcon icon={AudioWaveform} size="sm" className="text-primary" />
                <span className="font-display text-[8px] text-primary">AUDIO</span>
                {bpm != null && (
                    <span
                        ref={bpmRef}
                        className="ml-1 font-display text-[8px]"
                        style={{ color: "hsl(var(--accent))" }}
                    >
                        {bpm} BPM · {Math.round(bpmConfidence * 100)}%
                    </span>
                )}
                {analyser ? (
                    <span className="ml-auto font-display text-[7px] text-accent animate-pulse">● LIVE</span>
                ) : onRequestCapture ? (
                    <span className="ml-auto font-display text-[7px] text-muted-foreground">● SIM</span>
                ) : null}
            </div>

            {showCaptureCta && (
                <button
                    ref={ctaRef}
                    onClick={onRequestCapture}
                    className="w-full mb-2 pixel-box p-2 flex flex-col items-center gap-1 border-border bg-secondary hover:border-primary hover:bg-primary/10 cursor-pointer transition-colors"
                >
                    <span className="font-display text-[8px] text-primary">► ACTIVAR VISUALIZADOR EN VIVO</span>
                    <span className="font-display text-[6px] text-muted-foreground">
                        1. Selecciona esta pestaña &nbsp;·&nbsp; 2. Activa "Compartir audio de la pestaña" &nbsp;·&nbsp; 3. Compartir
                    </span>
                </button>
            )}

            <div
                className="relative flex items-end gap-[3px] h-10 bg-secondary border-2 border-border p-1"
                style={{ opacity: showCaptureCta ? 0.4 : 1 }}
            >
                {Array.from({ length: BAR_COUNT }, (_, i) => (
                    <div
                        key={i}
                        className="flex-1 h-full origin-bottom"
                        ref={(el) => { barsRef.current[i] = el; }}
                        style={{
                            transform: `scaleY(${MIN_SCALE})`,
                            background: "hsl(var(--accent))",
                            opacity: isPlaying ? 1 : 0.3,
                            imageRendering: "pixelated",
                            willChange: "transform",
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

export default Visualizer;
