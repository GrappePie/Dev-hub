import { clamp, snapToPixel, toHsla } from "../shared/utils";

const CYCLE = 180; // seconds per cycle — long gap between possible appearances
const GRACE = 8;   // seconds after load before any event can fire

// Stable per-cycle pseudo-random (same result every frame within a cycle)
function seededRand(seed: number): number {
    const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
}

// eventSlot: unique ID per event type (keeps seeds independent)
// probability: 0–1 chance the event fires in a given cycle
function getEventT(
    t: number,
    eventSlot: number,
    cycleOffset: number,
    duration: number,
    probability: number
): number | null {
    if (t < GRACE) return null;
    const elapsed    = t - GRACE;
    const cycleIndex = Math.floor(elapsed / CYCLE);
    // Roll once per cycle — if below probability threshold, skip this cycle
    if (seededRand(cycleIndex * 17 + eventSlot) > probability) return null;
    const cycleT = elapsed % CYCLE;
    const localT = cycleT - cycleOffset;
    if (localT >= 0 && localT < duration) return localT;
    return null;
}
// Each event fires ~40% of cycles on average.
// With CYCLE=180s that's roughly once every ~7.5 minutes per event, independent of each other.

// ─── Plane Event ─────────────────────────────────────────────────────────────

export const drawPlaneEvent = (
    ctx: CanvasRenderingContext2D,
    width: number,
    groundY: number,
    pixel: number,
    t: number
): void => {
    const eventT = getEventT(t, 0, 0, 18, 0.40);
    if (eventT === null) return;

    const p = pixel;
    const planeY = snapToPixel(groundY * 0.45, p);

    const planeProgress = clamp(eventT / 16, 0, 1);
    const planeX = snapToPixel(-p * 20 + planeProgress * (width + p * 40), p);
    const dropX = snapToPixel(-p * 20 + clamp(8 / 16, 0, 1) * (width + p * 40), p);

    const cx = planeX;
    const cy = planeY;

    // ── Tornado biplane (Tails-style) ────────────────────────────────────────
    // Propeller: 3 spinning yellow blades at the nose
    const propCx = snapToPixel(cx + p * 9, p);
    const propCy = snapToPixel(cy, p);
    const bladeAngle = t * 14;
    ctx.fillStyle = toHsla("50 100% 55%", 1);
    for (let b = 0; b < 3; b++) {
        const angle = bladeAngle + (b * Math.PI * 2) / 3;
        const bx = snapToPixel(propCx + Math.cos(angle) * p * 3, p);
        const by = snapToPixel(propCy + Math.sin(angle) * p * 3, p);
        ctx.fillRect(bx, by, p, p);
        const mx = snapToPixel(propCx + Math.cos(angle) * p * 1.5, p);
        const my = snapToPixel(propCy + Math.sin(angle) * p * 1.5, p);
        ctx.fillRect(mx, my, p, p);
    }
    ctx.fillStyle = toHsla("40 60% 40%", 1);
    ctx.fillRect(snapToPixel(propCx - p, p), snapToPixel(propCy - p, p), p * 2, p * 2);

    // Upper wing
    ctx.fillStyle = toHsla("0 85% 45%", 1);
    ctx.fillRect(snapToPixel(cx - p * 4, p), snapToPixel(cy - p * 5, p), p * 10, p * 2);
    ctx.fillStyle = toHsla("0 0% 95%", 1);
    ctx.fillRect(snapToPixel(cx - p * 4, p), snapToPixel(cy - p * 5, p), p, p * 2);
    ctx.fillRect(snapToPixel(cx + p * 5,  p), snapToPixel(cy - p * 5, p), p, p * 2);

    // Wing struts
    ctx.fillStyle = toHsla("0 0% 80%", 1);
    ctx.fillRect(snapToPixel(cx - p * 2, p), snapToPixel(cy - p * 5, p), p, p * 7);
    ctx.fillRect(snapToPixel(cx + p * 3,  p), snapToPixel(cy - p * 5, p), p, p * 7);

    // Lower wing
    ctx.fillStyle = toHsla("0 85% 45%", 1);
    ctx.fillRect(snapToPixel(cx - p * 4, p), snapToPixel(cy + p * 2, p), p * 10, p * 2);
    ctx.fillStyle = toHsla("0 0% 95%", 1);
    ctx.fillRect(snapToPixel(cx - p * 4, p), snapToPixel(cy + p * 2, p), p, p * 2);
    ctx.fillRect(snapToPixel(cx + p * 5,  p), snapToPixel(cy + p * 2, p), p, p * 2);

    // Exhaust trail
    for (let i = 1; i <= 5; i++) {
        const alpha = 0.5 - i * 0.08;
        ctx.fillStyle = toHsla("0 0% 88%", Math.max(0, alpha));
        ctx.fillRect(snapToPixel(cx - p * (8 + i * 3), p), cy, p * 2, p);
    }

    // Fuselage
    ctx.fillStyle = toHsla("0 85% 45%", 1);
    ctx.fillRect(snapToPixel(cx - p * 8, p), snapToPixel(cy - p * 2, p), p * 16, p * 4);

    // Tail section: white
    ctx.fillStyle = toHsla("0 0% 95%", 1);
    ctx.fillRect(snapToPixel(cx - p * 8, p), snapToPixel(cy - p * 2, p), p * 3, p * 3);

    // Vertical tail fin
    ctx.fillStyle = toHsla("0 0% 95%", 1);
    ctx.fillRect(snapToPixel(cx - p * 9, p), snapToPixel(cy - p * 6, p), p * 2, p * 4);
    // Horizontal tail fin
    ctx.fillStyle = toHsla("0 85% 45%", 1);
    ctx.fillRect(snapToPixel(cx - p * 11, p), snapToPixel(cy - p * 2, p), p * 3, p);

    // Yellow nose
    ctx.fillStyle = toHsla("50 100% 55%", 1);
    ctx.fillRect(snapToPixel(cx + p * 8, p), snapToPixel(cy - p, p), p * 3, p * 2);

    // Cockpit
    ctx.fillStyle = toHsla("210 70% 65%", 0.9);
    ctx.fillRect(snapToPixel(cx + p * 2, p), snapToPixel(cy - p * 4, p), p * 4, p * 3);
    ctx.fillStyle = toHsla("0 85% 38%", 1);
    ctx.fillRect(snapToPixel(cx + p * 2, p), snapToPixel(cy - p * 4, p), p, p * 3);
    ctx.fillRect(snapToPixel(cx + p * 5, p), snapToPixel(cy - p * 4, p), p, p * 3);

    // Star decal
    ctx.fillStyle = toHsla("0 0% 95%", 1);
    ctx.fillRect(snapToPixel(cx - p * 3, p), snapToPixel(cy - p, p), p, p * 2);
    ctx.fillRect(snapToPixel(cx - p * 4, p), cy,                     p * 3, p);

    // ── Skydiver ─────────────────────────────────────────────────────────────
    if (eventT < 8) return;

    const fallProgress = clamp((eventT - 8) / 10, 0, 1);
    const targetY = groundY * 0.95;
    const sy = snapToPixel(planeY + fallProgress * (targetY - planeY), p);
    const sx = dropX;

    const distToGround = groundY - (sy + p * 9);
    const alpha = distToGround < 30 ? clamp(distToGround / 30, 0, 1) : 1;

    // Parachute dome: 19 wide, flat canopy
    const domeBaseY = snapToPixel(sy - p * 6, p);
    const domeCols  = [1, 2, 3, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 4, 3, 2, 2, 1, 1];
    const domeColors = [
        "0 85% 50%",
        "0 0% 95%",
        "50 100% 55%",
        "210 80% 55%",
    ];
    for (let col = 0; col < domeCols.length; col++) {
        const h = domeCols[col];
        ctx.fillStyle = toHsla(domeColors[col % domeColors.length], alpha);
        ctx.fillRect(
            snapToPixel(sx - p * 9 + col * p, p),
            snapToPixel(domeBaseY - h * p, p),
            p, h * p
        );
    }
    ctx.fillStyle = toHsla("0 0% 40%", alpha * 0.4);
    ctx.fillRect(snapToPixel(sx - p * 9, p), domeBaseY, p * 19, p);

    // Ropes: fan out from dome to head
    ctx.fillStyle = toHsla("0 0% 70%", alpha * 0.8);
    const ropeAnchors = [-8, -5, -1, 3, 8];
    for (const anchor of ropeAnchors) {
        const rx0 = snapToPixel(sx + anchor * p, p);
        const steps = Math.round((sy - domeBaseY) / p);
        for (let s = 0; s <= steps; s++) {
            const prog = steps === 0 ? 1 : s / steps;
            const rx = snapToPixel(rx0 + (sx - rx0) * prog, p);
            const ry = snapToPixel(domeBaseY + (sy - domeBaseY) * prog, p);
            ctx.fillRect(rx, ry, p, p);
        }
    }

    // Head
    ctx.fillStyle = toHsla("25 70% 70%", alpha);
    ctx.fillRect(snapToPixel(sx - p, p), sy, p * 3, p * 3);

    // Torso
    ctx.fillStyle = toHsla("210 60% 35%", alpha);
    ctx.fillRect(snapToPixel(sx - p, p), snapToPixel(sy + p * 3, p), p * 2, p * 4);

    // Arms spread
    ctx.fillRect(snapToPixel(sx - p * 3, p), snapToPixel(sy + p * 4, p), p * 2, p);
    ctx.fillRect(snapToPixel(sx + p,     p), snapToPixel(sy + p * 4, p), p * 2, p);

    // Legs
    ctx.fillRect(snapToPixel(sx - p, p), snapToPixel(sy + p * 7, p), p, p * 2);
    ctx.fillRect(snapToPixel(sx + p, p), snapToPixel(sy + p * 7, p), p, p * 2);
};

