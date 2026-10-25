import { useEffect, useRef } from "react";
import gsap from "gsap";
import { drawCritterParade } from "./backgrounds/hop/scene";
import { drawArcadeGrid } from "./backgrounds/arcade/scene";
import { drawStarfieldShooter } from "./backgrounds/starfield/scene";
import { drawIdleRunnerGame, createRunnerState } from "./backgrounds/starfield/runner";
import { refreshPalette, clamp, createStar } from "./backgrounds/shared/utils";
import type { ReactiveBackgroundProps, Palette, Star, RunnerState, CritterState } from "./backgrounds/shared/types";
import { createCritterState } from "./backgrounds/shared/types";

export type { ReactiveBackgroundVariant } from "./backgrounds/shared/types";

const ReactiveBackground = ({ enabled, isPlaying, progress, volume, variant, analyser, activeComment, beatSignal, bpm, transitionActive = false }: ReactiveBackgroundProps) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    // Plain object tweened by GSAP each frame — read inside the rAF loop
    const sceneRef = useRef({ motionBoost: isPlaying ? 1 : 0.42 });
    const animationTimeRef = useRef(0);
    const roadTravelRef = useRef(0);
    const cameraRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
    const starsRef = useRef<Star[]>([]);
    const runnerStateRef = useRef<RunnerState>(createRunnerState());
    const critterStateRef = useRef<CritterState>(createCritterState());
    const analyserRef = useRef<AnalyserNode | null>(null);
    const fftDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
    const beatSignalRef = useRef<typeof beatSignal>(beatSignal);
    const lastBeatCountRef = useRef(0);
    const bpmRef = useRef<number | null>(bpm ?? null);
    const progressRef = useRef(progress);
    const volumeRef = useRef(volume);

    // Keep analyserRef in sync without restarting the rAF loop
    useEffect(() => {
        analyserRef.current = analyser ?? null;
        if (analyser) {
            fftDataRef.current = new Uint8Array(analyser.frequencyBinCount);
        } else {
            fftDataRef.current = null;
        }
    }, [analyser]);

    // Keep beatSignalRef in sync
    useEffect(() => { beatSignalRef.current = beatSignal; }, [beatSignal]);

    // Keep bpmRef in sync without restarting rAF
    useEffect(() => { bpmRef.current = bpm ?? null; }, [bpm]);

    // Keep progress/volume in refs to avoid restarting the rAF loop on every tick
    useEffect(() => { progressRef.current = progress; }, [progress]);
    useEffect(() => { volumeRef.current = volume; }, [volume]);

    // Bridge activeComment to the canvas critter state without restarting the rAF loop
    useEffect(() => {
        if (activeComment) {
            critterStateRef.current.pendingComment = activeComment;
        }
    }, [activeComment]);

    // Smooth motionBoost when music starts or stops
    useEffect(() => {
        const scene = sceneRef.current;
        gsap.to(scene, {
            motionBoost: isPlaying ? 1 : 0.42,
            duration: 0.7,
            ease: "power2.inOut",
            overwrite: true,
        });
        return () => { gsap.killTweensOf(scene); };
    }, [isPlaying]);

    // Intro/outro fade for the whole background layer
    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;
        if (enabled) {
            gsap.fromTo(
                wrapper,
                { opacity: 0 },
                { opacity: 1, duration: 1.5, ease: "power2.out", overwrite: true }
            );
        } else {
            gsap.to(wrapper, { opacity: 0, duration: 0.5, overwrite: true });
        }
        return () => { gsap.killTweensOf(wrapper); };
    }, [enabled]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;

        let width = 0;
        let height = 0;
        let rafId = 0;
        let frameCount = 0;
        let lastFrameTime = 0;

        const palette: Palette = {
            primary: "45 100% 55%",
            accent: "140 60% 40%",
            dark: "240 25% 14%",
            border: "45 60% 45%",
            danger: "0 80% 55%",
        };

        const resize = () => {
            const newW = Math.floor(window.innerWidth);
            const newH = Math.floor(window.innerHeight);
            // Skip if dimensions haven't changed — avoids clearing canvas unnecessarily
            if (newW === width && newH === height) return;
            width = newW;
            height = newH;
            canvas.width = width;
            canvas.height = height;
            // Let CSS (w-full h-full) control the display size — don't fight it with inline styles
            ctx.imageSmoothingEnabled = false;

            if (variant === "starfieldShooter") {
                const count = Math.max(90, Math.floor((width * height) / 8200));
                starsRef.current = Array.from({ length: count }, createStar);
            } else {
                starsRef.current = [];
            }

            runnerStateRef.current.obstacles = [];
            runnerStateRef.current.spawnTimer = 0.7;
        };

        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        refreshPalette(palette);
        resize();
        window.addEventListener("resize", resize);
        const pointCamera = (event: PointerEvent) => {
            if (event.pointerType !== "mouse" || reduceMotion) return;
            cameraRef.current.targetX = event.clientX / Math.max(1, width) * 2 - 1;
            cameraRef.current.targetY = event.clientY / Math.max(1, height) * 2 - 1;
        };
        const centerCamera = () => {
            cameraRef.current.targetX = 0;
            cameraRef.current.targetY = 0;
        };
        window.addEventListener("pointermove", pointCamera, { passive: true });
        window.addEventListener("blur", centerCamera);

        const draw = (timestamp: number) => {
            // Limit redraws to 30fps; time-based simulation remains refresh-rate independent.
            if (lastFrameTime && timestamp - lastFrameTime < 1000 / 30) {
                rafId = window.requestAnimationFrame(draw);
                return;
            }
            frameCount += 1;
            if (frameCount % 90 === 0) refreshPalette(palette);
            if (!lastFrameTime) lastFrameTime = timestamp;
            const dt = clamp((timestamp - lastFrameTime) / 1000, 0.001, 0.05);
            lastFrameTime = timestamp;

            // Keep scene time across effect restarts so playback preserves the pose.
            if (!reduceMotion) animationTimeRef.current += dt;
            const t = animationTimeRef.current;
            if (!reduceMotion) roadTravelRef.current += dt * (0.04 + sceneRef.current.motionBoost * (0.08 + volumeRef.current * 0.38));
            const progressNorm = clamp(progressRef.current / 100, 0, 1);
            const volumeNorm = clamp(volumeRef.current, 0, 1);

            // Read FFT data for critter frequency mapping
            if (analyserRef.current && fftDataRef.current) {
                analyserRef.current.getByteFrequencyData(fftDataRef.current);
            }
            const liveFft = analyserRef.current ? fftDataRef.current : null;

            ctx.clearRect(0, 0, width, height);

            const camera = cameraRef.current;
            const lag = 1 - Math.exp(-dt * 5);
            camera.x += (camera.targetX - camera.x) * lag;
            camera.y += (camera.targetY - camera.y) * lag;
            if (variant === "arcadeGrid") {
                drawArcadeGrid(ctx, width, height, t, progressNorm, volumeNorm, isPlaying, palette, roadTravelRef.current, camera);
            } else if (variant === "starfieldShooter") {
                drawStarfieldShooter(ctx, width, height, t, progressNorm, volumeNorm, isPlaying, palette, starsRef.current);
            } else {
                try {
                    drawCritterParade(ctx, width, height, t, dt, progressNorm, volumeNorm, isPlaying, palette, critterStateRef.current, liveFft, bpmRef.current, sceneRef.current.motionBoost);
                } catch (e) {
                    console.error("[HOP] draw error:", e);
                }
            }

            if (!isPlaying) {
                drawIdleRunnerGame(ctx, width, height, dt, t, volumeNorm, palette, runnerStateRef.current);
            } else {
                runnerStateRef.current.y = 0;
                runnerStateRef.current.vy = 0;
                runnerStateRef.current.cooldown = 0;
                runnerStateRef.current.obstacles = [];
                runnerStateRef.current.spawnTimer = 0.7;
                runnerStateRef.current.flash = 0;
            }

            const vignette = ctx.createRadialGradient(
                width * 0.5,
                height * 0.5,
                Math.min(width, height) * 0.18,
                width * 0.5,
                height * 0.5,
                Math.max(width, height) * 0.7
            );
            vignette.addColorStop(0, "rgba(0,0,0,0)");
            vignette.addColorStop(1, "rgba(0,0,0,0.28)");
            ctx.fillStyle = vignette;
            ctx.fillRect(0, 0, width, height);

            if (reduceMotion) return;
            rafId = window.requestAnimationFrame(draw);
        };

        if (!enabled) {
            ctx.clearRect(0, 0, width, height);
        } else if (variant === "pixelCritters" && transitionActive) {
            // HOP is expensive on first draw — defer until the pixel transition overlay exits
            // to avoid blocking GSAP's fade-out tween. The effect will re-run when
            // transitionActive goes false and the loop will start normally then.
        } else {
            rafId = window.requestAnimationFrame(draw);
        }

        return () => {
            window.cancelAnimationFrame(rafId);
            window.removeEventListener("resize", resize);
            window.removeEventListener("pointermove", pointCamera);
            window.removeEventListener("blur", centerCamera);
        };
    }, [enabled, isPlaying, variant, transitionActive]);

    return (
        <div ref={wrapperRef} className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
            <canvas ref={canvasRef} className="h-full w-full opacity-90 [image-rendering:pixelated]" aria-hidden />
        </div>
    );
};

export default ReactiveBackground;
