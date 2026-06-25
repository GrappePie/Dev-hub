import { clamp, snapToPixel, toHsla } from "../shared/utils";

type MountainAnimation = {
    backScale: number;
    frontScale: number;
};

type MountainBlock = {
    x: number;
    y: number;
    width: number;
    hStatic: number;
};

type SnowyPeakDefinition = {
    x: number;
    w: number;
    h: number;
    peak: number;
    baseOffset: number;
    lean: number;
};

const snowyPeakSeed = Math.random() * 1000;

const seededUnit = (value: number): number => {
    const raw = Math.sin(value * 12.9898 + snowyPeakSeed * 78.233) * 43758.5453;
    return raw - Math.floor(raw);
};

const buildSnowyPeaks = (): SnowyPeakDefinition[] => {
    const basePeaks = [
        { x: -0.10, w: 0.34, h: 0.34 },
        { x: 0.07, w: 0.30, h: 0.26 },
        { x: 0.26, w: 0.42, h: 0.37 },
        { x: 0.54, w: 0.34, h: 0.28 },
        { x: 0.70, w: 0.42, h: 0.35 },
    ] as const;

    return basePeaks.map((peak, index) => {
        const n = (offset: number) => seededUnit(index * 13.7 + offset);

        return {
            x: peak.x + (n(1) - 0.5) * 0.06,
            w: peak.w + (n(2) - 0.5) * 0.08,
            h: peak.h + (n(3) - 0.5) * 0.10,
            peak: 0.36 + n(4) * 0.28,
            baseOffset: (n(5) - 0.5) * 10,
            lean: (n(6) - 0.5) * 0.24,
        };
    });
};

const snowyPeaks = buildSnowyPeaks();

const hasValidGeometry = (
    width: number,
    groundY: number,
    pixel: number,
    t: number,
    progressNorm: number,
    volumeNorm: number
): boolean =>
    [width, groundY, pixel, t, progressNorm, volumeNorm].every(Number.isFinite) &&
    width > 0 &&
    groundY > 0 &&
    pixel > 0;

const getMountainAnimation = (
    t: number,
    progressNorm: number,
    isPlaying: boolean,
    volumeNorm: number
): MountainAnimation => {
    const vol = clamp(volumeNorm, 0, 1);

    // Mountains only grow UP with volume — static height is the minimum.
    const backSpread = 0.30 * vol;
    const frontSpread = 0.38 * vol;

    const backSteps = [
        1.0,
        1.0 + backSpread * 0.5,
        1.0 + backSpread,
    ] as const;
    const frontSteps = [
        1.0,
        1.0 + frontSpread * 0.33,
        1.0 + frontSpread * 0.66,
        1.0 + frontSpread,
    ] as const;

    const backIndex =
        (Math.floor(t / 0.55) * 7 + Math.floor(progressNorm * 31)) %
        backSteps.length;
    const frontIndex =
        (Math.floor(t / 0.38) * 11 + Math.floor(progressNorm * 17)) %
        frontSteps.length;

    return {
        backScale: isPlaying ? (backSteps[backIndex] ?? 1.0) : 1.0,
        frontScale: isPlaying ? (frontSteps[frontIndex] ?? 1.0) : 1.0,
    };
};

const buildMountainBlocks = (
    width: number,
    groundY: number,
    pixel: number,
    blockWidth: number,
    maxHeight: number,
    scale: number,
    profileFor: (nx: number) => number
): MountainBlock[] => {
    const blocks: MountainBlock[] = [];

    for (let x = 0; x < width; x += blockWidth) {
        const blockCenter = x + blockWidth * 0.5;
        const nx = clamp(blockCenter / width, 0, 1);
        const profile = profileFor(nx);
        const hStatic = Math.max(pixel * 2, maxHeight * profile);
        const h = Math.max(pixel * 2, maxHeight * profile * scale);
        const y = snapToPixel(groundY - h, pixel);

        blocks.push({
            x,
            y,
            width: Math.min(blockWidth, width - x),
            hStatic,
        });
    }

    return blocks;
};

