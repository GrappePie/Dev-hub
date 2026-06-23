import { clamp, snapToPixel, toHsla } from "../shared/utils";

export const drawPixelMountains = (
    ctx: CanvasRenderingContext2D,
    width: number,
    groundY: number,
    pixel: number,
    t: number,
    progressNorm: number,
    isPlaying: boolean,
    volumeNorm: number
) => {
    const p = pixel;
    const vol = clamp(volumeNorm, 0, 1);

    // Mountains only grow UP with volume — static height is the minimum
    const backSpread  = 0.30 * vol;
    const frontSpread = 0.38 * vol;

    const backScale  = isPlaying
        ? [1.0, 1.0 + backSpread * 0.5, 1.0 + backSpread][(Math.floor(t / 0.55) * 7  + Math.floor(progressNorm * 31)) % 3]
        : 1.0;
    const frontScale = isPlaying
        ? [1.0, 1.0 + frontSpread * 0.33, 1.0 + frontSpread * 0.66, 1.0 + frontSpread][(Math.floor(t / 0.38) * 11 + Math.floor(progressNorm * 17)) % 4]
        : 1.0;

    // ── Back range: blue-purple peaks with snow caps ──
    const backH = groundY * 0.28;
    for (let x = 0; x < width; x += p) {
        const nx = x / width;
        const profile =
            0.55 + 0.28 * Math.sin(nx * Math.PI * 2.3 + 1.0) +
            0.12 * Math.sin(nx * Math.PI * 4.9 + 2.5) +
            0.05 * Math.sin(nx * Math.PI * 8.1 + 0.8);
        const hStatic = Math.max(p * 2, backH * profile);
        const h       = Math.max(p * 2, backH * profile * backScale);
        const peakY   = snapToPixel(groundY - h, p);
        const slope   = nx < 0.5 ? 1 : -1;

        // Base body — blue-purple, lighter for a background feel
        const lightness = 52 + (slope > 0 ? 0 : 10);
        ctx.fillStyle = toHsla(`216 55% ${lightness}%`, 1.0);
        ctx.fillRect(x, peakY + p, p, groundY - peakY - p);

        // Mid-face highlight band (left side only)
        if (slope > 0 && ((x / p) % 4 === 1)) {
            const midY = snapToPixel(peakY + h * 0.40, p);
            ctx.fillStyle = toHsla("214 60% 68%", 0.55);
            ctx.fillRect(x, midY, p, p * 2);
        }

        // Ridge pixel
        ctx.fillStyle = toHsla("215 65% 72%", 1.0);
        ctx.fillRect(x, peakY, p, p);

        // Snow cap — threshold uses hStatic so it never flickers
        if (hStatic > backH * 0.60) {
            const snowDepth = Math.floor(hStatic * 0.28 / p);
            for (let s = 0; s <= snowDepth; s++) {
                const snowY = peakY + s * p;
                const capWidth = Math.max(1, (snowDepth - s + 1));
                if ((x / p) % (capWidth + 1) < capWidth) {
                    const alpha = s === 0 ? 1.0 : 0.90 - s * 0.10;
                    ctx.fillStyle = toHsla("210 20% 95%", Math.max(0.35, alpha));
                    ctx.fillRect(x, snowY, p, p);
                }
            }
            // Shadow line under snow
            ctx.fillStyle = toHsla("214 50% 70%", 0.45);
            ctx.fillRect(x, peakY + (snowDepth + 1) * p, p, p);
        }
    }

    // ── Front range: pine-green hills ──
    const frontH = groundY * 0.18;
    for (let x = 0; x < width; x += p) {
        const nx = x / width;
        const profile =
            0.58 + 0.26 * Math.sin(nx * Math.PI * 3.1 + 3.8) +
            0.10 * Math.sin(nx * Math.PI * 6.7 + 1.3) +
            0.06 * Math.sin(nx * Math.PI * 12.4 + 2.1);
        const hStatic = Math.max(p * 2, frontH * profile);
        const h       = Math.max(p * 2, frontH * profile * frontScale);
        const peakY   = snapToPixel(groundY - h, p);
        const col     = Math.floor(x / p);

        // Body — alternate two greens for texture
        const bodyColor = col % 3 === 0 ? "138 52% 28%" : "136 48% 35%";
        ctx.fillStyle = toHsla(bodyColor, 1.0);
        ctx.fillRect(x, peakY + p, p, groundY - peakY - p);

        // Crevice shadow every ~6 cols
        if (col % 6 === 0 && hStatic > frontH * 0.5) {
            ctx.fillStyle = toHsla("138 40% 18%", 0.65);
            const crevY = snapToPixel(peakY + h * 0.30, p);
            ctx.fillRect(x, crevY, p, p * 3);
        }

        // Lit ridge
        ctx.fillStyle = toHsla("138 62% 48%", 1.0);
        ctx.fillRect(x, peakY, p, p);

        // Pine trees — taller, every 7 cols
        if (col % 7 === 3 && hStatic > frontH * 0.55) {
            const treeH = p * 10;
            for (let layer = 0; layer < 4; layer++) {
                const layerW  = (layer + 1) * 2 - 1; // 1, 3, 5, 7 — narrow tip at top
                const layerY  = snapToPixel(peakY - treeH + layer * p * 3, p);
                const offsetX = x - Math.floor(layerW / 2) * p;
                const shade = layer < 2 ? "148 55% 22%" : "145 52% 30%";
                ctx.fillStyle = toHsla(shade, 1.0);
                ctx.fillRect(offsetX, layerY, layerW * p, p * 2);
            }
            ctx.fillStyle = toHsla("28 42% 28%", 1.0);
            ctx.fillRect(x, peakY - p * 3, p, p * 3);
        }
    }
};
