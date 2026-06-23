import { clamp, snapToPixel, toHsla } from "../shared/utils";
import type { Palette, CritterState } from "../shared/types";
import { drawSpaceContent } from "./space";
import { drawPixelSun, drawPixelRainbow, drawPixelCloud, drawPixelBalloon, drawPixelTree, drawPixelFlower } from "./nature";
import { drawPixelMountains } from "./mountains";
import { drawFrogSprite, drawRabbitSprite, drawPixelBird, drawPixelButterfly, drawPixelBee } from "./sprites";
import { drawPlaneEvent, drawUfoEvent } from "./events";

const JUMP_DECAY = 0.38; // seconds for full hop arc
const COMMENT_DURATION = 3.5; // seconds to show a comment bubble

const INK  = "rgba(13, 13, 13, 0.97)";   // hsl(0 0% 5%) ≈ --pixel-ink
const FILL = "rgba(250, 250, 250, 0.97)"; // hsl(0 0% 98%) ≈ --pixel-bubble
const USER_COLOR = "rgba(50, 70, 200, 0.95)";

/** Draw a staircase-corner box matching the PixelBubble component style. */
const drawStaircaseBox = (
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    p: number, // 1 canvas "pixel"
    color: string,
) => {
    const c = p * 2; // corner step size (2 units = 2-step staircase)
    ctx.fillStyle = color;
    // Center band (full width)
    ctx.fillRect(x, y + c, w, h - c * 2);
    // Top/bottom middle strips
    ctx.fillRect(x + c, y, w - c * 2, c);
    ctx.fillRect(x + c, y + h - c, w - c * 2, c);
    // Top corners: 2 staircase steps each
    ctx.fillRect(x + p, y + p, p, p);         // TL inner step
    ctx.fillRect(x + w - p * 2, y + p, p, p); // TR inner step
    ctx.fillRect(x + p, y + h - p * 2, p, p); // BL inner step
    ctx.fillRect(x + w - p * 2, y + h - p * 2, p, p); // BR inner step
};

/**
 * Draw a PixelBubble-style speech bubble on canvas.
 * The bubble floats at a fixed Y (groundY-relative) — NOT tracking the critter's jump arc.
 * @param cx        critter's horizontal centre
 * @param floatY    pre-computed Y (already includes the slow sine float offset)
 * @param groundY   ground y-coordinate (for tail anchor)
 */
