import { snapToPixel, toHsla } from "../shared/utils";

export const drawPixelSun = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    pixel: number,
    nod: number
) => {
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
) => {
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
    sway: number
) => {
    const p = pixel;
    const sw  = snapToPixel(sway * p * 2, p);
    const sw2 = snapToPixel(sway * p * 3, p);
    const sw3 = snapToPixel(sway * p * 4, p);

    ctx.fillStyle = toHsla("28 50% 26%", 0.92);
    ctx.fillRect(baseX - p, baseY - p * 7, p * 2, p * 7);

    ctx.fillStyle = toHsla("135 48% 24%", 0.9);
    ctx.fillRect(baseX - p * 5 + sw,  baseY - p * 11, p * 10, p * 4);

    ctx.fillStyle = toHsla("135 52% 32%", 0.9);
    ctx.fillRect(baseX - p * 4 + sw,  baseY - p * 14, p * 8,  p * 4);

    ctx.fillStyle = toHsla("135 48% 24%", 0.88);
    ctx.fillRect(baseX - p * 3 + sw2, baseY - p * 17, p * 6,  p * 3);

    ctx.fillStyle = toHsla("140 54% 35%", 0.88);
    ctx.fillRect(baseX - p * 2 + sw3, baseY - p * 19, p * 4,  p * 2);
};

