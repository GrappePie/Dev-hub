import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";

interface PixelTransitionProps {
    active: boolean;
    onComplete: () => void;
    onTransitionEnd?: () => void;
    gridSize?: number;
}

const PixelTransition = ({ active, onComplete, onTransitionEnd, gridSize = 12 }: PixelTransitionProps) => {
    const [mounted, setMounted] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const tlRef = useRef<gsap.core.Timeline | null>(null);
    const onCompleteRef = useRef(onComplete);
    const onTransitionEndRef = useRef(onTransitionEnd);
    const totalCells = gridSize * gridSize;
    const cellW = 100 / gridSize;

    // Keep callback refs current without re-running the animation
    useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
    useEffect(() => { onTransitionEndRef.current = onTransitionEnd; }, [onTransitionEnd]);

    useEffect(() => {
        if (active) setMounted(true);
    }, [active]);

    useLayoutEffect(() => {
        if (!mounted || !containerRef.current) return;

        const cells = gsap.utils.toArray<HTMLElement>(containerRef.current.children);
        tlRef.current?.kill();

        const tl = gsap.timeline({
            onComplete: () => {
                setMounted(false);
                onTransitionEndRef.current?.();
            },
        });
        tlRef.current = tl;

        tl.set(cells, { opacity: 0 })
            .to(cells, {
                opacity: 1,
                duration: 0,
                stagger: { amount: 0.6, from: "random" },
            })
            .call(() => { onCompleteRef.current(); })
            .to(cells, {
                opacity: 0,
                duration: 0,
                stagger: { amount: 0.5, from: "random" },
            }, "+=0.2");

        return () => { tlRef.current?.kill(); };
    }, [mounted]);

    if (!mounted) return null;

    return (
        <div ref={containerRef} className="fixed inset-0 z-[9999] pointer-events-none">
            {Array.from({ length: totalCells }).map((_, i) => (
                <div
                    key={i}
                    className="absolute bg-background"
                    style={{
                        left: `${(i % gridSize) * cellW}%`,
                        top: `${Math.floor(i / gridSize) * cellW}%`,
                        width: `${cellW + 0.5}%`,
                        height: `${cellW + 0.5}%`,
                    }}
                />
            ))}
        </div>
    );
};

export default PixelTransition;