const drawSnowyPeak = (
    ctx: CanvasRenderingContext2D,
    baseX: number,
    baseY: number,
    peakWidth: number,
    peakHeight: number,
    peakRatio: number,
    pixel: number,
    lean: number,
    variant: number
): void => {
    const p = pixel;
    const peakX = baseX + peakWidth * peakRatio;
    const startX = snapToPixel(baseX, p);
    const endX = snapToPixel(baseX + peakWidth, p);

    for (let x = startX; x <= endX; x += p) {
        const rel = clamp((x - baseX) / peakWidth, 0, 1);
        const isLeftFace = x < peakX;
        const sideProgress =
            rel <= peakRatio
                ? rel / Math.max(peakRatio, 0.01)
                : (1 - rel) / Math.max(1 - peakRatio, 0.01);
        const leftPower = 0.78 + seededUnit(variant * 31 + 1) * 0.30;
        const rightPower = 0.94 + seededUnit(variant * 31 + 2) * 0.40;
        const shapedProgress = Math.pow(sideProgress, isLeftFace ? leftPower : rightPower);
        const shoulderCenter = isLeftFace
            ? peakRatio * (0.34 + seededUnit(variant * 31 + 3) * 0.25)
            : peakRatio + (1 - peakRatio) * (0.44 + seededUnit(variant * 31 + 4) * 0.28);
        const shoulderWidth =
            (isLeftFace ? peakRatio : 1 - peakRatio) *
            (0.24 + seededUnit(variant * 31 + 5) * 0.22);
        const shoulder = Math.max(
            0,
            1 - Math.abs(rel - shoulderCenter) / Math.max(shoulderWidth, 0.01)
        ) * peakHeight * (0.07 + seededUnit(variant * 31 + 6) * 0.08);
        const chip =
            ((Math.floor(x / p) + variant * 3) % (9 + Math.floor(seededUnit(variant + 7) * 5)) === 0 ? p * 3 : 0) +
            ((Math.floor(x / p) + variant) % (6 + Math.floor(seededUnit(variant + 8) * 4)) === 0 ? p : 0);
        const leanOffset = (rel - peakRatio) * peakHeight * lean;
        const h = Math.max(0, peakHeight * shapedProgress + shoulder + leanOffset - chip);
        const topY = snapToPixel(baseY - h, p);
        const columnH = Math.max(0, baseY - topY);

        if (columnH <= 0) continue;

        const centerDistance = Math.abs(x - peakX) / Math.max(peakWidth * 0.5, p);
        const faceColor = isLeftFace
            ? centerDistance < 0.30
                ? "195 52% 18%"
                : "197 55% 25%"
            : centerDistance < 0.30
                ? "190 46% 30%"
                : "194 45% 48%";

        ctx.fillStyle = toHsla(faceColor, 1.0);
        ctx.fillRect(x, topY, p, columnH);

        if (sideProgress > 0.64) {
            const capProgress = (sideProgress - 0.64) / 0.36;
            const snowDepth =
                p * 2 +
                p * Math.floor(capProgress * 7) -
                ((Math.floor(x / p) + variant) % 4) * p;
            const snowBottom = Math.min(baseY, topY + Math.max(p, snowDepth));
            const snowColor = isLeftFace ? "205 16% 82%" : "0 0% 98%";

            ctx.fillStyle = toHsla(snowColor, 1.0);
            ctx.fillRect(x, topY, p, Math.max(p, snowBottom - topY));

            if (!isLeftFace && capProgress > 0.35 && (Math.floor(x / p) + variant) % 6 === 0) {
                ctx.fillStyle = toHsla("0 0% 96%", 0.92);
                ctx.fillRect(x, snowBottom, p, p * 2);
            }
        }

        if (isLeftFace && sideProgress > 0.42 && sideProgress < 0.78 && (Math.floor(x / p) + variant) % 6 === 0) {
            ctx.fillStyle = toHsla("201 62% 16%", 0.55);
            ctx.fillRect(x, topY + columnH * 0.44, p, p * 3);
        }
    }

    ctx.fillStyle = toHsla("202 55% 13%", 0.40);
    ctx.fillRect(startX, baseY - p, Math.max(p, endX - startX), p);
};

