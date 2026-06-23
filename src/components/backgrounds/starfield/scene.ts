import { clamp, toHsla, snapToPixel, drawPixelLine, createStar } from "../shared/utils";
import type { Palette, Star } from "../shared/types";

// ── Types ──────────────────────────────────────────────────────────────────
interface Asteroid {
    ox: number; oy: number; z: number;
    speed: number; rot: number; rs: number;
    baseR: number; shapeIdx: number;
}
interface Laser   { sx: number; sy: number; t: number; }
interface Exhaust { x: number; y: number; vx: number; vy: number; life: number; }
interface Debris  { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; col: string; sz: number; }

// ── Module-level state (reset on resize) ──────────────────────────────────
let _ast:    Asteroid[] = [];
let _lasers: Laser[]    = [];
let _exh:    Exhaust[]  = [];
let _debris: Debris[]   = [];
let _laserCD = 0;
let _prevEn  = 0;
let _lastT   = 0;
let _sceneW  = 0;
let _sceneH  = 0;
let _astSeed = 0;
let _shipExploding = false;
let _shipExplodeTimer = 0;

const SHIP_Z_FRONT  = 0.38; // asteroids with z < this draw on top of the ship
const SHIP_RESPAWN  = 2.5;  // seconds before ship respawns after explosion

// ── Pixel-art asteroid templates ──────────────────────────────────────────
// Each shape: array of [dx, dy, dw, dh] in "cell" units (1 cell = s pixels).
// Origin (0,0) is the visual center. Roughly ±4.5 cells wide/tall.
type RectDef = [number, number, number, number];

const AST_BODY: RectDef[][] = [
    // 0: Oval boulder
    [[-2,-3, 5,1],[-3,-2, 7,1],[-4,-1, 8,1],[-4, 0, 9,1],
     [-4, 1, 8,1],[-3, 2, 7,1],[-2, 3, 5,1],[-1, 4, 3,1]],
    // 1: Angular left-heavy chunk
    [[-1,-4, 4,1],[-2,-3, 7,1],[-3,-2, 8,1],[-4,-1, 9,1],
     [-4, 0, 8,1],[-3, 1, 7,1],[-2, 2, 5,1],[-1, 3, 3,1]],
    // 2: Top-heavy boulder
    [[-2,-4, 5,1],[-3,-3, 7,1],[-4,-2, 8,1],[-4,-1, 9,1],
     [-4, 0, 7,1],[-3, 1, 6,1],[-2, 2, 4,1],[-1, 3, 3,1]],
    // 3: Wide flat slab
    [[-1,-3, 4,1],[-3,-2, 8,1],[-4,-1, 9,1],[-4, 0, 9,1],
     [-4, 1, 8,1],[-3, 2, 6,1],[-2, 3, 4,1]],
];
const AST_HIGHLIGHT: RectDef[][] = [
    [[-3,-2, 2,2],[-2,-1, 1,1]],
    [[-2,-3, 2,2],[-3,-1, 1,1]],
    [[-3,-3, 2,2],[-4,-1, 1,1]],
    [[-3,-2, 2,2],[-2,-1, 1,1]],
];
const AST_SHADOW: RectDef[][] = [
    [[2, 0, 2,2],[1, 2, 2,1]],
    [[2,-1, 2,2],[1, 1, 2,1]],
    [[2,-1, 2,2],[1, 1, 1,1]],
    [[3,-1, 1,3],[1, 2, 2,1]],
];
const AST_CRATER: RectDef[][] = [
    [[ 0,-1, 2,2]],
    [[ 0, 0, 2,2]],
    [[-1, 0, 2,2]],
    [[ 0,-1, 2,2]],
];

// ── Helpers ────────────────────────────────────────────────────────────────
const makeAst = (): Asteroid => ({
    ox:       (Math.random() * 1.6 - 0.8),
    oy:       (Math.random() * 1.6 - 0.8),
    z:        1.2 + Math.random() * 0.6,
    speed:    0.25 + Math.random() * 0.4,
    rot:      Math.random() * Math.PI * 2,
    rs:       (Math.random() - 0.5) * 1.8,
    baseR:    5 + Math.random() * 15,
    shapeIdx: _astSeed++ % AST_BODY.length,
});

