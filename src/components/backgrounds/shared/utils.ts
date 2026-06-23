import type { Palette, Star } from "./types";

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const toHsla = (raw: string, alpha: number, fallback = "45 100% 55%") => {
    const source = raw.trim() || fallback;
    const parts = source.split(/\s+/);
    if (parts.length < 3) return `rgba(255, 210, 80, ${alpha})`;
    return `hsla(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
};

export const createStar = (): Star => ({
    x: Math.random() * 2 - 1,
    y: Math.random() * 2 - 1,
    z: 0.06 + Math.random() * 1.25,
    speed: 0.5 + Math.random() * 1.1,
});

export const drawPixelLine = (
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    pixel: number
) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(Math.abs(dx), Math.abs(dy)) / Math.max(1, pixel);
    for (let i = 0; i <= steps; i += 1) {
        const t = i / Math.max(1, steps);
        const x = Math.floor((x0 + dx * t) / pixel) * pixel;
        const y = Math.floor((y0 + dy * t) / pixel) * pixel;
        ctx.fillRect(x, y, pixel, pixel);
    }
};

export const refreshPalette = (palette: Palette) => {
    const rootStyles = getComputedStyle(document.documentElement);
    palette.primary = rootStyles.getPropertyValue("--primary").trim() || palette.primary;
    palette.accent = rootStyles.getPropertyValue("--accent").trim() || palette.accent;
    palette.dark = rootStyles.getPropertyValue("--card").trim() || palette.dark;
    palette.border = rootStyles.getPropertyValue("--border").trim() || palette.border;
    palette.danger = rootStyles.getPropertyValue("--destructive").trim() || palette.danger;
};

export const snapToPixel = (value: number, pixel: number) => Math.floor(value / pixel) * pixel;