const drawCommentBubble = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    floatY: number,
    text: string,
    username: string,
    pixel: number,
    alpha: number,
) => {
    if (alpha <= 0) return;
    const p = pixel;
    const fontSize = Math.max(9, Math.round(p * 3));
    const smallSize = Math.max(7, Math.round(p * 2.2));
    const padX = p * 3;
    const padY = p * 2;
    const lineH = fontSize + p;
    const maxW = Math.min(ctx.canvas.width * 0.42, p * 36);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${fontSize}px monospace`;

    const innerW = maxW - padX * 2;

    // Truncate a string to fit innerW, appending '…' if needed
    const truncateLine = (s: string): string => {
        if (ctx.measureText(s).width <= innerW) return s;
        let lo = 0, hi = s.length;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (ctx.measureText(s.slice(0, mid) + '\u2026').width <= innerW) lo = mid;
            else hi = mid - 1;
        }
        return s.slice(0, lo) + '\u2026';
    };

    // Word-wrap comment text into max 3 lines, then truncate any overflowing line
    const words = text.replace(/\n/g, " ").split(/\s+/);
    const bodyLines: string[] = [];
    let cur = "";
    for (const word of words) {
        const test = cur ? `${cur} ${word}` : word;
        if (ctx.measureText(test).width > innerW && cur) {
            bodyLines.push(truncateLine(cur));
            if (bodyLines.length >= 3) { cur = ""; break; }
            cur = word;
        } else {
            cur = test;
        }
    }
    if (cur && bodyLines.length < 3) bodyLines.push(truncateLine(cur));

    ctx.font = `${smallSize}px monospace`;
    const userLineStr = `@${username}`;
    const userW = ctx.measureText(userLineStr).width;
    ctx.font = `bold ${fontSize}px monospace`;
    const bodyMaxW = bodyLines.length ? Math.max(...bodyLines.map(l => ctx.measureText(l).width)) : 0;

    const bubbleW = Math.max(p * 14, Math.min(maxW, Math.max(userW, bodyMaxW) + padX * 2));
    const bubbleH = padY * 2 + smallSize + bodyLines.length * lineH;

    // Position: centre on critter X, top at floatY
    let bx = Math.round(cx - bubbleW / 2);
    const by = Math.round(floatY);
    bx = Math.max(p * 2, Math.min(ctx.canvas.width - bubbleW - p * 2, bx));

    // --- Ink outer border (1p bigger on each side) ---
    drawStaircaseBox(ctx, bx - p, by - p, bubbleW + p * 2, bubbleH + p * 2, p, INK);
    // --- Fill inner ---
    drawStaircaseBox(ctx, bx, by, bubbleW, bubbleH, p, FILL);

    // --- Stair-stepped tail at bottom-left (matches PixelBubble exactly) ---
    // Tail positioned at 6p from bubble left, overlapping bottom border by 1p
    const tailX = bx + p * 6;
    const tailY = by + bubbleH - p; // overlap by 1p
    // Row 0: 5p fill + 1p ink
    ctx.fillStyle = FILL; ctx.fillRect(tailX,          tailY,       p * 5, p);
    ctx.fillStyle = INK;  ctx.fillRect(tailX + p * 5,  tailY,       p,     p);
    // Row 1: 1p ink + 3p fill + 1p ink
    ctx.fillStyle = INK;  ctx.fillRect(tailX,           tailY + p,   p,     p);
    ctx.fillStyle = FILL; ctx.fillRect(tailX + p,       tailY + p,   p * 3, p);
    ctx.fillStyle = INK;  ctx.fillRect(tailX + p * 4,   tailY + p,   p,     p);
    // Row 2: 1p ink + 2p fill + 1p ink
    ctx.fillStyle = INK;  ctx.fillRect(tailX,           tailY + p*2, p,     p);
    ctx.fillStyle = FILL; ctx.fillRect(tailX + p,       tailY + p*2, p * 2, p);
    ctx.fillStyle = INK;  ctx.fillRect(tailX + p * 3,   tailY + p*2, p,     p);
    // Row 3: 1p ink + 1p fill + 1p ink
    ctx.fillStyle = INK;  ctx.fillRect(tailX,           tailY + p*3, p,     p);
    ctx.fillStyle = FILL; ctx.fillRect(tailX + p,       tailY + p*3, p,     p);
    ctx.fillStyle = INK;  ctx.fillRect(tailX + p * 2,   tailY + p*3, p,     p);
    // Row 4: 2p ink
    ctx.fillStyle = INK;  ctx.fillRect(tailX,           tailY + p*4, p * 2, p);

    // --- Text ---
    ctx.font = `${smallSize}px monospace`;
    ctx.fillStyle = USER_COLOR;
    ctx.fillText(userLineStr, bx + padX, by + padY + smallSize * 0.9);

    ctx.font = `bold ${fontSize}px monospace`;
    ctx.fillStyle = INK;
    for (let li = 0; li < bodyLines.length; li++) {
        ctx.fillText(bodyLines[li], bx + padX, by + padY + smallSize + lineH * (li + 1));
    }

    ctx.restore();
};

export const drawCritterParade = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    t: number,
    dt: number,
    progressNorm: number,
    volumeNorm: number,
    isPlaying: boolean,
    palette: Palette,
    state: CritterState,
    fftData: Uint8Array | null = null,
    bpm: number | null = null,
    motionBoostOverride?: number,
) => {
    const motionBoost = motionBoostOverride ?? (isPlaying ? 1 : 0.42);
    const pulse = (Math.sin(t * 7.8 + progressNorm * Math.PI * 18) + 1) * 0.5;
    const energy = clamp((0.2 + volumeNorm * 0.95 + pulse * 0.34) * motionBoost, 0.1, 1);
    const pixel = Math.max(3, Math.floor(Math.min(width, height) / 260));
    const groundY = snapToPixel(height * 0.88, pixel);

    // Bright daytime sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
    skyGrad.addColorStop(0,    "hsla(212, 80%, 42%, 1)");  // vivid deep blue top
    skyGrad.addColorStop(0.25, "hsla(207, 82%, 58%, 1)");  // bright sky blue
    skyGrad.addColorStop(0.55, "hsla(200, 80%, 68%, 1)");  // midday azure
    skyGrad.addColorStop(0.80, "hsla(195, 70%, 75%, 1)");  // light horizon
    skyGrad.addColorStop(1,    "hsla(190, 60%, 80%, 1)");  // pale horizon haze
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, groundY);

    // Halftone dot texture in upper sky (retro pixel art)
    const dotZone = Math.floor(groundY * 0.18);
    ctx.fillStyle = "hsla(215, 80%, 40%, 0.10)";
    for (let dy = 0; dy < dotZone; dy += pixel * 2) {
        const rowShift = (Math.floor(dy / pixel) % 2 === 0) ? 0 : pixel;
        for (let dx = rowShift; dx < width; dx += pixel * 2) {
            ctx.fillRect(dx, dy, pixel, pixel);
        }
    }

    // Space content: stars, planet, shooting stars
    drawSpaceContent(ctx, width, groundY, pixel, t, energy);

    // Sky events: plane with skydiver, UFO with alien
    drawPlaneEvent(ctx, width, groundY, pixel, t);
    drawUfoEvent(ctx, width, groundY, pixel, t);

    // Mountains (drawn before sun/clouds/birds so they layer correctly in background)
    drawPixelMountains(ctx, width, groundY, pixel, t, progressNorm, isPlaying, volumeNorm);

    // Sun nod: use global bass energy when live
    const beatFreqSun = isPlaying ? 9.2 : 2.8;
    let sunBeat: number;
    if (fftData) {
        const bassEnd = Math.max(1, Math.floor(fftData.length * 0.10));
        let s = 0; for (let bi = 0; bi < bassEnd; bi++) s += fftData[bi];
        sunBeat = clamp((s / bassEnd) / 180, 0, 1);
    } else {
        sunBeat = Math.max(0, Math.sin(t * beatFreqSun + progressNorm * 20));
    }
    drawPixelSun(
        ctx,
        snapToPixel(width * 0.14, pixel),
        snapToPixel(height * 0.58, pixel),
        pixel,
        Math.pow(sunBeat, 2) * energy
    );

    // Rainbow — appears with music energy
    if (energy > 0.25) {
        const rainbowAlpha = clamp((energy - 0.25) / 0.75, 0, 1);
        drawPixelRainbow(
            ctx,
            snapToPixel(width * 0.65, pixel),
            groundY,
            Math.round(groundY * 0.32),
            pixel,
            rainbowAlpha
        );
    }

    // Drifting clouds — positioned higher in sky
    const cloudDefs = [
        { speed: 22, yFrac: 0.42, scale: 1.0,  offset: 0.0  },
        { speed: 13, yFrac: 0.50, scale: 0.75, offset: 0.38 },
        { speed:  8, yFrac: 0.37, scale: 1.25, offset: 0.65 },
    ];
    for (const cd of cloudDefs) {
        const rawX = (t * cd.speed + cd.offset * width + width * 0.1) % (width + pixel * 28) - pixel * 14;
        drawPixelCloud(
            ctx,
            snapToPixel(rawX, pixel),
            snapToPixel(height * cd.yFrac, pixel),
            Math.round(pixel * cd.scale)
        );
    }

    // Hot air balloon
    drawPixelBalloon(
        ctx,
        snapToPixel(width * 0.75 + Math.sin(t * 0.3) * pixel * 4, pixel),
        snapToPixel(height * 0.64, pixel),
        pixel,
        t
    );

    // Birds flying across the sky
    const birdDefs = [
        { speed: 38, yFrac: 0.72, phase: 0.0 },
        { speed: 27, yFrac: 0.76, phase: 2.3 },
        { speed: 45, yFrac: 0.69, phase: 4.8 },
        { speed: 22, yFrac: 0.74, phase: 1.6 },
    ];
    for (const bd of birdDefs) {
        const rawX = (t * bd.speed + bd.phase * width * 0.25) % (width + pixel * 12) - pixel * 6;
        drawPixelBird(
            ctx,
            snapToPixel(rawX, pixel),
            snapToPixel(height * bd.yFrac, pixel),
            pixel,
            Math.sin(t * 7 + bd.phase) > 0
        );
    }

    // Layered ground: bright grass → mid green → dark soil
    const groundH = height - groundY;
    ctx.fillStyle = toHsla("22 55% 32%", 0.97);
    ctx.fillRect(0, groundY + Math.floor(groundH * 0.55), width, Math.ceil(groundH * 0.45));
    ctx.fillStyle = toHsla("128 58% 38%", 0.97);
    ctx.fillRect(0, groundY, width, Math.ceil(groundH * 0.55 + 1));
    // Bright surface strip
    ctx.fillStyle = toHsla("132 68% 52%", 0.9);
    ctx.fillRect(0, groundY, width, pixel * 2);
    // Animated grass blades
    ctx.fillStyle = toHsla("132 62% 42%", 0.8);
    for (let gx = 0; gx < width; gx += pixel * 3) {
        const blade = snapToPixel(Math.abs(Math.sin(t * 1.6 + gx * 0.04)) * pixel * 1.2 * energy, pixel);
        ctx.fillRect(gx, groundY - blade, pixel, blade + pixel);
    }

    // Trees and foreground elements (in front of mountains)
    const treeFracs = [0.12, 0.36, 0.64, 0.88];
    const numTrees = width < pixel * 180 ? 2 : 4;
    for (let i = 0; i < numTrees; i++) {
        const treeX = snapToPixel(width * treeFracs[i], pixel);
        const treeSway = (Math.sin(t * 1.9 + i * 1.7) * 0.3 + Math.sin(t * 3.1 + i * 0.8) * 0.1)
            * (0.2 + energy * 0.8);
        drawPixelTree(ctx, treeX, groundY, pixel, treeSway);
    }

    // Flowers along the ground
    const flowerStep = pixel * 16;
    const butterflyHues = ["330 75% 72%", "48 90% 62%", "200 70% 68%", "280 60% 72%", "160 60% 55%"];
    const beePhases = [0.0, 1.4, 2.8, 4.2, 5.6];
    for (let fx = snapToPixel(flowerStep * 0.5, pixel); fx < width; fx += flowerStep) {
        const fi = Math.round(fx / flowerStep);
        drawPixelFlower(ctx, fx, groundY, pixel, t * 2.0 + fi * 0.85, fi);

        // Butterfly hovering above every 3rd flower
        if (fi % 3 === 0) {
            const bfX = snapToPixel(fx + Math.sin(t * 1.2 + fi) * pixel * 4, pixel);
            const bfY = snapToPixel(groundY - pixel * 8 - Math.abs(Math.sin(t * 1.8 + fi)) * pixel * 4, pixel);
            drawPixelButterfly(ctx, bfX, bfY, pixel, t + fi * 0.7, butterflyHues[fi % 5]);
        }

        // Bee hovering above every 4th flower
        if (fi % 4 === 1) {
            const beeX = snapToPixel(fx + Math.cos(t * 2.1 + fi) * pixel * 3, pixel);
            const beeY = snapToPixel(groundY - pixel * 10, pixel);
            drawPixelBee(ctx, beeX, beeY, pixel, t, beePhases[fi % 5]);
        }
    }

    // Critters — each maps to a frequency band; jumps to that band's amplitude
    const critterCount = clamp(Math.floor(width / (pixel * 26)), 3, 8);
    const laneWidth = width / (critterCount + 1);

    // Resize flat state array to match critter count
    while (state.frogs.length < critterCount) {
        const idx = state.frogs.length;
        state.frogs.push({ phase: 1, targetHeight: 0, cooldown: 0, jumpTimer: idx * 0.5 + 0.3, commentTimer: 0 });
    }
    state.frogs.length = critterCount;

    // Assign pending comment to the critter most in the air (or random if all grounded)
    if (state.pendingComment && critterCount > 0) {
        let best = 0;
        let bestArc = -1;
        for (let i = 0; i < critterCount; i++) {
            const arc = Math.pow(Math.sin(state.frogs[i].phase * Math.PI), 2) * state.frogs[i].targetHeight;
            if (arc > bestArc) { bestArc = arc; best = i; }
        }
        // If nobody is jumping, pick a random critter
        if (bestArc <= 0) best = Math.floor(Math.random() * critterCount);
        state.frogs[best].comment = state.pendingComment.body;
        state.frogs[best].commentUser = state.pendingComment.username;
        state.frogs[best].commentTimer = COMMENT_DURATION;
        state.pendingComment = null;
    }

    const phaseStep = dt / JUMP_DECAY;
    const LAND_COOLDOWN = 0.12;

    for (let i = 0; i < critterCount; i++) {
        const critter = state.frogs[i];

        // Advance arc phase
        const wasInAir = critter.phase < 1;
        critter.phase = Math.min(1, critter.phase + phaseStep);
        if (wasInAir && critter.phase >= 1) critter.cooldown = LAND_COOLDOWN;
        critter.cooldown = Math.max(0, critter.cooldown - dt);

        // Autonomous jump timer — each critter jumps on its own schedule
        if (critter.phase >= 1 && critter.cooldown <= 0) {
            critter.jumpTimer = Math.max(0, critter.jumpTimer - dt);
            if (critter.jumpTimer <= 0) {
                critter.phase = 0;
                critter.targetHeight = 0.45 + Math.random() * 0.40;
                critter.jumpTimer = 0.8 + Math.random() * 1.2;
            }
        }

        // Arc position — pure physics
        let beat: number;
        if (critter.phase < 1) {
            const p = critter.phase;
            const rawArc = p < 0.30
                ? 1 - Math.pow(1 - p / 0.30, 2)           // easeIn quad rise
                : Math.pow(1 - (p - 0.30) / 0.70, 0.55);  // fast fall, no hang
            beat = rawArc * critter.targetHeight;
        } else {
            beat = 0;
        }

        const isFrog = i % 2 === 0;
        const laneX = laneWidth * (i + 1);
        const sway  = Math.sin(t * 0.9 + i * 1.8) * laneWidth * 0.14;
        const jump = snapToPixel(beat * pixel * (10 + volumeNorm * 28) * (isPlaying ? 1 : 0.48), pixel);
        const x = snapToPixel(laneX + sway, pixel);
        const y = groundY - pixel;

        // Squash/stretch — proportional to jump power, pivot at feet
        const ssIntensity = Math.min(1, critter.targetHeight) * 0.32;
        const ph = critter.phase;
        let ssX = 1, ssY = 1;
        if (critter.phase < 1 && ssIntensity > 0.02) {
            if (ph < 0.10) {
                // Launch squash (anticipation burst)
                const a = 1 - ph / 0.10;
                ssX = 1 + ssIntensity * a * 0.55;
                ssY = 1 - ssIntensity * a * 0.35;
            } else if (ph < 0.45) {
                // Rising stretch — tall & narrow in the air
                const a = (ph - 0.10) / 0.35;
                const s = ssIntensity * 0.6 * (1 - a * 0.4);
                ssX = 1 - s * 0.28;
                ssY = 1 + s;
            } else if (ph < 0.85) {
                // Falling stretch — still elongated coming down
                const a = (ph - 0.45) / 0.40;
                const s = ssIntensity * 0.45 * (1 - a);
                ssX = 1 - s * 0.22;
                ssY = 1 + s;
            } else {
                // Landing squash — wide impact pop
                const a = (ph - 0.85) / 0.15;
                ssX = 1 + ssIntensity * a * 0.7;
                ssY = 1 - ssIntensity * a * 0.45;
            }
        }

        const shadowUnitsRaw = 8 - Math.min(4, Math.round(jump / Math.max(pixel, 1)));
        const shadowUnits = Math.max(4, shadowUnitsRaw - (shadowUnitsRaw % 2));
        const shadowWidth = pixel * shadowUnits;
        const shadowX = snapToPixel(x - shadowWidth / 2, pixel);
        ctx.fillStyle = toHsla("0 0% 0%", 0.22);
        ctx.fillRect(shadowX, y, shadowWidth, pixel);

        if (isFrog) drawFrogSprite(ctx, x, y, pixel, jump, t + i, palette, ssX, ssY);
        else         drawRabbitSprite(ctx, x, y, pixel, jump, t + i, palette, ssX, ssY);

        // Decrement comment timer and draw floating speech bubble
        if (critter.commentTimer > 0) {
            critter.commentTimer = Math.max(0, critter.commentTimer - dt);
            if (critter.comment && critter.commentUser) {
                // Fade in first 0.3s, fade out last 0.5s
                const alpha = critter.commentTimer > COMMENT_DURATION - 0.3
                    ? (COMMENT_DURATION - critter.commentTimer) / 0.3
                    : critter.commentTimer < 0.5
                    ? critter.commentTimer / 0.5
                    : 1;
                // Bubble floats at a fixed height above the critter lane —
                // independent of jump arc — with a gentle slow sine wave.
                const floatOffset = Math.sin(t * 1.8 + i * 2.1) * pixel * 2;
                const bubbleBaseY = groundY - pixel * 40 + floatOffset;
                drawCommentBubble(ctx, x, bubbleBaseY, critter.comment, critter.commentUser, pixel, clamp(alpha, 0, 1));
            }
            if (critter.commentTimer <= 0) {
                critter.comment = undefined;
                critter.commentUser = undefined;
            }
        }
    }

    const scanY = snapToPixel((t * (isPlaying ? 85 : 28)) % height, pixel);
    ctx.fillStyle = toHsla(palette.primary, 0.04 + energy * 0.06);
    ctx.fillRect(0, scanY, width, pixel * 2);

    ctx.fillStyle = toHsla("0 0% 0%", 0.025);
    for (let y = 0; y < height; y += pixel * 2) {
        ctx.fillRect(0, y, width, 1);
    }
};