/** Blue-purple mountains in the background. Draw these before the rainbow. */
export const drawPixelBackMountains = (
    ctx: CanvasRenderingContext2D,
    width: number,
    groundY: number,
    pixel: number,
    t: number,
    progressNorm: number,
    isPlaying: boolean,
    volumeNorm: number
): void => {
    if (!hasValidGeometry(width, groundY, pixel, t, progressNorm, volumeNorm)) {
        return;
    }

    const p = pixel;
    const { backScale } = getMountainAnimation(
        t,
        progressNorm,
        isPlaying,
        volumeNorm
    );

    const baseY = snapToPixel(groundY - p * 4, p);

    for (const [index, peak] of snowyPeaks.entries()) {
        drawSnowyPeak(
            ctx,
            width * peak.x,
            snapToPixel(baseY + peak.baseOffset * p, p),
            width * peak.w,
            groundY * peak.h * backScale,
            peak.peak,
            p,
            peak.lean,
            index
        );
    }
};

/** Pine-green mountains in the foreground. Draw these after the rainbow. */
export const drawPixelFrontMountains = (
    ctx: CanvasRenderingContext2D,
    width: number,
    groundY: number,
    pixel: number,
    t: number,
    progressNorm: number,
    isPlaying: boolean,
    volumeNorm: number
): void => {
    if (!hasValidGeometry(width, groundY, pixel, t, progressNorm, volumeNorm)) {
        return;
    }

    const p = pixel;
    const { frontScale } = getMountainAnimation(
        t,
        progressNorm,
        isPlaying,
        volumeNorm
    );

    const frontH = groundY * 0.18;
    const blockWidth = p * 2;
    const blocks = buildMountainBlocks(
        width,
        groundY,
        p,
        blockWidth,
        frontH,
        frontScale,
        (nx) =>
            0.58 + 0.26 * Math.sin(nx * Math.PI * 3.1 + 3.8) +
            0.10 * Math.sin(nx * Math.PI * 6.7 + 1.3) +
            0.06 * Math.sin(nx * Math.PI * 12.4 + 2.1)
    );

    ctx.fillStyle = toHsla("136 50% 33%", 1.0);
    for (const block of blocks) {
        ctx.fillRect(block.x, block.y + p, block.width, Math.max(0, groundY - block.y - p));
    }

    for (const [index, block] of blocks.entries()) {
        ctx.fillStyle = toHsla("138 62% 48%", 1.0);
        ctx.fillRect(block.x, block.y, block.width, p);

        if (index % 4 === 0 && block.hStatic > frontH * 0.5) {
            ctx.fillStyle = toHsla("138 42% 24%", 0.65);
            ctx.fillRect(block.x, block.y + p * 5, block.width * 2, p);
            ctx.fillRect(block.x + p, block.y + p * 8, block.width, p);
        }

        if (index % 5 === 2 && block.hStatic > frontH * 0.55) {
            const treeX = snapToPixel(block.x + block.width * 0.5, p);
            const treeH = p * 10;

            for (let layer = 0; layer < 4; layer++) {
                const layerWidth = (layer + 1) * 2 - 1;
                const layerY = snapToPixel(block.y - treeH + layer * p * 3, p);
                const offsetX = treeX - Math.floor(layerWidth / 2) * p;
                const shade = layer < 2 ? "148 55% 22%" : "145 52% 30%";

                ctx.fillStyle = toHsla(shade, 1.0);
                ctx.fillRect(offsetX, layerY, layerWidth * p, p * 2);
            }

            ctx.fillStyle = toHsla("28 42% 28%", 1.0);
            ctx.fillRect(treeX, block.y - p * 3, p, p * 3);
        }
    }
};

/** Backward-compatible renderer for scenes that still draw both ranges together. */
export const drawPixelMountains = (
    ctx: CanvasRenderingContext2D,
    width: number,
    groundY: number,
    pixel: number,
    t: number,
    progressNorm: number,
    isPlaying: boolean,
    volumeNorm: number
): void => {
    drawPixelBackMountains(
        ctx,
        width,
        groundY,
        pixel,
        t,
        progressNorm,
        isPlaying,
        volumeNorm
    );
    drawPixelFrontMountains(
        ctx,
        width,
        groundY,
        pixel,
        t,
        progressNorm,
        isPlaying,
        volumeNorm
    );
};