const drawAst = (
    ctx: CanvasRenderingContext2D,
    ax: number, ay: number, projR: number,
    rot: number, shapeIdx: number, pixel: number
) => {
    // s = pixels per shape-cell, snapped to grid
    const s = Math.max(pixel, Math.floor(projR / 4.5 / pixel) * pixel);
    const si = shapeIdx % AST_BODY.length;

    ctx.save();
    ctx.translate(Math.round(ax / pixel) * pixel, Math.round(ay / pixel) * pixel);
    ctx.rotate(rot);

    ctx.fillStyle = toHsla("22 12% 30%", 1.0);
    for (const [dx, dy, dw, dh] of AST_BODY[si])
        ctx.fillRect(dx * s, dy * s, dw * s, dh * s);

    ctx.fillStyle = toHsla("28 22% 58%", 1.0);
    for (const [dx, dy, dw, dh] of AST_HIGHLIGHT[si])
        ctx.fillRect(dx * s, dy * s, dw * s, dh * s);

    ctx.fillStyle = toHsla("22 8% 16%", 1.0);
    for (const [dx, dy, dw, dh] of AST_SHADOW[si])
        ctx.fillRect(dx * s, dy * s, dw * s, dh * s);

    ctx.fillStyle = toHsla("22 6% 20%", 1.0);
    for (const [dx, dy, dw, dh] of AST_CRATER[si])
        ctx.fillRect(dx * s, dy * s, dw * s, dh * s);

    ctx.restore();
};

const spawnDebris = (
    ax: number, ay: number, projR: number,
    pixel: number, palette: Palette
) => {
    const count = 8 + Math.floor(Math.random() * 7);
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (60 + Math.random() * 130) * clamp(projR / 18, 0.5, 2.5);
        const ml    = 0.4 + Math.random() * 0.55;
        const colRoll = Math.random();
        _debris.push({
            x:       ax + (Math.random() - 0.5) * projR * 0.8,
            y:       ay + (Math.random() - 0.5) * projR * 0.8,
            vx:      Math.cos(angle) * speed,
            vy:      Math.sin(angle) * speed,
            life:    ml, maxLife: ml,
            col:     colRoll > 0.6 ? "22 14% 42%"
                   : colRoll > 0.3 ? palette.accent
                   :                 palette.primary,
            sz: pixel * (Math.random() > 0.5 ? 2 : 1),
        });
    }
};

// ── Planet ─────────────────────────────────────────────────────────────────
const drawPlanet = (
    ctx: CanvasRenderingContext2D,
    pcx: number, pcy: number, r: number, palette: Palette
) => {
    const halo = ctx.createRadialGradient(pcx, pcy, r * 0.65, pcx, pcy, r * 2.2);
    halo.addColorStop(0, toHsla(palette.accent, 0.06));
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(pcx - r * 2.5, pcy - r * 2.5, r * 5, r * 5);

    const body = ctx.createRadialGradient(pcx - r * 0.3, pcy - r * 0.35, r * 0.04, pcx, pcy, r);
    body.addColorStop(0,    "hsla(200,55%,42%,0.92)");
    body.addColorStop(0.55, "hsla(230,48%,22%,0.94)");
    body.addColorStop(1,    "hsla(245,42%,10%,0.96)");
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(pcx, pcy, r, 0, Math.PI * 2); ctx.fill();

    ctx.save(); ctx.translate(pcx, pcy); ctx.scale(1, 0.26);
    ctx.strokeStyle = "hsla(195,40%,60%,0.22)"; ctx.lineWidth = r * 0.11;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.35, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "hsla(195,38%,55%,0.14)"; ctx.lineWidth = r * 0.08;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.56, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
};