// ─── UFO Event ────────────────────────────────────────────────────────────────

export const drawUfoEvent = (
    ctx: CanvasRenderingContext2D,
    width: number,
    groundY: number,
    pixel: number,
    t: number
): void => {
    const eventT = getEventT(t, 1, 37, 18, 0.40);
    if (eventT === null) return;

    const p = pixel;
    const ufoY = snapToPixel(groundY * 0.38, p);

    let ufoX: number;
    if (eventT < 3) {
        const progress = eventT / 3;
        const eased = 1 - Math.pow(1 - progress, 3);
        ufoX = width + p * 20 + eased * (width * 0.5 - (width + p * 20));
    } else if (eventT < 14) {
        ufoX = width * 0.5 + Math.sin(t * 2.2) * p * 0.5;
    } else {
        const progress = clamp((eventT - 14) / 4, 0, 1);
        ufoX = width * 0.5 + progress * (width * 2.5);
    }
    const cx = snapToPixel(ufoX, p);
    const cy = ufoY;

    const isExiting = eventT >= 14 && eventT < 18;
    const exitLocalT = isExiting ? eventT - 14 : 0;
    const stretchFactor = isExiting ? Math.max(1, 1 + exitLocalT * 6) : 1;
    const blinkOn = Math.floor(t * 8) % 2 === 0;

    // Bottom beam
    if (eventT >= 7 && eventT < 14) {
        ctx.fillStyle = toHsla("60 100% 90%", 0.3);
        ctx.fillRect(snapToPixel(cx - p, p), snapToPixel(cy + p * 2, p), p * 2, p * 12);
    }

    // Hyperspace exit streak
    if (isExiting) {
        for (let trail = 1; trail <= 6; trail++) {
            const trailAlpha = clamp((1 - trail / 6) * 0.6, 0, 1);
            ctx.fillStyle = toHsla("0 0% 82%", trailAlpha);
            ctx.fillRect(
                snapToPixel(cx - p * 8 * trail, p),
                snapToPixel(cy - p * 2, p),
                p * 8, p * 4
            );
        }
        if (exitLocalT < 0.5) {
            const flashAlpha = clamp(0.6 * (1 - exitLocalT / 0.5), 0, 1);
            const flashW = Math.max(p, Math.floor(p * 16 * stretchFactor));
            ctx.fillStyle = toHsla("0 0% 100%", flashAlpha);
            ctx.fillRect(snapToPixel(cx - flashW / 2, p), snapToPixel(cy - p * 2, p), flashW, p * 4);
        }
    }

    // UFO disc
    const discW = Math.max(p, Math.floor(p * 16 * stretchFactor));
    ctx.fillStyle = toHsla("0 0% 82%", 1);
    ctx.fillRect(snapToPixel(cx - discW / 2, p), snapToPixel(cy - p * 2, p), discW, p * 4);

    // Top dome
    if (!isExiting) {
        ctx.fillStyle = toHsla("200 40% 70%", 0.9);
        const domeRows: { w: number; dy: number }[] = [
            { w: 4, dy: -6 },
            { w: 6, dy: -5 },
            { w: 8, dy: -4 },
            { w: 6, dy: -3 },
            { w: 4, dy: -2 },
        ];
        for (const row of domeRows) {
            const rw = row.w * p;
            ctx.fillRect(snapToPixel(cx - rw / 2, p), snapToPixel(cy + row.dy * p, p), rw, p);
        }
    }

    // Rim lights
    for (let i = 0; i < 5; i++) {
        const hue = (t * 120 + i * 72) % 360;
        const rimAlpha = isExiting ? (blinkOn ? 1.0 : 0.0) : 0.8;
        ctx.fillStyle = `hsla(${Math.floor(hue)}, 100%, 70%, ${rimAlpha})`;
        ctx.fillRect(
            snapToPixel(cx - p * 6 + i * p * 3, p),
            snapToPixel(cy + p, p),
            p * 2, p * 2
        );
    }

    // ── Alien ─────────────────────────────────────────────────────────────────
    if (eventT < 7 || eventT >= 14) return;

    let alienY: number;
    if (eventT < 9) {
        const descProg = clamp((eventT - 7) / 2, 0, 1);
        alienY = ufoY + p * 2 + descProg * p * 6;
    } else if (eventT < 12) {
        alienY = ufoY + p * 8;
    } else {
        const ascProg = clamp((eventT - 12) / 2, 0, 1);
        alienY = ufoY + p * 8 - ascProg * p * 6;
    }
    const ax = cx;
    const ay = snapToPixel(alienY, p);

    // Head
    ctx.fillStyle = toHsla("130 60% 45%", 1);
    ctx.fillRect(snapToPixel(ax - p * 2, p), snapToPixel(ay - p * 4, p), p * 4, p);
    ctx.fillRect(snapToPixel(ax - p * 3, p), snapToPixel(ay - p * 3, p), p * 6, p * 2);
    ctx.fillRect(snapToPixel(ax - p * 2, p), snapToPixel(ay - p,     p), p * 4, p);

    // Eyes
    ctx.fillStyle = toHsla("240 50% 15%", 1);
    ctx.fillRect(snapToPixel(ax - p * 2, p), snapToPixel(ay - p * 3, p), p * 2, p * 2);
    ctx.fillRect(snapToPixel(ax + p,     p), snapToPixel(ay - p * 3, p), p * 2, p * 2);

    // Mouth
    ctx.fillStyle = toHsla("130 40% 30%", 1);
    ctx.fillRect(snapToPixel(ax - p, p), snapToPixel(ay - p, p), p * 3, p);

    // Body
    ctx.fillStyle = toHsla("130 60% 45%", 1);
    ctx.fillRect(snapToPixel(ax - p, p), ay, p * 3, p * 3);

    // Arms wave with peace sign
    const armUp = Math.sin(t * 4) > 0;
    ctx.fillStyle = toHsla("130 60% 45%", 1);
    if (armUp) {
        ctx.fillRect(snapToPixel(ax - p * 3, p), snapToPixel(ay - p * 2, p), p * 2, p * 2);
        ctx.fillRect(snapToPixel(ax + p * 2, p), snapToPixel(ay - p * 3, p), p, p * 3);
        ctx.fillRect(snapToPixel(ax + p * 3, p), snapToPixel(ay - p * 2, p), p, p * 2);
    } else {
        ctx.fillRect(snapToPixel(ax - p * 3, p), snapToPixel(ay + p, p), p * 2, p * 2);
        ctx.fillRect(snapToPixel(ax + p * 2, p), snapToPixel(ay + p, p), p * 2, p * 2);
    }

    // Legs
    ctx.fillRect(snapToPixel(ax - p, p), snapToPixel(ay + p * 3, p), p, p * 2);
    ctx.fillRect(snapToPixel(ax + p, p), snapToPixel(ay + p * 3, p), p, p * 2);
};
