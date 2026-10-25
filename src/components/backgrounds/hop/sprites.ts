import { snapToPixel, toHsla } from "../shared/utils";
import type { Palette } from "../shared/types";

// Each cell is one whole pixel unit. Poses change cells, never stretch the art.
const drawCritter = (
    ctx: CanvasRenderingContext2D, centerX: number, floorY: number,
    pixel: number, jump: number, t: number, rabbit: boolean,
    squashY: number,
) => {
    const airborne = jump > pixel * 2;
    const crouch = !airborne && squashY < 0.98;
    const blink = ((t + centerX * 0.003) % 4.6) < 0.13;
    const rows = rabbit ? [
        ".oo..oo.", ".op..po.", ".op..po.", ".oo..oo.",
        ".oLLLLo.", "oLLLLLLo", "oLELLELo", ".LLnnLL.",
        ".oLLLLo.", airborne ? "oo....oo" : ".oo..oo.",
    ] : [
        ".oo..oo.", "oLLooLLo", "oELooELo", ".BBBBBB.",
        "oBHBBHBo", "oBBmmBBo", ".BLLLLB.", airborne ? "oo....oo" : "ooBBBBoo",
    ];
    const colors: Record<string, string> = rabbit
        ? { o: "#655574", L: "#f6e9d4", p: "#d68ba4", E: "#29263f", n: "#c76d8b" }
        : { o: "#203a40", L: "#c6e88c", B: "#4d9860", H: "#85c574", E: "#182f38", m: "#294d46" };
    const x = snapToPixel(centerX, pixel) - pixel * 4;
    const y = snapToPixel(floorY - jump, pixel) - rows.length * pixel;
    rows.forEach((row, j) => {
        // Compress a body row on contact; keep feet on the same ground line.
        if (crouch && j === rows.length - 3) return;
        const py = y + j * pixel + (crouch && j < rows.length - 3 ? pixel : 0);
        [...row].forEach((cell, i) => {
            if (cell === ".") return;
            ctx.fillStyle = blink && cell === "E" ? colors.o : colors[cell];
            ctx.fillRect(x + i * pixel, py, pixel, pixel);
        });
    });
};

export const drawFrogSprite = (
    ctx: CanvasRenderingContext2D, centerX: number, floorY: number,
    pixel: number, jump: number, t: number, _palette: Palette,
    _squashX = 1, squashY = 1,
) => drawCritter(ctx, centerX, floorY, pixel, jump, t, false, squashY);

export const drawRabbitSprite = (
    ctx: CanvasRenderingContext2D, centerX: number, floorY: number,
    pixel: number, jump: number, t: number, _palette: Palette,
    _squashX = 1, squashY = 1,
) => drawCritter(ctx, centerX, floorY, pixel, jump, t, true, squashY);

export const drawPixelBird = (
    ctx: CanvasRenderingContext2D,
    bx: number,
    by: number,
    pixel: number,
    wingUp: boolean
) => {
    const p = pixel;
    ctx.fillStyle = toHsla("220 40% 18%", 0.88);
    if (wingUp) {
        ctx.fillRect(bx - p * 2, by - p, p, p);
        ctx.fillRect(bx - p,     by,     p, p);
        ctx.fillRect(bx,         by,     p, p);
        ctx.fillRect(bx + p,     by - p, p, p);
    } else {
        ctx.fillRect(bx - p * 2, by, p, p);
        ctx.fillRect(bx - p,     by, p, p);
        ctx.fillRect(bx,         by, p, p);
        ctx.fillRect(bx + p,     by, p, p);
    }
};

export const drawPixelButterfly = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    pixel: number,
    t: number,
    hue: string
) => {
    const p = pixel;
    const flap = Math.sin(t * 9) > 0;
    ctx.fillStyle = toHsla(hue, 0.9);
    if (flap) {
        ctx.fillRect(cx - p * 2, cy - p,     p * 2, p * 2);
        ctx.fillRect(cx + p,     cy - p,     p * 2, p * 2);
        ctx.fillRect(cx - p * 2, cy + p,     p, p);
        ctx.fillRect(cx + p * 2, cy + p,     p, p);
    } else {
        ctx.fillRect(cx - p,     cy - p,     p, p * 2);
        ctx.fillRect(cx + p,     cy - p,     p, p * 2);
    }
    ctx.fillStyle = toHsla("30 40% 18%", 0.9);
    ctx.fillRect(cx, cy - p, p, p * 3);
};

export const drawPixelBee = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    pixel: number,
    t: number,
    phase: number
) => {
    const p = pixel;
    const hover = snapToPixel(Math.sin(t * 5 + phase) * p, p);
    const wy = cy + hover;
    // Wings
    ctx.fillStyle = toHsla("200 50% 82%", 0.55);
    ctx.fillRect(cx - p * 2, wy - p, p * 2, p);
    ctx.fillRect(cx + p,     wy - p, p * 2, p);
    // Body stripes
    ctx.fillStyle = toHsla("48 100% 52%", 0.95);
    ctx.fillRect(cx - p, wy, p * 3, p);
    ctx.fillStyle = toHsla("0 0% 10%", 0.9);
    ctx.fillRect(cx,     wy, p, p);
    ctx.fillRect(cx - p, wy + p, p * 3, p);
    // Stinger
    ctx.fillStyle = toHsla("0 0% 10%", 0.75);
    ctx.fillRect(cx + p * 2, wy + p, p, p);
};
