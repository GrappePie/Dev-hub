import { snapToPixel, toHsla } from "../shared/utils";

export const drawSpaceShuttle = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    pixel: number,
    t: number
) => {
    const p = pixel;

    // Engine glow (pulsing)
    const glow = 0.55 + Math.sin(t * 5) * 0.3;
    ctx.fillStyle = toHsla("25 100% 60%", glow * 0.9);
    ctx.fillRect(cx - p * 8, cy - p, p * 2, p * 2);
    ctx.fillStyle = toHsla("48 100% 68%", glow * 0.5);
    ctx.fillRect(cx - p * 9, cy - p, p, p * 2);

    // Main fuselage
    ctx.fillStyle = toHsla("0 0% 88%", 0.97);
    ctx.fillRect(cx - p * 6, cy - p * 2, p * 12, p * 4);

    // Nose cone
    ctx.fillStyle = toHsla("0 0% 78%", 0.95);
    ctx.fillRect(cx + p * 6, cy - p, p * 2, p * 2);
    ctx.fillRect(cx + p * 8, cy,     p,     p);

    // Top wing
    ctx.fillStyle = toHsla("0 0% 75%", 0.92);
    ctx.fillRect(cx - p * 3, cy - p * 4, p * 6, p * 2);
    ctx.fillRect(cx - p * 5, cy - p * 5, p * 3, p);
    // Bottom wing
    ctx.fillRect(cx - p * 3, cy + p * 2, p * 6, p * 2);
    ctx.fillRect(cx - p * 5, cy + p * 4, p * 3, p);
    // Vertical tail
    ctx.fillRect(cx - p * 5, cy - p * 5, p * 2, p * 3);

    // Cockpit windows
    ctx.fillStyle = toHsla("200 75% 60%", 0.9);
    ctx.fillRect(cx + p * 3, cy - p, p * 2, p);
    ctx.fillStyle = toHsla("0 0% 0%", 0.25);
    ctx.fillRect(cx + p * 4, cy - p, p, p);

    // NASA stripe
    ctx.fillStyle = toHsla("210 80% 50%", 0.75);
    ctx.fillRect(cx - p * 4, cy - p, p * 6, p);

    // Tether anchor + wavy line to astronaut
    const astBobX = snapToPixel(Math.sin(t * 0.55) * p * 4, p);
    const astBobY = snapToPixel(Math.cos(t * 0.75) * p * 3, p);
    const astX = cx - p * 18 + astBobX;
    const astY = cy + p * 9  + astBobY;
    const tetX  = cx - p * 6;
    const tetY  = cy;

    ctx.fillStyle = toHsla("0 0% 82%", 0.65);
    const steps = 12;
    for (let s = 0; s <= steps; s++) {
        const f  = s / steps;
        const tx = snapToPixel(tetX + (astX - tetX) * f, p);
        const ty = snapToPixel(tetY + (astY - tetY) * f + Math.sin(f * Math.PI * 2.5 + t * 1.4) * p * 2, p);
        ctx.fillRect(tx, ty, p, p);
    }

    // Astronaut — helmet
    ctx.fillStyle = toHsla("0 0% 92%", 0.96);
    ctx.fillRect(astX - p, astY - p * 3, p * 3, p * 3);
    ctx.fillStyle = toHsla("0 0% 60%", 0.3); // helmet shadow left
    ctx.fillRect(astX - p, astY - p * 3, p, p * 3);
    ctx.fillStyle = toHsla("195 75% 55%", 0.88); // visor
    ctx.fillRect(astX, astY - p * 2, p, p);

    // Body / suit
    ctx.fillStyle = toHsla("0 0% 88%", 0.96);
    ctx.fillRect(astX - p, astY, p * 3, p * 3);
    ctx.fillStyle = toHsla("210 60% 55%", 0.7); // chest panel
    ctx.fillRect(astX, astY + p, p, p);

    // Arms (opposite wave for zero-g feel)
    const armWave = snapToPixel(Math.sin(t * 0.9) * p * 1.5, p);
    ctx.fillStyle = toHsla("0 0% 85%", 0.92);
    ctx.fillRect(astX - p * 2, astY +  armWave, p, p * 2);
    ctx.fillRect(astX + p * 2, astY - armWave,  p, p * 2);

    // Legs (slightly splayed)
    ctx.fillStyle = toHsla("0 0% 80%", 0.9);
    ctx.fillRect(astX - p, astY + p * 3, p, p * 2);
    ctx.fillRect(astX + p, astY + p * 3, p, p * 2);

    // Backpack life-support
    ctx.fillStyle = toHsla("210 45% 52%", 0.92);
    ctx.fillRect(astX + p * 2, astY, p, p * 2);
    ctx.fillStyle = toHsla("0 0% 95%", 0.45);
    ctx.fillRect(astX + p * 2, astY, p, p);
};

