import { drawPixelLine, snapToPixel, toHsla } from "../shared/utils";

const allFinite = (...values: number[]): boolean => values.every(Number.isFinite);
const isValidPixel = (pixel: number): boolean => Number.isFinite(pixel) && pixel > 0;
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const drawPixelSun = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    pixel: number,
    nod: number
): void => {
    if (!isValidPixel(pixel) || !allFinite(cx, cy, nod)) return;

    const p = pixel;
    const sy = cy + snapToPixel(nod * p * 3, p);

    const rayDark  = toHsla("15 85% 30%", 0.95);
    const rayRed   = toHsla("18 90% 44%", 0.97);
    const rayOr    = toHsla("28 95% 52%", 0.97);
    const bodyYel  = toHsla("47 100% 57%", 1.0);
    const bodyHi   = toHsla("52 100% 76%", 0.88);
    const outline  = toHsla("22 60% 14%", 0.95);
    const grayLens = toHsla("220 12% 26%", 0.97);
    const sheenCol = toHsla("0 0% 72%", 0.55);
    const blushCol = toHsla("345 85% 60%", 0.88);
    const smileCol = toHsla("24 60% 18%", 0.92);

    // ── Ray outlines (shadow) ────────────────────────────────────────
    ctx.fillStyle = rayDark;
    // N tip outline
    ctx.fillRect(cx - p,     sy - p*11, p*2, p);
    // S tip outline
    ctx.fillRect(cx - p,     sy + p*10, p*2, p);
    // W tip outline
    ctx.fillRect(cx - p*11,  sy - p,    p,   p*2);
    // E tip outline
    ctx.fillRect(cx + p*10,  sy - p,    p,   p*2);
    // Diagonal outlines
    ctx.fillRect(cx + p*6,   sy - p*7,  p*2, p);
    ctx.fillRect(cx + p*7,   sy - p*6,  p,   p*2);
    ctx.fillRect(cx - p*8,   sy - p*7,  p*2, p);
    ctx.fillRect(cx - p*8,   sy - p*6,  p,   p*2);
    ctx.fillRect(cx + p*6,   sy + p*5,  p*2, p*2);
    ctx.fillRect(cx + p*7,   sy + p*4,  p,   p);
    ctx.fillRect(cx - p*8,   sy + p*5,  p*2, p*2);
    ctx.fillRect(cx - p*8,   sy + p*4,  p,   p);

    // ── Orange-red spike bodies ──────────────────────────────────────
    ctx.fillStyle = rayRed;
    // N spike
    ctx.fillRect(cx - p,     sy - p*10, p*2, p*2);
    ctx.fillRect(cx - p*2,   sy - p*8,  p*4, p*2);
    ctx.fillRect(cx - p*3,   sy - p*6,  p*6, p);
    // S spike
    ctx.fillRect(cx - p,     sy + p*8,  p*2, p*2);
    ctx.fillRect(cx - p*2,   sy + p*6,  p*4, p*2);
    ctx.fillRect(cx - p*3,   sy + p*5,  p*6, p);
    // W spike
    ctx.fillRect(cx - p*10,  sy - p,    p*2, p*2);
    ctx.fillRect(cx - p*8,   sy - p*2,  p*2, p*4);
    ctx.fillRect(cx - p*6,   sy - p*3,  p,   p*6);
    // E spike
    ctx.fillRect(cx + p*8,   sy - p,    p*2, p*2);
    ctx.fillRect(cx + p*6,   sy - p*2,  p*2, p*4);
    ctx.fillRect(cx + p*5,   sy - p*3,  p,   p*6);
    // NE diagonal
    ctx.fillRect(cx + p*5,   sy - p*6,  p*2, p*3);
    ctx.fillRect(cx + p*4,   sy - p*5,  p*2, p*2);
    // NW diagonal
    ctx.fillRect(cx - p*7,   sy - p*6,  p*2, p*3);
    ctx.fillRect(cx - p*6,   sy - p*5,  p*2, p*2);
    // SE diagonal
    ctx.fillRect(cx + p*5,   sy + p*3,  p*2, p*3);
    ctx.fillRect(cx + p*4,   sy + p*4,  p*2, p*2);
    // SW diagonal
    ctx.fillRect(cx - p*7,   sy + p*3,  p*2, p*3);
    ctx.fillRect(cx - p*6,   sy + p*4,  p*2, p*2);

    // ── Orange inner corona ──────────────────────────────────────────
    ctx.fillStyle = rayOr;
    ctx.fillRect(cx - p*5,   sy - p*7,  p*10, p*2);
    ctx.fillRect(cx - p*7,   sy - p*5,  p*14, p*10);
    ctx.fillRect(cx - p*5,   sy + p*5,  p*10, p*2);

    // ── Yellow body (rounded) ────────────────────────────────────────
    ctx.fillStyle = bodyYel;
    ctx.fillRect(cx - p*2,   sy - p*6,  p*4,  p);
    ctx.fillRect(cx - p*4,   sy - p*5,  p*8,  p*2);
    ctx.fillRect(cx - p*5,   sy - p*3,  p*10, p*2);
    ctx.fillRect(cx - p*6,   sy - p,    p*12, p*4);
    ctx.fillRect(cx - p*5,   sy + p*3,  p*10, p*2);
    ctx.fillRect(cx - p*4,   sy + p*5,  p*8,  p*2);
    ctx.fillRect(cx - p*2,   sy + p*7,  p*4,  p);

    // ── Highlight (top-left sheen) ───────────────────────────────────
    ctx.fillStyle = bodyHi;
    ctx.fillRect(cx - p*3,   sy - p*5,  p*2,  p*2);
    ctx.fillRect(cx - p*4,   sy - p*3,  p*2,  p*2);

    // ── Body outline ─────────────────────────────────────────────────
    ctx.fillStyle = outline;
    ctx.fillRect(cx - p*2,   sy - p*7,  p*4,  p);    // top
    ctx.fillRect(cx - p*4,   sy - p*6,  p*2,  p);
    ctx.fillRect(cx + p*2,   sy - p*6,  p*2,  p);
    ctx.fillRect(cx - p*6,   sy - p*5,  p,    p*2);   // top sides
    ctx.fillRect(cx + p*5,   sy - p*5,  p,    p*2);
    ctx.fillRect(cx - p*7,   sy - p*3,  p,    p*6);   // left/right mid
    ctx.fillRect(cx + p*6,   sy - p*3,  p,    p*6);
    ctx.fillRect(cx - p*6,   sy + p*3,  p,    p*2);   // bottom sides
    ctx.fillRect(cx + p*5,   sy + p*3,  p,    p*2);
    ctx.fillRect(cx - p*4,   sy + p*6,  p*2,  p);
    ctx.fillRect(cx + p*2,   sy + p*6,  p*2,  p);
    ctx.fillRect(cx - p*2,   sy + p*8,  p*4,  p);    // bottom

    // ── Sunglasses ────────────────────────────────────────────────────
    // Left lens frame
    ctx.fillStyle = outline;
    ctx.fillRect(cx - p*6,   sy - p*4,  p*5,  p);    // top
    ctx.fillRect(cx - p*6,   sy - p*3,  p,    p*4);  // left
    ctx.fillRect(cx - p*2,   sy - p*3,  p,    p*4);  // right
    ctx.fillRect(cx - p*6,   sy + p,    p*5,  p);    // bottom
    // Right lens frame
    ctx.fillRect(cx + p,     sy - p*4,  p*5,  p);
    ctx.fillRect(cx + p,     sy - p*3,  p,    p*4);
    ctx.fillRect(cx + p*5,   sy - p*3,  p,    p*4);
    ctx.fillRect(cx + p,     sy + p,    p*5,  p);
    // Bridge
    ctx.fillRect(cx - p,     sy - p*3,  p*2,  p);

    // Lens fill (dark grey)
    ctx.fillStyle = grayLens;
    ctx.fillRect(cx - p*5,   sy - p*3,  p*3,  p*4);  // left inner
    ctx.fillRect(cx + p*2,   sy - p*3,  p*3,  p*4);  // right inner

    // Lens sheen (checkerboard)
    ctx.fillStyle = sheenCol;
    ctx.fillRect(cx - p*5,   sy - p*3,  p,    p);
    ctx.fillRect(cx - p*4,   sy - p*2,  p,    p);
    ctx.fillRect(cx + p*2,   sy - p*3,  p,    p);
    ctx.fillRect(cx + p*3,   sy - p*2,  p,    p);

    // ── Blush ─────────────────────────────────────────────────────────
    ctx.fillStyle = blushCol;
    ctx.fillRect(cx - p*6,   sy + p,    p*2,  p*2);  // left cheek
    ctx.fillRect(cx + p*4,   sy + p,    p*2,  p*2);  // right cheek

    // ── Smile ─────────────────────────────────────────────────────────
    ctx.fillStyle = smileCol;
    ctx.fillRect(cx - p*3,   sy + p*4,  p,    p);    // left corner
    ctx.fillRect(cx - p*2,   sy + p*5,  p*5,  p);    // bottom arc
    ctx.fillRect(cx + p*2,   sy + p*4,  p,    p);    // right corner
};

