import { snapToPixel, toHsla } from "../shared/utils";
import type { Palette } from "../shared/types";

export const drawFrogSprite = (
    ctx: CanvasRenderingContext2D,
    centerX: number,
    floorY: number,
    pixel: number,
    jump: number,
    t: number,
    palette: Palette,
    squashX = 1,
    squashY = 1
) => {
    const x = snapToPixel(centerX, pixel);
    const y = snapToPixel(floorY - jump, pixel);

    if (squashX !== 1 || squashY !== 1) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(squashX, squashY);
        ctx.translate(-x, -y);
    }
    const bodyW = pixel * 8;
    const bodyH = pixel * 3;
    const bodyX = x - bodyW / 2;
    const bodyY = y - bodyH;
    const crouched = jump > pixel * 2;
    const blink = Math.sin(t * 6.5 + x * 0.03) > 0.92;
    const frogBody  = "140 55% 32%";
    const frogLight = "140 50% 48%";
    const frogEye   = "90 60% 72%";
    const frogMouth = "0 65% 45%";
    const frogDark  = "240 25% 10%";

    ctx.fillStyle = toHsla(frogBody, 0.88);
    ctx.fillRect(bodyX, bodyY, bodyW, bodyH);
    ctx.fillRect(bodyX + pixel, bodyY - pixel, bodyW - pixel * 2, pixel);

    ctx.fillStyle = toHsla(frogEye, 0.9);
    ctx.fillRect(bodyX + pixel, bodyY - pixel * 2, pixel * 2, pixel);
    ctx.fillRect(bodyX + bodyW - pixel * 3, bodyY - pixel * 2, pixel * 2, pixel);

    if (blink) {
        ctx.fillStyle = toHsla(frogDark, 0.95);
        ctx.fillRect(bodyX + pixel, bodyY - pixel, pixel * 2, pixel);
        ctx.fillRect(bodyX + bodyW - pixel * 3, bodyY - pixel, pixel * 2, pixel);
    } else {
        ctx.fillStyle = toHsla("0 0% 96%", 0.9);
        ctx.fillRect(bodyX + pixel, bodyY - pixel, pixel, pixel);
        ctx.fillRect(bodyX + bodyW - pixel * 2, bodyY - pixel, pixel, pixel);
        ctx.fillStyle = toHsla(frogDark, 0.9);
        ctx.fillRect(bodyX + pixel, bodyY - pixel, pixel, pixel);
        ctx.fillRect(bodyX + bodyW - pixel * 2, bodyY - pixel, pixel, pixel);
    }

    ctx.fillStyle = toHsla(frogMouth, 0.58);
    ctx.fillRect(bodyX + bodyW / 2 - pixel, bodyY + pixel, pixel * 2, pixel);

    ctx.fillStyle = toHsla(frogLight, 0.92);
    if (crouched) {
        ctx.fillRect(bodyX + pixel * 2, y - pixel, pixel * 2, pixel);
        ctx.fillRect(bodyX + bodyW - pixel * 4, y - pixel, pixel * 2, pixel);
    } else {
        ctx.fillRect(bodyX + pixel, y - pixel, pixel * 2, pixel);
        ctx.fillRect(bodyX + bodyW - pixel * 3, y - pixel, pixel * 2, pixel);
    }

    if (squashX !== 1 || squashY !== 1) ctx.restore();
};

export const drawRabbitSprite = (
    ctx: CanvasRenderingContext2D,
    centerX: number,
    floorY: number,
    pixel: number,
    jump: number,
    t: number,
    palette: Palette,
    squashX = 1,
    squashY = 1
) => {
    const x = snapToPixel(centerX, pixel);
    const y = snapToPixel(floorY - jump, pixel);

    if (squashX !== 1 || squashY !== 1) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(squashX, squashY);
        ctx.translate(-x, -y);
    }
    const bodyW = pixel * 6;
    const bodyH = pixel * 4;
    const bodyX = x - bodyW / 2;
    const bodyY = y - bodyH;
    const earStretch = jump > pixel * 2 ? pixel : pixel * 2;
    const blink = Math.sin(t * 5.3 + x * 0.02) > 0.94;
    const furMain = "0 0% 92%";
    const furShade = "0 0% 78%";
    const furLight = "0 0% 98%";
    const earInner = "345 45% 78%";
    const noseTone = "0 0% 48%";

    ctx.fillStyle = toHsla(furMain, 0.95);
    ctx.fillRect(bodyX, bodyY, bodyW, bodyH);
    ctx.fillStyle = toHsla(furShade, 0.92);
    ctx.fillRect(bodyX + pixel, bodyY - pixel, bodyW - pixel * 2, pixel);

    ctx.fillStyle = toHsla(furLight, 0.95);
    ctx.fillRect(bodyX + pixel, bodyY - pixel * (2 + earStretch / pixel), pixel, pixel * (1 + earStretch / pixel));
    ctx.fillRect(bodyX + bodyW - pixel * 2, bodyY - pixel * (2 + earStretch / pixel), pixel, pixel * (1 + earStretch / pixel));
    ctx.fillStyle = toHsla(earInner, 0.78);
    ctx.fillRect(bodyX + pixel, bodyY - pixel * (1 + earStretch / pixel), pixel, pixel * (earStretch / pixel));
    ctx.fillRect(bodyX + bodyW - pixel * 2, bodyY - pixel * (1 + earStretch / pixel), pixel, pixel * (earStretch / pixel));

    if (blink) {
        ctx.fillStyle = toHsla(palette.dark, 0.9);
        ctx.fillRect(bodyX + pixel, bodyY, pixel * 2, pixel);
    } else {
        ctx.fillStyle = toHsla(palette.dark, 0.95);
        ctx.fillRect(bodyX + pixel, bodyY, pixel, pixel);
        ctx.fillRect(bodyX + pixel * 3, bodyY, pixel, pixel);
    }
    ctx.fillStyle = toHsla(noseTone, 0.8);
    ctx.fillRect(bodyX + pixel * 2, bodyY + pixel, pixel, pixel);

    ctx.fillStyle = toHsla(furLight, 0.8);
    ctx.fillRect(bodyX + bodyW, bodyY + pixel * 2, pixel, pixel);

    if (squashX !== 1 || squashY !== 1) ctx.restore();
};

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
