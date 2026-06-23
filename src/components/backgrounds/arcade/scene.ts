import { clamp } from "../shared/utils";
import type { Palette } from "../shared/types";

// Pixel-art palm tree centered at (cx, baseY) with unit size s
function drawPixelPalmTree(
    ctx: CanvasRenderingContext2D,
    cx: number,
    baseY: number,
    s: number
): void {
    const u = Math.max(1, Math.round(s));
    const trunkH = u * 5;
    const tx = Math.round(cx - u * 0.5);
    const ty = Math.round(baseY - trunkH);

    ctx.fillStyle = "#6b4820";
    ctx.fillRect(tx, ty, u, trunkH);

    ctx.fillStyle = "#1a7212";
    ctx.fillRect(Math.round(cx - u * 3), ty - u,      u * 2, u);
    ctx.fillRect(Math.round(cx - u * 2), ty - u * 2,  u * 2, u);
    ctx.fillRect(Math.round(cx + u),     ty - u,      u * 2, u);
    ctx.fillRect(Math.round(cx),         ty - u * 2,  u * 2, u);
    ctx.fillRect(Math.round(cx - u),     ty - u * 3,  u * 2, u);

    ctx.fillStyle = "#28b020";
    ctx.fillRect(Math.round(cx - u), ty - u * 2, u, u);
    ctx.fillRect(Math.round(cx),     ty - u * 3, u, u);

    if (u >= 3) {
        ctx.fillStyle = "#9a6020";
        ctx.fillRect(Math.round(cx - u * 0.5), ty - u, u, u);
    }
}

// Pixel-art Ferrari Testarossa convertible (rear view, OutRun style)
// centerX = road center, bottomY = base of car on road surface
function drawPixelCar(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    bottomY: number,
    s: number
): void {
    const u  = Math.max(2, Math.round(s));
    const bH = u * 9;  // body half-width  → total body = 18u
    const x  = Math.round(centerX - bH); // left edge
    const y  = Math.round(bottomY);      // road surface
    const r  = Math.round;

    // ── Shadow ───────────────────────────────────────────────────────────────
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(x + u * 2, y, bH * 2 - u * 4, r(u * 0.55));

    // ── Rear wheels (drawn first so fenders overlap them) ────────────────────
    const wExt = r(u * 1.4); // wheels stick out sideways
    ctx.fillStyle = "#111111";
    ctx.fillRect(x - wExt,          y - u * 3, wExt + u,     u * 3); // left
    ctx.fillRect(x + bH * 2 - u,   y - u * 3, wExt + u,     u * 3); // right
    // Rims
    ctx.fillStyle = "#c8c8c8";
    ctx.fillRect(x - r(wExt * 0.8), y - u * 3 + r(u * 0.4), r(wExt * 0.7),  r(u * 2.2));
    ctx.fillRect(x + bH * 2 + r(wExt * 0.1), y - u * 3 + r(u * 0.4), r(wExt * 0.7), r(u * 2.2));

    // ── Lower body + Testarossa strakes (y-3u … y-u) ─────────────────────────
    ctx.fillStyle = "#c81818";
    ctx.fillRect(x, y - u * 3, bH * 2, u * 2);

    // Horizontal strakes (side vents) — left & right flanks
    ctx.fillStyle = "#881010";
    for (let si = 0; si < 4; si++) {
        const sOff = r(si * u * 0.45);
        ctx.fillRect(x,             y - u * 3 + sOff, u * 4, r(u * 0.35));
        ctx.fillRect(x + bH * 2 - u * 4, y - u * 3 + sOff, u * 4, r(u * 0.35));
    }

    // Tail lights (outer top of lower body, bright red)
    ctx.fillStyle = "#ff2200";
    ctx.fillRect(x,             y - u * 3, u * 3, u);
    ctx.fillRect(x + bH * 2 - u * 3, y - u * 3, u * 3, u);
    // Inner secondary lights (dimmer)
    ctx.fillStyle = "#cc1100";
    ctx.fillRect(x + u * 3,          y - u * 3, u * 2, u);
    ctx.fillRect(x + bH * 2 - u * 5, y - u * 3, u * 2, u);

    // Rear bumper
    ctx.fillStyle = "#5a6060";
    ctx.fillRect(x + u * 3, y - u, bH * 2 - u * 6, u);
    // Exhaust pipes
    ctx.fillStyle = "#303838";
    ctx.fillRect(x + u * 4, y - u, u, u);
    ctx.fillRect(x + bH * 2 - u * 5, y - u, u, u);

    // ── Upper body / cockpit surround (y-5u … y-3u) ──────────────────────────
    ctx.fillStyle = "#c81818";
    ctx.fillRect(x, y - u * 5, bH * 2, u * 2);

    // Open cockpit interior (convertible — no roof, dark cavity)
    ctx.fillStyle = "#06060f";
    ctx.fillRect(x + u * 3, y - u * 5, bH * 2 - u * 6, u * 2);

    // Windshield header bar (top edge of windshield frame, very thin)
    ctx.fillStyle = "#901212";
    ctx.fillRect(x + u * 2, y - u * 5, bH * 2 - u * 4, u);

    // Door cap strips (sides of cockpit opening)
    ctx.fillStyle = "#b01515";
    ctx.fillRect(x,             y - u * 5, u * 3, u * 2);
    ctx.fillRect(x + bH * 2 - u * 3, y - u * 5, u * 3, u * 2);

    // ── Passenger heads (above the windshield frame) ─────────────────────────
    // Passenger — LEFT seat, blonde hair
    const pX = x + u * 4;
    ctx.fillStyle = "#f0c030";        // bright blonde
    ctx.fillRect(pX,           y - u * 7, r(u * 2.5), u * 2);
    ctx.fillStyle = "#fad850";        // highlight
    ctx.fillRect(pX + r(u * 0.5), y - u * 7, r(u * 1.5), u);

    // Driver — RIGHT seat, dark brown hair
    const dX = x + bH * 2 - u * 6;
    ctx.fillStyle = "#4a2010";
    ctx.fillRect(dX,           y - u * 7, r(u * 2.5), u * 2);
    ctx.fillStyle = "#331408";        // shadow under hair
    ctx.fillRect(dX + r(u * 0.5), y - u * 7, r(u * 1.5), u);

    // ── Body specular highlights ──────────────────────────────────────────────
    ctx.fillStyle = "#e83030";
    ctx.fillRect(x + u,           y - u * 5, bH * 2 - u * 2, r(u * 0.4));
    ctx.fillRect(x + u,           y - u * 3, bH * 2 - u * 2, r(u * 0.4));
}