export const drawPixelCloud = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    pixel: number
): void => {
    if (!isValidPixel(pixel) || !allFinite(cx, cy)) return;

    const p = pixel;

    // Bottom shadow
    ctx.fillStyle = toHsla("210 30% 76%", 0.55);
    ctx.fillRect(cx - p*11, cy + p*2, p*22, p*2);

    // Main fluffy body
    ctx.fillStyle = toHsla("0 0% 97%", 0.94);
    // Base (widest)
    ctx.fillRect(cx - p*11, cy - p,   p*22, p*3);
    // Middle build-up
    ctx.fillRect(cx - p*9,  cy - p*3, p*18, p*2);
    // Upper center
    ctx.fillRect(cx - p*5,  cy - p*5, p*10, p*2);
    // Peak puff
    ctx.fillRect(cx - p*2,  cy - p*7, p*5,  p*2);
    // Left puff
    ctx.fillRect(cx - p*14, cy - p,   p*5,  p*2);
    ctx.fillRect(cx - p*13, cy - p*3, p*4,  p*2);
    ctx.fillRect(cx - p*11, cy - p*5, p*3,  p);
    // Right puff
    ctx.fillRect(cx + p*9,  cy - p,   p*5,  p*2);
    ctx.fillRect(cx + p*9,  cy - p*3, p*4,  p*2);
    ctx.fillRect(cx + p*8,  cy - p*5, p*3,  p);

    // Highlight (top-left sheen)
    ctx.fillStyle = toHsla("0 0% 100%", 0.95);
    ctx.fillRect(cx - p*9,  cy - p*2, p*3,  p*2);
    ctx.fillRect(cx - p*4,  cy - p*4, p*2,  p*2);
    ctx.fillRect(cx - p*1,  cy - p*6, p*2,  p);
};