export const drawSpaceContent = (
    ctx: CanvasRenderingContext2D,
    width: number,
    groundY: number,
    pixel: number,
    t: number,
    energy: number
) => {
    const p = pixel;
    const spaceZone = groundY * 0.55; // top 55% is "space"

    // Stars — fractional positions so they stay stable at any zoom/size
    const starCount = 80;
    const darkZone = groundY * 0.38; // only in the truly dark space area
    for (let i = 0; i < starCount; i++) {
        const fx = ((i * 1637 + 113) % 997) / 997;   // 0..1
        const fy = ((i * 947  + 251) % 991) / 991;   // 0..1
        const sx = snapToPixel(fx * width, p);
        const sy = snapToPixel(fy * darkZone, p);
        const twinkle = Math.sin(t * (1.2 + (i % 7) * 0.35) + i * 0.9);
        const bright = 0.35 + twinkle * 0.5;
        if (bright < 0.08) continue;
        const isLarge = i % 9 === 0;
        ctx.fillStyle = toHsla(i % 4 === 0 ? "220 60% 90%" : "0 0% 96%", bright);
        ctx.fillRect(sx, sy, isLarge ? p * 2 : p, isLarge ? p * 2 : p);
    }

    // Shooting star — cycles every ~8 seconds
    const shotCycle = (t * 0.12) % 1;
    if (shotCycle < 0.18) {
        const progress = shotCycle / 0.18;
        const startX = width * 0.25;
        const startY = groundY * 0.05;
        const length = width * 0.18;
        const sx = snapToPixel(startX + length * progress, p);
        const sy = snapToPixel(startY + length * 0.35 * progress, p);
        for (let seg = 0; seg < 6; seg++) {
            const segAlpha = (1 - seg / 6) * (1 - progress) * 0.9;
            if (segAlpha < 0.05) continue;
            ctx.fillStyle = toHsla("0 0% 98%", segAlpha);
            ctx.fillRect(sx - seg * p * 2, sy - seg * p, p * 2, p);
        }
    }
    // Second shooting star offset in time
    const shotCycle2 = ((t * 0.12) + 0.55) % 1;
    if (shotCycle2 < 0.14) {
        const progress = shotCycle2 / 0.14;
        const startX = width * 0.6;
        const startY = groundY * 0.08;
        const length = width * 0.14;
        const sx = snapToPixel(startX + length * progress, p);
        const sy = snapToPixel(startY + length * 0.3 * progress, p);
        for (let seg = 0; seg < 5; seg++) {
            const segAlpha = (1 - seg / 5) * (1 - progress) * 0.85;
            if (segAlpha < 0.05) continue;
            ctx.fillStyle = toHsla("200 80% 95%", segAlpha);
            ctx.fillRect(sx - seg * p * 2, sy - seg * p, p * 2, p);
        }
    }

    // Space shuttle with astronaut on tether
    drawSpaceShuttle(
        ctx,
        snapToPixel(width * 0.42 + Math.sin(t * 0.15) * pixel * 3, pixel),
        snapToPixel(groundY * 0.28, pixel),
        pixel,
        t
    );

    // Planet (upper-right area)
    const planetX = snapToPixel(width * 0.82, p);
    const planetY = snapToPixel(groundY * 0.14 + Math.sin(t * 0.18) * p, p);
    const pr = p * 5; // planet radius in pixels
    // Planet body (purple-ish)
    for (let dy = -pr; dy <= pr; dy += p) {
        const rowHalf = Math.round(Math.sqrt(Math.max(0, pr * pr - dy * dy)) / p) * p;
        if (rowHalf <= 0) continue;
        const shade = dy < -pr * 0.3 ? "270 50% 52%" : "270 45% 40%";
        ctx.fillStyle = toHsla(shade, 0.95);
        ctx.fillRect(planetX - rowHalf, planetY + dy, rowHalf * 2, p);
    }
    // Planet rings (horizontal oval)
    ctx.fillStyle = toHsla("38 70% 58%", 0.5);
    for (let dx = -pr * 2; dx <= pr * 2; dx += p) {
        const absDx = Math.abs(dx);
        // Skip over planet body
        if (absDx < pr * 0.85) continue;
        const ringY = snapToPixel(planetY + Math.sin((dx / (pr * 2)) * Math.PI) * p * 1.5, p);
        ctx.fillRect(planetX + dx, ringY - p, p, p * 2);
    }
    ctx.fillStyle = toHsla("38 70% 58%", 0.28);
    for (let dx = -pr * 1.85; dx <= pr * 1.85; dx += p) {
        const ringY = snapToPixel(planetY + Math.sin((dx / (pr * 2)) * Math.PI) * p * 1.5, p);
        ctx.fillRect(planetX + dx, ringY, p, p);
    }
    // Planet highlight
    ctx.fillStyle = toHsla("270 60% 72%", 0.6);
    ctx.fillRect(planetX - p, planetY - pr + p, p * 2, p);
};