export const drawPixelFlower = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    baseY: number,
    pixel: number,
    phase: number,
    type: number
) => {
    const p = pixel;
    const wobble = snapToPixel(Math.sin(phase) * p, p);
    const petalColors = ["330 75% 72%", "48 100% 65%", "200 68% 68%", "280 58% 72%"];

    ctx.fillStyle = toHsla("120 48% 30%", 0.85);
    ctx.fillRect(cx, baseY - p * 3, p, p * 3);

    ctx.fillStyle = toHsla(petalColors[type % 4], 0.9);
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
) => {
    const p = pixel;
    const colors = [
        "0 80% 60%",    // red
        "25 90% 58%",   // orange
        "52 90% 60%",   // yellow
        "120 55% 45%",  // green
        "210 80% 58%",  // blue
        "260 65% 62%",  // indigo
        "290 60% 65%",  // violet
    ];
    for (let ci = 0; ci < colors.length; ci++) {
        const r = maxR - ci * p * 2;
        if (r <= p * 2) continue;
        ctx.fillStyle = toHsla(colors[ci], alpha * 0.6);
        for (let x = snapToPixel(cx - r, p); x <= cx + r; x += p) {
            const dx = x - cx;
            if (Math.abs(dx) > r) continue;
            const y = snapToPixel(baseY - Math.sqrt(r * r - dx * dx), p);
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
) => {
    const p = pixel;
    const bob = snapToPixel(Math.sin(t * 0.7) * p * 2, p);
    const by = cy + bob;

    // Color sections left→right: red, orange, yellow, green, cyan
    const sections = [
        "0 85% 50%",    // red
        "22 95% 52%",   // orange
        "52 100% 57%",  // yellow
        "110 65% 44%",  // green
        "188 80% 48%",  // cyan
    ];
    const dark = "0 0% 8%";

    // Balloon shape row by row — (rowOffset from top, halfWidth in pixels)
    // Row 0 = top, row N = bottom of balloon
    // format: [halfWidth] — centered on cx
    const balloonRows = [
        [3],          // row 0 (top cap)
        [5],          // row 1
        [7],          // row 2
        [8],          // row 3
        [9],          // row 4
        [9],          // row 5
        [9],          // row 6
        [9],          // row 7  (widest)
        [9],          // row 8
        [8],          // row 9
        [7],          // row 10
        [6],          // row 11
        [4],          // row 12
        [3],          // row 13 (bottom taper)
    ];
    const totalRows = balloonRows.length;

    // Section boundaries (x offsets from cx): split the widest row into 5 equal sections
    // Each section is ~(9*2)/5 ≈ 3.6p wide — use pixel-snapped boundaries
    const secW = Math.round((9 * 2 * p) / 5);
    const secStarts = [-9 * p, -9 * p + secW, -9 * p + secW * 2, -9 * p + secW * 3, -9 * p + secW * 4];

    // Helper: which section does x belong to?
    const getSectionIdx = (xOffset: number): number => {
        for (let s = sections.length - 1; s >= 0; s--) {
            if (xOffset >= secStarts[s]) return s;
        }
        return 0;
    };

    // Draw outline first (slightly wider/taller)
    ctx.fillStyle = toHsla(dark, 0.92);
    for (let row = 0; row < totalRows; row++) {
        const hw = balloonRows[row][0] * p + p; // +1p outline
        const rx = snapToPixel(cx - hw, p);
        const ry = by - (totalRows - row) * p;
        ctx.fillRect(rx, ry, hw * 2, p + (row === 0 ? p : 0));
    }

    // Draw colored sections row by row
    for (let row = 0; row < totalRows; row++) {
        const hw = balloonRows[row][0] * p;
        const ry = by - (totalRows - row) * p;
        let x = cx - hw;
        while (x < cx + hw) {
            const xOffset = x - cx;
            const si = getSectionIdx(xOffset);
            // How far until the next section or end of row?
            const nextBoundary = si + 1 < sections.length ? cx + secStarts[si + 1] : cx + hw;
            const segW = Math.min(nextBoundary, cx + hw) - x;
            if (segW <= 0) break;
            // Slightly lighter in the middle of each section for 3D feel
            const midOffset = cx + secStarts[si] + secW * 0.5;
            const distFromMid = Math.abs(x + segW / 2 - midOffset) / (secW * 0.5);
            const brightness = distFromMid < 0.35 ? 1.1 : 1.0;
            const parts = sections[si].split(" ");
            const h = parseFloat(parts[0]);
            const s = parseFloat(parts[1]);
            const l = parseFloat(parts[2]);
            const lAdjusted = Math.min(90, l * brightness);
            ctx.fillStyle = `hsla(${h}, ${s}%, ${lAdjusted}%, 0.97)`;
            ctx.fillRect(snapToPixel(x, p), ry, snapToPixel(segW, p) || p, p);
            const nextX = snapToPixel(x + segW, p);
            x = nextX > x ? nextX : x + p;
        }
    }

    // Highlight sheen — top-left glint
    ctx.fillStyle = toHsla("52 100% 90%", 0.45);
    ctx.fillRect(snapToPixel(cx - p * 3, p), by - p * (totalRows - 2), p * 2, p);
    ctx.fillRect(snapToPixel(cx - p * 4, p), by - p * (totalRows - 3), p,     p);

    // ── Ropes ────────────────────────────────────────────────────────
    ctx.fillStyle = toHsla(dark, 0.75);
    ctx.fillRect(snapToPixel(cx - p * 4, p), by + p, p, p * 4);  // left rope
    ctx.fillRect(snapToPixel(cx + p * 3, p), by + p, p, p * 4);  // right rope
    ctx.fillRect(snapToPixel(cx - p * 2, p), by + p * 2, p, p * 3); // inner left
    ctx.fillRect(snapToPixel(cx + p,     p), by + p * 2, p, p * 3); // inner right

    // ── Basket outline ────────────────────────────────────────────────
    const bx = snapToPixel(cx - p * 4, p);
    const basketY = by + p * 5;
    ctx.fillStyle = toHsla(dark, 0.92);
    ctx.fillRect(bx - p, basketY - p, p * 10 + p, p);           // top bar
    ctx.fillRect(bx - p, basketY,     p,           p * 5);       // left wall
    ctx.fillRect(bx + p * 9, basketY, p,           p * 5);       // right wall
    ctx.fillRect(bx - p, basketY + p * 5, p * 10 + p, p);       // bottom

    // Basket fill — checkerboard pattern (tan/brown alternating)
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 8; col++) {
            const even = (row + col) % 2 === 0;
            ctx.fillStyle = toHsla(even ? "34 55% 52%" : "34 55% 36%", 0.97);
            ctx.fillRect(bx + col * p, basketY + row * p, p, p);
        }
    }

    // Top basket rim highlight
    ctx.fillStyle = toHsla("34 50% 75%", 0.7);
    ctx.fillRect(bx, basketY, p * 8, p);
};