export const drawPixelTree = (
    ctx: CanvasRenderingContext2D,
    baseX: number,
    baseY: number,
    pixel: number,
    sway: number,
    variant = 0
): void => {
    if (!isValidPixel(pixel) || !allFinite(baseX, baseY, sway, variant)) return;

    const p = pixel;
    const sw  = snapToPixel(sway * p * 2, p);
    const sw2 = snapToPixel(sway * p * 3, p);
    const sw3 = snapToPixel(sway * p * 4, p);
    const type = ((Math.trunc(variant) % 4) + 4) % 4;

    if (type === 1) {
        ctx.fillStyle = toHsla("27 48% 25%", 0.95);
        ctx.fillRect(baseX - p, baseY - p * 8, p * 2, p * 8);
        ctx.fillRect(baseX - p * 3, baseY - p * 4, p * 2, p);
        ctx.fillRect(baseX + p, baseY - p * 5, p * 3, p);

        ctx.fillStyle = toHsla("126 44% 23%", 0.96);
        ctx.fillRect(baseX - p * 7 + sw, baseY - p * 17, p * 14, p * 7);
        ctx.fillRect(baseX - p * 5 + sw2, baseY - p * 21, p * 10, p * 5);
        ctx.fillRect(baseX - p * 6 + sw, baseY - p * 12, p * 12, p * 4);

        ctx.fillStyle = toHsla("96 52% 50%", 0.55);
        ctx.fillRect(baseX - p * 4 + sw, baseY - p * 20, p * 3, p * 2);
        ctx.fillRect(baseX + p * 2 + sw2, baseY - p * 18, p * 2, p * 2);

        if (variant % 2 === 0) {
            ctx.fillStyle = toHsla("8 78% 58%", 0.92);
            ctx.fillRect(baseX - p * 3 + sw, baseY - p * 15, p, p);
            ctx.fillRect(baseX + p * 4 + sw2, baseY - p * 13, p, p);
            ctx.fillRect(baseX + sw, baseY - p * 19, p, p);
        }
        return;
    }

    if (type === 2) {
        ctx.fillStyle = toHsla("28 50% 26%", 0.95);
        ctx.fillRect(baseX - p, baseY - p * 7, p * 2, p * 7);

        const rows = [2, 4, 5, 6, 5, 4, 3, 2] as const;
        for (const [row, halfWidth] of rows.entries()) {
            const y = baseY - p * (row * 2 + 10);
            const x = baseX - halfWidth * p + (row % 2 === 0 ? sw : sw2);
            ctx.fillStyle = toHsla(row < 3 ? "116 60% 32%" : "118 56% 27%", 0.95);
            ctx.fillRect(x, y, halfWidth * 2 * p, p * 2);
        }
        ctx.fillStyle = toHsla("112 66% 40%", 0.65);
        ctx.fillRect(baseX - p + sw3, baseY - p * 24, p * 2, p * 2);
        return;
    }

    if (type === 3) {
        ctx.fillStyle = toHsla("27 46% 24%", 0.97);
        ctx.fillRect(baseX - p, baseY - p * 8, p * 2, p * 8);
        ctx.fillStyle = toHsla("27 46% 24%", 0.9);
        drawPixelLine(ctx, baseX, baseY - p * 7, baseX - p * 4, baseY - p * 11, p);
        drawPixelLine(ctx, baseX, baseY - p * 8, baseX + p * 4, baseY - p * 12, p);

        ctx.fillStyle = toHsla("128 52% 25%", 0.96);
        ctx.fillRect(baseX - p * 8 + sw, baseY - p * 15, p * 7, p * 5);
        ctx.fillRect(baseX + p + sw2, baseY - p * 16, p * 7, p * 5);
        ctx.fillRect(baseX - p * 5 + sw3, baseY - p * 20, p * 10, p * 6);

        ctx.fillStyle = toHsla("132 58% 37%", 0.8);
        ctx.fillRect(baseX - p * 6 + sw, baseY - p * 18, p * 3, p * 2);
        ctx.fillRect(baseX + p * 2 + sw2, baseY - p * 19, p * 3, p * 2);
        return;
    }

    ctx.fillStyle = toHsla("24 46% 16%", 0.98);
    ctx.fillRect(baseX - p * 2, baseY - p * 8, p * 4, p * 8);
    ctx.fillStyle = toHsla("31 55% 34%", 0.98);
    ctx.fillRect(baseX - p, baseY - p * 8, p * 2, p * 8);

    ctx.fillStyle = toHsla("116 58% 18%", 0.98);
    ctx.fillRect(baseX - p * 7 + sw,  baseY - p * 13, p * 14, p * 5);
    ctx.fillRect(baseX - p * 6 + sw,  baseY - p * 16, p * 12, p * 4);
    ctx.fillRect(baseX - p * 5 + sw2, baseY - p * 19, p * 10, p * 4);
    ctx.fillRect(baseX - p * 3 + sw3, baseY - p * 22, p * 6,  p * 3);

    ctx.fillStyle = toHsla("102 68% 42%", 0.9);
    ctx.fillRect(baseX - p * 5 + sw, baseY - p * 18, p * 4, p * 2);
    ctx.fillRect(baseX + p + sw2, baseY - p * 15, p * 4, p * 2);
    ctx.fillRect(baseX - p * 2 + sw3, baseY - p * 21, p * 3, p);
};