// ── X-Wing: viewed from behind, nose pointing into screen (Star Fox style) ─
// Origin (0,0) = aft center. -y = nose/forward, +y = engines/flames toward player.
// S-foils in attack position: upper pair spreads up-left/right, lower pair down-left/right.
const drawShip = (
    ctx: CanvasRenderingContext2D,
    sx: number, sy: number, p: number,
    energy: number, t: number, bank: number,
    palette: Palette
) => {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.transform(1, bank * 0.08, 0, 1, 0, 0);

    // ── 4 ENGINE FLAMES (2 left, 2 right — X-Wing has 4 nacelles) ────────
    // Upper pair: y offset -1p; Lower pair: y offset +1p. Each 2p wide.
    const fl = Math.max(1, Math.floor((2 + energy * 4.5) * (0.88 + Math.sin(t * 22) * 0.12)));
    const engPairs: [number, number][] = [[-4, -1], [2, -1], [-4, 1], [2, 1]];
    for (const [ex, ey] of engPairs) {
        for (let i = 1; i <= fl; i++) {
            const frac  = (i - 1) / Math.max(1, fl - 1);
            const alpha = (1 - frac) * 0.85 + 0.08;
            ctx.fillStyle = frac < 0.30 ? toHsla("55 100% 78%",  alpha)
                          : frac < 0.62 ? toHsla("195 100% 65%", alpha * 0.88)
                          :               toHsla("210 90% 55%",  alpha * 0.70);
            ctx.fillRect(ex * p, (ey + i) * p, 2 * p, p);
        }
        ctx.fillStyle = "rgba(255,250,200,0.95)";
        ctx.fillRect(ex * p, (ey + 1) * p, 2 * p, p);  // hot core
        ctx.fillStyle = toHsla(palette.dark, 0.95);
        ctx.fillRect(ex * p,  ey      * p, 2 * p, p);  // engine bell recess
    }

    // ── LOWER S-FOILS (staircase outward + toward player) ────────────────
    ctx.fillStyle = toHsla("0 0% 92%", 0.88);
    ctx.fillRect(-4*p, -2*p, 2*p, 2*p);   // lower-left root
    ctx.fillRect(-6*p,  0,   2*p, 2*p);
    ctx.fillRect(-8*p,  2*p, 2*p, 2*p);
    ctx.fillRect(-10*p, 4*p, 2*p, 2*p);   // lower-left tip
    ctx.fillRect( 2*p, -2*p, 2*p, 2*p);   // lower-right root
    ctx.fillRect( 4*p,  0,   2*p, 2*p);
    ctx.fillRect( 6*p,  2*p, 2*p, 2*p);
    ctx.fillRect( 8*p,  4*p, 2*p, 2*p);   // lower-right tip

    // Lower cannon rods
    ctx.fillStyle = toHsla("0 0% 72%", 0.90);
    ctx.fillRect(-11*p, 3*p, p, 5*p);   // lower-left cannon
    ctx.fillRect( 10*p, 3*p, p, 5*p);   // lower-right cannon

    // ── UPPER S-FOILS (staircase outward + toward horizon) ────────────────
    ctx.fillStyle = toHsla("0 0% 92%", 0.88);
    ctx.fillRect(-4*p, -4*p, 2*p, 2*p);   // upper-left root
    ctx.fillRect(-6*p, -6*p, 2*p, 2*p);
    ctx.fillRect(-8*p, -8*p, 2*p, 2*p);
    ctx.fillRect(-10*p,-10*p, 2*p, 2*p);  // upper-left tip
    ctx.fillRect( 2*p, -4*p, 2*p, 2*p);   // upper-right root
    ctx.fillRect( 4*p, -6*p, 2*p, 2*p);
    ctx.fillRect( 6*p, -8*p, 2*p, 2*p);
    ctx.fillRect( 8*p,-10*p, 2*p, 2*p);   // upper-right tip

    // Upper cannon rods
    ctx.fillStyle = toHsla("0 0% 72%", 0.90);
    ctx.fillRect(-11*p,-12*p, p, 5*p);   // upper-left cannon
    ctx.fillRect( 10*p,-12*p, p, 5*p);   // upper-right cannon

    // Cannon tips (energy glow when firing — white-blue, not green)
    ctx.fillStyle = toHsla("200 80% 72%", 0.30 + energy * 0.55);
    ctx.fillRect(-11*p, 7*p, p, p);   // lower-left tip glow
    ctx.fillRect( 10*p, 7*p, p, p);   // lower-right tip glow
    ctx.fillRect(-11*p,-12*p, p, p);  // upper-left tip glow
    ctx.fillRect( 10*p,-12*p, p, p);  // upper-right tip glow

    // ── RED STRIPE (X-Wing's signature markings) ──────────────────────────
    ctx.fillStyle = toHsla("0 82% 54%", 0.78);
    // Lower wings
    ctx.fillRect(-9*p, -p, 5*p, p);
    ctx.fillRect( 4*p, -p, 5*p, p);
    // Upper wings
    ctx.fillRect(-9*p, -7*p, 5*p, p);
    ctx.fillRect( 4*p, -7*p, 5*p, p);

    // ── MAIN FUSELAGE (compact body, no protruding nose stick) ───────────
    ctx.fillStyle = toHsla("0 0% 90%", 0.92);
    ctx.fillRect(-p, -12*p, 2*p, 13*p);

    // ── COCKPIT CANOPY (dark blue bubble, not green) ───────────────────────
    ctx.fillStyle = toHsla("215 70% 38%", 0.90);
    ctx.fillRect(-p, -11*p, 2*p, 3*p);
    ctx.fillStyle = "rgba(180,210,255,0.55)";
    ctx.fillRect(-p, -11*p, p, 2*p);  // glass shine

    // ── R2-D2 ASTROMECH (dome socket behind cockpit) ──────────────────────
    ctx.fillStyle = toHsla("215 68% 62%", 0.84);
    ctx.fillRect(-p, -7*p, 2*p, 2*p);
    ctx.fillStyle = "rgba(210,225,255,0.68)";
    ctx.fillRect(0, -7*p, p, p);  // R2 sensor lens

    // ── RUNNING LIGHTS (wingtip nav lights, alternating red/amber) ────────
    const blink = Math.sin(t * 3.5) > 0;
    ctx.fillStyle = toHsla("0 100% 65%", blink ? 0.88 : 0.20);
    ctx.fillRect(-11*p, 7*p, p, p);   // lower-left (red)
    ctx.fillRect( 10*p, 7*p, p, p);   // lower-right (red)
    ctx.fillStyle = toHsla("48 100% 62%", blink ? 0.20 : 0.82);
    ctx.fillRect(-11*p,-12*p, p, p);  // upper-left (amber, alternating)
    ctx.fillRect( 10*p,-12*p, p, p);  // upper-right (amber, alternating)

    ctx.restore();
};