export const drawArcadeGrid = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    t: number,
    progressNorm: number,
    volumeNorm: number,
    isPlaying: boolean,
    _palette: Palette
): void => {
    const pixel = Math.max(2, Math.floor(Math.min(width, height) / 220));
    const speed = isPlaying ? clamp(0.12 + volumeNorm * 0.38, 0.12, 0.52) : 0.04;

    // Horizon at a fixed % of height (defines camera tilt)
    const horizonY = Math.floor(height * 0.35);

    // Subtle road curve driven by music
    const curveOffset = Math.sin(t * 0.22 + progressNorm * Math.PI * 2) * width * 0.038;
    const vpX = width * 0.5 + curveOffset;

    // ─── Fixed-slope perspective ────────────────────────────────────────────
    // Road half-width grows linearly with pixels below horizon at a CONSTANT
    // slope. This means the camera angle is always the same regardless of
    // window height — a taller window just reveals more near-road, it does
    // not widen the road angle.
    const ROAD_SLOPE = 0.72; // screen px of road half-width per px below horizon
    const roadHalfAt = (sy: number) => ROAD_SLOPE * (sy - horizonY);
    const lEdge = (sy: number) => vpX - roadHalfAt(sy);
    const rEdge = (sy: number) => vpX + roadHalfAt(sy);

    // ── Sky ──────────────────────────────────────────────────────────────────
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGrad.addColorStop(0,   "#0e3a8c");
    skyGrad.addColorStop(0.6, "#2878d0");
    skyGrad.addColorStop(1,   "#68c4f0");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, horizonY);

    // Sun
    const sunX = Math.round(vpX + width * 0.10);
    const sunY = Math.round(horizonY * 0.60);
    const sunR = Math.max(pixel * 3, Math.round(Math.min(width, height) * 0.048));
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 2.6);
    sunGrad.addColorStop(0,    "rgba(255,240,60,1)");
    sunGrad.addColorStop(0.38, "rgba(255,170,15,0.65)");
    sunGrad.addColorStop(1,    "rgba(255,80,0,0)");
    ctx.fillStyle = sunGrad;
    ctx.fillRect(sunX - sunR * 2.6, sunY - sunR * 2.6, sunR * 5.2, sunR * 5.2);
    ctx.fillStyle = "#ffe840";
    ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);

    // Clouds
    const cloudDefs = [
        { bx: 0.08, by: 0.14, cw: 0.09, spd: 0.006 },
        { bx: 0.34, by: 0.22, cw: 0.11, spd: 0.004 },
        { bx: 0.60, by: 0.10, cw: 0.08, spd: 0.007 },
        { bx: 0.80, by: 0.28, cw: 0.10, spd: 0.005 },
    ] as const;
    cloudDefs.forEach(({ bx, by, cw: cwRatio, spd }) => {
        const cw = Math.round(width * cwRatio);
        const ch = Math.round(cw * 0.30);
        const cx = ((bx * width + t * spd * width) % (width + cw * 2)) - cw;
        const cy = Math.round(horizonY * by);
        ctx.fillStyle = "rgba(255,255,255,0.70)";
        ctx.fillRect(cx,                cy,           cw,         ch);
        ctx.fillRect(cx + cw * 0.18,    cy - ch,      cw * 0.58,  ch * 1.05);
        ctx.fillRect(cx + cw * 0.42,    cy - ch * 0.5, cw * 0.38, ch * 0.8);
    });

    // ── Ground & road scanlines ───────────────────────────────────────────────
    for (let sy = horizonY; sy < height; sy += pixel) {
        const le = lEdge(sy);
        const re = rEdge(sy);

        // Perspective depth for animation only (not for geometry)
        const depth = (sy - horizonY) / Math.max(1, height - horizonY);

        // Alternating grass strips (classic racer scrolling effect)
        const worldZ = 1.0 / Math.max(0.001, depth);
        const stripPhase = ((worldZ * 0.08 + t * speed * 12) % 2 + 2) % 2;
        const altStrip = stripPhase < 1;

        // Fill entire row with grass first, then road overwrites the center.
        // This handles road going off-screen on either side cleanly.
        ctx.fillStyle = altStrip ? "#176810" : "#22961a";
        ctx.fillRect(0, sy, width, pixel);

        // Road surface (clipped to canvas)
        const leC = Math.max(0, Math.floor(le));
        const reC = Math.min(width, Math.ceil(re));
        if (reC > leC) {
            const grayL = Math.floor(clamp(38 + depth * 22, 38, 62));
            ctx.fillStyle = `hsl(215,9%,${grayL}%)`;
            ctx.fillRect(leC, sy, reC - leC, pixel);
        }

        // White road-edge lines (only when edge is on-screen)
        const lineW = Math.max(pixel, Math.round(roadHalfAt(sy) * 0.015));
        ctx.fillStyle = "rgba(255,255,255,0.88)";
        if (le >= 0 && le < width)
            ctx.fillRect(Math.floor(le), sy, lineW, pixel);
        if (re > 0 && re <= width)
            ctx.fillRect(Math.ceil(re) - lineW, sy, lineW, pixel);
    }

    // ── Dashed center lane markings ───────────────────────────────────────────
    const dashCount = 10;
    for (let i = 0; i < dashCount; i++) {
        const phase = ((i / dashCount + t * speed * 0.82) % 1 + 1) % 1;
        if (phase < 0.04 || phase > 0.97) continue;

        const sy    = horizonY + phase * (height - horizonY);
        const roadW = roadHalfAt(sy) * 2;
        const dashW = Math.max(pixel, Math.round(roadW * 0.026));
        const dashH = Math.max(pixel, Math.round((height - horizonY) * 0.024 * (0.2 + phase * 0.8)));

        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fillRect(Math.round(vpX - dashW * 0.5), Math.round(sy), dashW, dashH);
    }

    // ── Palm trees ────────────────────────────────────────────────────────────
    const treeCount = 8;
    for (let i = 0; i < treeCount; i++) {
        const phase = ((i / treeCount + t * speed * 0.55) % 1 + 1) % 1;
        if (phase < 0.04 || phase > 0.96) continue;

        const sy     = horizonY + phase * (height - horizonY);
        const le     = lEdge(sy);
        const re     = rEdge(sy);
        const treeS  = Math.max(1, Math.round(phase * pixel * 5.0));
        const margin = treeS * 2.8;

        if (le - margin < width + treeS * 8)
            drawPixelPalmTree(ctx, le - margin, sy, treeS);
        if (re + margin > -treeS * 8)
            drawPixelPalmTree(ctx, re + margin, sy, treeS);
    }

    // ── Player car ───────────────────────────────────────────────────────────
    // Size relative to the smaller screen dimension for consistent proportions.
    const carS = Math.max(2, Math.floor(Math.min(width, height) / 88));
    // Car sits on road surface (height), centered on the road's vanishing axis.
    drawPixelCar(ctx, vpX, height, carS);

    // ── CRT scanline overlay ──────────────────────────────────────────────────
    for (let y = 0; y < height; y += pixel * 2) {
        ctx.fillStyle = "rgba(0,0,0,0.04)";
        ctx.fillRect(0, y, width, 1);
    }
};