export const drawPixelBush = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    baseY: number,
    pixel: number,
    variant: number
): void => {
    if (!isValidPixel(pixel) || !allFinite(cx, baseY, variant)) return;

    const p = pixel;
    const fruit = variant % 3 === 0;

    ctx.fillStyle = toHsla("105 46% 28%", 0.9);
    ctx.fillRect(cx - p * 5, baseY - p * 4, p * 10, p * 4);
    ctx.fillRect(cx - p * 4, baseY - p * 6, p * 8, p * 3);
    ctx.fillRect(cx - p * 2, baseY - p * 8, p * 4, p * 2);

    ctx.fillStyle = toHsla("92 52% 50%", 0.55);
    ctx.fillRect(cx - p * 4, baseY - p * 6, p * 2, p);
    ctx.fillRect(cx + p, baseY - p * 7, p * 2, p);

    if (fruit) {
        ctx.fillStyle = toHsla("48 92% 62%", 0.9);
        ctx.fillRect(cx - p * 2, baseY - p * 6, p, p);
        ctx.fillRect(cx + p * 3, baseY - p * 4, p, p);
    }
};

export const drawPixelRock = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    baseY: number,
    pixel: number,
    variant: number
): void => {
    if (!isValidPixel(pixel) || !allFinite(cx, baseY, variant)) return;

    const p = pixel;
    const wide = variant % 2 === 0;
    const width = wide ? p * 8 : p * 6;

    ctx.fillStyle = toHsla("28 28% 28%", 0.55);
    ctx.fillRect(cx - width / 2, baseY - p, width, p);
    ctx.fillStyle = toHsla("34 28% 52%", 0.95);
    ctx.fillRect(cx - width / 2, baseY - p * 4, width, p * 3);
    ctx.fillRect(cx - width / 2 + p, baseY - p * 5, width - p * 2, p);
    ctx.fillStyle = toHsla("34 34% 68%", 0.75);
    ctx.fillRect(cx - width / 2 + p, baseY - p * 5, p * 2, p);
    ctx.fillStyle = toHsla("25 30% 34%", 0.7);
    ctx.fillRect(cx + width / 2 - p * 2, baseY - p * 3, p, p * 2);
};