// ── Main draw ──────────────────────────────────────────────────────────────
export const drawStarfieldShooter = (
    ctx: CanvasRenderingContext2D,
    width: number, height: number,
    t: number, progressNorm: number, volumeNorm: number,
    isPlaying: boolean, palette: Palette, stars: Star[]
) => {
    const dt = _lastT > 0 ? clamp(t - _lastT, 0.001, 0.05) : 0.016;
    _lastT = t;

    const motionBoost = isPlaying ? 1 : 0.4;
    const pulse  = (Math.sin(t * 6.8 + progressNorm * Math.PI * 14) + 1) * 0.5;
    const energy = clamp((0.24 + volumeNorm * 0.85 + pulse * 0.28) * motionBoost, 0.08, 1);
    const pixel  = Math.max(3, Math.floor(Math.min(width, height) / 260));
    const cx     = width * 0.5;
    const cy     = height * 0.44;

    if (_sceneW !== width || _sceneH !== height) {
        _sceneW = width; _sceneH = height;
        const count = Math.max(4, Math.floor((width * height) / 80000));
        _ast = Array.from({ length: count }, () => {
            const a = makeAst();
            a.z = 0.05 + Math.random() * 1.4;
            return a;
        });
        _lasers = []; _exh = []; _debris = [];
        _shipExploding = false; _shipExplodeTimer = 0;
    }

    // ── Background ────────────────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0,    "hsla(240,55%,4%,1)");
    bg.addColorStop(0.4,  "hsla(250,48%,8%,1)");
    bg.addColorStop(0.75, "hsla(260,38%,6%,1)");
    bg.addColorStop(1,    "hsla(255,30%,5%,1)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // ── Nebulas ───────────────────────────────────────────────────────────
    const nebulas: Array<{ nx: number; ny: number; nr: number; nhue: string; na: number }> = [
        { nx: width*0.12, ny: height*0.22, nr: width*0.26, nhue: "280 60% 28%", na: 0.055+energy*0.03  },
        { nx: width*0.74, ny: height*0.13, nr: width*0.20, nhue: "200 55% 24%", na: 0.045+energy*0.025 },
        { nx: width*0.50, ny: height*0.52, nr: width*0.30, nhue: "240 50% 20%", na: 0.035              },
        { nx: width*0.28, ny: height*0.70, nr: width*0.22, nhue: "300 45% 22%", na: 0.030+energy*0.02  },
    ];
    for (const { nx, ny, nr, nhue, na } of nebulas) {
        const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
        g.addColorStop(0, toHsla(nhue, na));
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(nx - nr, ny - nr, nr * 2, nr * 2);
    }

    const planetR = Math.max(28, Math.floor(Math.min(width, height) * 0.085));
    drawPlanet(ctx, width * 0.82, height * 0.17, planetR, palette);

    // ── Warp stars ────────────────────────────────────────────────────────
    const starSpeed = isPlaying
        ? 0.012 + volumeNorm * 0.030   // fast warp when playing
        : 0.0015;                       // slow drift when paused
    for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        star.z -= starSpeed * star.speed;
        if (star.z <= 0.03) { stars[i] = createStar(); continue; }
        const sxP = cx + (star.x / star.z) * width * 0.5;
        const syP = cy + (star.y / star.z) * height * 0.5;
        if (sxP < -40 || sxP > width + 40 || syP < -40 || syP > height + 40) {
            stars[i] = createStar(); continue;
        }
        const prevZ = star.z + starSpeed * 2.5 * star.speed;
        const pxP   = cx + (star.x / prevZ) * width * 0.5;
        const pyP   = cy + (star.y / prevZ) * height * 0.5;
        const alpha = 0.22 + (1 - star.z) * 0.68;
        // Trail: white, slight blue tint on every 7th star
        ctx.fillStyle = i % 7 === 0
            ? toHsla("210 60% 88%", alpha)
            : toHsla("0 0% 100%", alpha * 0.85);
        drawPixelLine(ctx, pxP, pyP, sxP, syP, pixel);
        const dotSz = star.z < 0.25 ? pixel * 2 : pixel;
        ctx.fillStyle = toHsla("0 0% 100%", star.z < 0.25 ? 0.92 : 0.52);
        ctx.fillRect(Math.floor(sxP / pixel) * pixel, Math.floor(syP / pixel) * pixel, dotSz, dotSz);
    }

    // ── Asteroids: update and split by depth ──────────────────────────────
    const targetAst = Math.max(4, Math.floor((width * height) / 80000));
    while (_ast.length < targetAst) _ast.push(makeAst());

    const astBehind: Array<{ a: Asteroid; projX: number; projY: number; projR: number }> = [];
    const astFront:  Array<{ a: Asteroid; projX: number; projY: number; projR: number }> = [];

    for (let i = _ast.length - 1; i >= 0; i--) {
        const a = _ast[i];
        a.z   -= (0.003 + energy * 0.008) * a.speed * motionBoost;
        a.rot += a.rs * dt * motionBoost;
        if (a.z <= 0.04) { _ast.splice(i, 1); continue; }
        const projX = cx + (a.ox / a.z) * width  * 0.4;
        const projY = cy + (a.oy / a.z) * height * 0.4;
        if (projX < -120 || projX > width + 120 || projY < -120 || projY > height + 120) {
            _ast.splice(i, 1); continue;
        }
        const projR = (a.baseR / a.z) * (Math.min(width, height) / 500);
        if (a.z > SHIP_Z_FRONT) {
            astBehind.push({ a, projX, projY, projR });
        } else {
            astFront.push({ a, projX, projY, projR });
        }
    }

    // Draw asteroids behind the ship
    for (const { a, projX, projY, projR } of astBehind)
        drawAst(ctx, projX, projY, projR, a.rot, a.shapeIdx, pixel);

    // ── Ship ──────────────────────────────────────────────────────────────
    const shipX = snapToPixel(cx + Math.sin(t * 1.4 + progressNorm * 9) * width * 0.22, pixel);
    const shipY = snapToPixel(height * 0.76 + Math.cos(t * 0.9 + progressNorm * 5) * pixel * 4, pixel);
    const bank  = Math.cos(t * 1.4 + progressNorm * 9);

    // Check ship collision with front asteroids (same/closer z-level)
    if (!_shipExploding) {
        const shipR = pixel * 11;
        for (const { a, projX, projY, projR } of astFront) {
            const dist = Math.sqrt((projX - shipX) ** 2 + (projY - shipY) ** 2);
            if (dist < projR * 0.85 + shipR) {
                _shipExploding = true;
                _shipExplodeTimer = 0;
                spawnDebris(shipX, shipY, pixel * 18, pixel, palette);
                spawnDebris(shipX, shipY, pixel * 12, pixel, palette);
                const idx = _ast.indexOf(a);
                if (idx >= 0) _ast.splice(idx, 1);
                break;
            }
        }
    }

    if (_shipExploding) {
        _shipExplodeTimer += dt;
        if (_shipExplodeTimer >= SHIP_RESPAWN) {
            _shipExploding = false;
            _shipExplodeTimer = 0;
        }
    } else {
        const numParts = isPlaying ? Math.ceil(1 + energy * 2) : 1;
        for (let i = 0; i < numParts; i++) {
            _exh.push({
                x: shipX + (Math.random() - 0.5) * pixel * 4, y: shipY + pixel * 2,
                vx: (Math.random() - 0.5) * 30, vy: 45 + Math.random() * 65,
                life: 0.20 + Math.random() * 0.25,
            });
        }
        for (let i = _exh.length - 1; i >= 0; i--) {
            const e = _exh[i];
            e.x += e.vx * dt; e.y += e.vy * dt; e.life -= dt;
            if (e.life <= 0) { _exh.splice(i, 1); continue; }
            ctx.fillStyle = toHsla("200 90% 62%", clamp(e.life * 3.2, 0, 0.65));
            ctx.fillRect(Math.floor(e.x / pixel) * pixel, Math.floor(e.y / pixel) * pixel, pixel, pixel);
        }
        drawShip(ctx, shipX, shipY, pixel, energy, t, bank, palette);
    }

    // Draw asteroids in front of the ship (on top for depth illusion)
    for (const { a, projX, projY, projR } of astFront)
        drawAst(ctx, projX, projY, projR, a.rot, a.shapeIdx, pixel);

    // ── Lasers + collision ────────────────────────────────────────────────
    _laserCD = Math.max(0, _laserCD - dt);
    if (!_shipExploding && isPlaying && _laserCD <= 0 && energy > 0.45) {
        if (energy - _prevEn > 0.05 || energy > 0.78) {
            _lasers.push({ sx: shipX - pixel * 4, sy: shipY - pixel * 9, t: 0 });
            _lasers.push({ sx: shipX + pixel * 4, sy: shipY - pixel * 9, t: 0 });
            _laserCD = 0.16;
        }
    }
    _prevEn = energy;

    for (let li = _lasers.length - 1; li >= 0; li--) {
        const l = _lasers[li];
        l.t += dt * 1.8;
        if (l.t >= 1) { _lasers.splice(li, 1); continue; }

        const lx = l.sx + (cx - l.sx) * l.t;
        const ly = l.sy + (cy - l.sy) * l.t;

        // Collision check vs asteroids
        let hit = false;
        for (let ai = _ast.length - 1; ai >= 0; ai--) {
            const a     = _ast[ai];
            const projX = cx + (a.ox / a.z) * width  * 0.4;
            const projY = cy + (a.oy / a.z) * height * 0.4;
            const projR = (a.baseR / a.z) * (Math.min(width, height) / 500);
            const dist  = Math.sqrt((lx - projX) ** 2 + (ly - projY) ** 2);
            if (dist < Math.max(projR * 1.3, pixel * 3)) {
                spawnDebris(projX, projY, projR, pixel, palette);
                _ast.splice(ai, 1);
                hit = true;
                break;
            }
        }
        if (hit) { _lasers.splice(li, 1); continue; }

        const sz  = Math.max(pixel, Math.ceil((1 - l.t) * 2.5) * pixel);
        const lxS = Math.floor(lx / pixel) * pixel;
        const lyS = Math.floor(ly / pixel) * pixel;
        ctx.fillStyle = toHsla("220 100% 62%", 0.90);
        ctx.fillRect(lxS - sz, lyS, sz * 3, sz);
        ctx.fillStyle = "rgba(180,210,255,0.85)";
        ctx.fillRect(lxS, lyS, sz, sz);
    }

    // ── Debris fragments ──────────────────────────────────────────────────
    for (let i = _debris.length - 1; i >= 0; i--) {
        const d = _debris[i];
        d.x    += d.vx * dt;
        d.y    += d.vy * dt;
        d.vy   += 25 * dt;  // gentle gravity drift
        d.life -= dt;
        if (d.life <= 0) { _debris.splice(i, 1); continue; }
        const alpha = clamp(d.life / d.maxLife, 0, 1);
        ctx.fillStyle = toHsla(d.col, alpha * 0.85);
        ctx.fillRect(
            Math.floor(d.x / pixel) * pixel,
            Math.floor(d.y / pixel) * pixel,
            d.sz, d.sz
        );
    }

    // ── HUD (EQ bars) ─────────────────────────────────────────────────────
    const barCount  = Math.max(14, Math.floor(width / (pixel * 6)));
    const barW      = pixel * 3;
    const barGap    = pixel * 3;
    const panelW    = barCount * (barW + barGap) - barGap;
    const hudStartX = Math.floor((width - panelW) / 2 / pixel) * pixel;
    const maxBlocks = 12;
    const floorY    = height - pixel * 4;
    const panelH    = (maxBlocks + 3) * (pixel + 1);
    const panelTop  = floorY - panelH;

    const hudGrad = ctx.createLinearGradient(0, panelTop, 0, floorY);
    hudGrad.addColorStop(0, toHsla(palette.dark, 0.50));
    hudGrad.addColorStop(1, toHsla(palette.dark, 0.88));
    ctx.fillStyle = hudGrad;
    ctx.fillRect(hudStartX - pixel * 2, panelTop, panelW + pixel * 4, panelH);

    ctx.strokeStyle = toHsla(palette.accent, 0.40);
    ctx.lineWidth   = Math.max(1, Math.floor(pixel * 0.8));
    ctx.strokeRect(hudStartX - pixel * 2, panelTop, panelW + pixel * 4, panelH);

    const cs = pixel * 4;
    ctx.fillStyle = toHsla(palette.accent, 0.65);
    const bh: [number, number][] = [
        [hudStartX - pixel * 2,                panelTop],
        [hudStartX + panelW + pixel * 2 - cs,  panelTop],
        [hudStartX - pixel * 2,                floorY - pixel],
        [hudStartX + panelW + pixel * 2 - cs,  floorY - pixel],
    ];
    for (const [bx, by] of bh) ctx.fillRect(bx, by, cs, pixel);
    const bv: [number, number][] = [
        [hudStartX - pixel * 2,     panelTop],
        [hudStartX + panelW + pixel, panelTop],
        [hudStartX - pixel * 2,     floorY - cs],
        [hudStartX + panelW + pixel, floorY - cs],
    ];
    for (const [bx, by] of bv) ctx.fillRect(bx, by, pixel, cs);

    for (let i = 0; i < barCount; i++) {
        const pA     = Math.sin(i * 0.65 + t * (isPlaying ? 11.5 : 2.7) + progressNorm * 16);
        const pB     = Math.cos(i * 0.34 + t * (isPlaying ? 6.2  : 1.7) + progressNorm * 10);
        const signal = clamp(((pA + pB) * 0.5 + 1) * 0.5, 0, 1);
        const blocks = Math.max(1, Math.round(signal * maxBlocks * (0.48 + volumeNorm * 1.2) * (isPlaying ? 1 : 0.4)));
        const bx     = hudStartX + i * (barW + barGap);
        for (let b = 0; b < blocks; b++) {
            const by   = floorY - b * (pixel + 1);
            const frac = b / maxBlocks;
            const ba   = 0.30 + energy * 0.45;
            ctx.fillStyle = frac > 0.78 ? toHsla(palette.danger,  ba + 0.12)
                          : frac > 0.45 ? toHsla(palette.accent,  ba)
                          :               toHsla(palette.primary, ba - 0.05);
            ctx.fillRect(bx, by, barW, pixel);
        }
        ctx.fillStyle = toHsla("0 0% 100%", 0.55);
        ctx.fillRect(bx, floorY - blocks * (pixel + 1) - pixel, barW, pixel);
    }

    // ── Scanlines ─────────────────────────────────────────────────────────
    const scanY = Math.floor(((t * (isPlaying ? 120 : 42)) % height) / pixel) * pixel;
    ctx.fillStyle = toHsla(palette.primary, 0.05 + energy * 0.09);
    ctx.fillRect(0, scanY, width, pixel * 2);
    for (let y = 0; y < height; y += pixel * 2) {
        ctx.fillStyle = toHsla("0 0% 0%", 0.04);
        ctx.fillRect(0, y, width, 1);
    }
};
