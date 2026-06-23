import { useRef, useEffect, useState } from "react";

interface ScrollingTextProps {
    text: string;
    className?: string;
    style?: React.CSSProperties;
    speed?: number; // pixels per second
    gap?: number;   // px between end of text and start of next copy
}

const ScrollingText = ({ text, className = "", style, speed = 40, gap = 60 }: ScrollingTextProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const firstRef = useRef<HTMLSpanElement>(null);
    const [scrolling, setScrolling] = useState(false);
    const [shift, setShift] = useState(0);

    useEffect(() => {
        const container = containerRef.current;
        const first = firstRef.current;
        if (!container || !first) return;

        const measure = () => {
            const textWidth = first.offsetWidth;
            const containerWidth = container.clientWidth;
            if (textWidth > containerWidth) {
                setScrolling(true);
                setShift(textWidth + gap);
            } else {
                setScrolling(false);
                setShift(0);
            }
        };

        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(container);
        return () => ro.disconnect();
    }, [text, gap]);

    const duration = shift > 0 ? shift / speed : 0;

    return (
        <div ref={containerRef} className={`overflow-hidden ${className}`} style={style}>
            <span
                className="inline-block whitespace-nowrap"
                style={scrolling ? ({
                    animation: `marquee-continuous ${duration}s linear infinite`,
                    "--marquee-shift": `-${shift}px`,
                } as React.CSSProperties) : undefined}
            >
                <span ref={firstRef}>{text}</span>
                {scrolling && <span style={{ paddingLeft: `${gap}px` }}>{text}</span>}
            </span>
        </div>
    );
};

export default ScrollingText;