export const drawPixelMushroom = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    baseY: number,
    pixel: number,
    variant: number
): void => {
    if (!isValidPixel(pixel) || !allFinite(cx, baseY, variant)) return;

    const p = pixel;
    const capColor = variant % 2 === 0 ? "352 72% 58%" : "280 54% 62%";

    ctx.fillStyle = toHsla("36 40% 82%", 0.95);
    ctx.fillRect(cx - p, baseY - p * 3, p * 2, p * 3);
    ctx.fillStyle = toHsla(capColor, 0.95);
    ctx.fillRect(cx - p * 3, baseY - p * 5, p * 6, p * 2);
    ctx.fillRect(cx - p * 2, baseY - p * 6, p * 4, p);
    ctx.fillStyle = toHsla("0 0% 96%", 0.9);
    ctx.fillRect(cx - p, baseY - p * 5, p, p);
    ctx.fillRect(cx + p * 2, baseY - p * 4, p, p);
};

export const drawPixelFlower = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    baseY: number,
    pixel: number,
    phase: number,
    type: number
): void => {
    if (!isValidPixel(pixel) || !allFinite(cx, baseY, phase, type)) return;

    const p = pixel;
    const wobble = snapToPixel(Math.sin(phase) * p, p);
    const petalColors = [
        "330 75% 72%",
        "48 100% 65%",
        "200 68% 68%",
        "280 58% 72%",
    ] as const;
    const colorIndex = ((Math.trunc(type) % petalColors.length) + petalColors.length) % petalColors.length;
    const petalColor = petalColors[colorIndex] ?? petalColors[0];

    ctx.fillStyle = toHsla("120 48% 30%", 0.85);
    ctx.fillRect(cx, baseY - p * 3, p, p * 3);

    ctx.fillStyle = toHsla(petalColor, 0.9);
    ctx.fillRect(cx - p + wobble, baseY - p * 4, p, p);
    ctx.fillRect(cx + p + wobble, baseY - p * 4, p, p);
    ctx.fillRect(cx + wobble,     baseY - p * 5, p, p);
    ctx.fillRect(cx + wobble,     baseY - p * 3, p, p);

    ctx.fillStyle = toHsla("48 100% 72%", 0.95);
    ctx.fillRect(cx + wobble, baseY - p * 4, p, p);
};
export const drawPixelRainbow = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    baseY: number,
    maxR: number,
    pixel: number,
    alpha: number
): void => {
    if (!isValidPixel(pixel) || !allFinite(cx, baseY, maxR, alpha) || maxR <= 0) return;

    const p = pixel;
    const opacity = clamp01(alpha);
    const colors = [
        "0 80% 60%",    // red
        "25 90% 58%",   // orange
        "52 90% 60%",   // yellow
        "120 55% 45%",  // green
        "210 80% 58%",  // blue
        "260 65% 62%",  // indigo
        "290 60% 65%",  // violet
    ] as const;

    for (const [colorIndex, color] of colors.entries()) {
        const r = maxR - colorIndex * p * 2;
        if (r <= p * 2) continue;

        ctx.fillStyle = toHsla(color, opacity * 0.6);
        for (let x = snapToPixel(cx - r, p); x <= cx + r; x += p) {
            const dx = x - cx;
            if (Math.abs(dx) > r) continue;

            const radicand = Math.max(0, r * r - dx * dx);
            const y = snapToPixel(baseY - Math.sqrt(radicand), p);
            ctx.fillRect(x, y, p, p * 2);
        }
    }
};
export const drawPixelBalloon = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    pixel: number,
    t: number
): void => {
    if (!isValidPixel(pixel) || !allFinite(cx, cy, t)) return;

    const p = pixel;
    const centerX = snapToPixel(cx, p);
    const bob = snapToPixel(Math.sin(t * 0.7) * p * 2, p);
    const by = snapToPixel(cy, p) + bob;

    // Color sections left→right: red, orange, yellow, green, cyan.
    const sections = [
        { h: 0,   s: 85,  l: 50 },
        { h: 22,  s: 95,  l: 52 },
        { h: 52,  s: 100, l: 57 },
        { h: 110, s: 65,  l: 44 },
        { h: 188, s: 80,  l: 48 },
    ] as const;
    const dark = "0 0% 8%";

    // Half-width of each balloon row, measured in pixel-grid cells.
    const balloonRows = [3, 5, 7, 8, 9, 9, 9, 9, 9, 8, 7, 6, 4, 3] as const;
    const totalRows = balloonRows.length;
    const maxHalfWidth = Math.max(...balloonRows);
    const fullWidthInCells = maxHalfWidth * 2;
    const topY = by - totalRows * p;

    // Draw a one-cell outline around the complete silhouette.
    ctx.fillStyle = toHsla(dark, 0.92);
    for (const [row, halfWidth] of balloonRows.entries()) {
        const rx = centerX - halfWidth * p;
        const ry = topY + row * p;
        const width = halfWidth * 2 * p;

        ctx.fillRect(rx - p, ry, width + p * 2, p);
        ctx.fillRect(rx, ry - p, width, p * 3);
    }

    // Draw the colored envelope one grid cell at a time. This avoids seams
    // caused by fractional section boundaries when pixel is not divisible by 5.
    for (const [row, halfWidth] of balloonRows.entries()) {
        const ry = topY + row * p;

        for (let column = -halfWidth; column < halfWidth; column++) {
            const normalizedColumn = column + maxHalfWidth;
            const rawSectionIndex = Math.floor(
                (normalizedColumn * sections.length) / fullWidthInCells
            );
            const sectionIndex = Math.min(
                sections.length - 1,
                Math.max(0, rawSectionIndex)
            );
            const section = sections[sectionIndex] ?? sections[0];

            const sectionStart =
                -maxHalfWidth + (sectionIndex * fullWidthInCells) / sections.length;
            const sectionEnd =
                -maxHalfWidth + ((sectionIndex + 1) * fullWidthInCells) / sections.length;
            const sectionCenter = (sectionStart + sectionEnd) / 2;
            const halfSectionWidth = Math.max((sectionEnd - sectionStart) / 2, 0.5);
            const distance = Math.abs(column + 0.5 - sectionCenter) / halfSectionWidth;
            const lightness = Math.min(90, section.l * (distance < 0.35 ? 1.1 : 1));

            ctx.fillStyle = toHsla(
                `${section.h} ${section.s}% ${lightness}%`,
                0.97
            );
            ctx.fillRect(centerX + column * p, ry, p, p);
        }
    }

    // Highlight sheen — top-left glint.
    ctx.fillStyle = toHsla("52 100% 90%", 0.45);
    ctx.fillRect(centerX - p * 3, topY + p * 2, p * 2, p);
    ctx.fillRect(centerX - p * 4, topY + p * 3, p, p);

    // Ropes.
    ctx.fillStyle = toHsla(dark, 0.75);
    ctx.fillRect(centerX - p * 4, by + p,     p, p * 4);
    ctx.fillRect(centerX + p * 3, by + p,     p, p * 4);
    ctx.fillRect(centerX - p * 2, by + p * 2, p, p * 3);
    ctx.fillRect(centerX + p,     by + p * 2, p, p * 3);

    // Basket outline.
    const basketColumns = 8;
    const basketRows = 4;
    const bx = centerX - p * 4;
    const basketY = by + p * 5;
    const basketWidth = basketColumns * p;
    const basketHeight = basketRows * p;

    ctx.fillStyle = toHsla(dark, 0.92);
    ctx.fillRect(bx - p, basketY - p, basketWidth + p * 2, p);
    ctx.fillRect(bx - p, basketY,     p, basketHeight);
    ctx.fillRect(bx + basketWidth, basketY, p, basketHeight);
    ctx.fillRect(bx - p, basketY + basketHeight, basketWidth + p * 2, p);

    // Basket fill — checkerboard pattern.
    for (let row = 0; row < basketRows; row++) {
        for (let column = 0; column < basketColumns; column++) {
            const even = (row + column) % 2 === 0;
            ctx.fillStyle = toHsla(even ? "34 55% 52%" : "34 55% 36%", 0.97);
            ctx.fillRect(bx + column * p, basketY + row * p, p, p);
        }
    }

    // Top basket rim highlight.
    ctx.fillStyle = toHsla("34 50% 75%", 0.7);
    ctx.fillRect(bx, basketY, basketWidth, p);
};
