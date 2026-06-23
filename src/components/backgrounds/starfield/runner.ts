import { snapToPixel, toHsla } from "../shared/utils";
import type { Palette, RunnerState } from "../shared/types";

export const createRunnerState = (): RunnerState => ({
    y: 0,
    vy: 0,
    cooldown: 0,
    obstacles: [],
    speed: 100,
    score: 0,
    best: 0,
    spawnTimer: 0.7,
    flash: 0,
});

export const drawRunnerSprite = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    pixel: number,
    frameToggle: boolean,
    palette: Palette
) => {
    const bodyW = pixel * 5;
    const bodyH = pixel * 3;
    const headW = pixel * 2;
    const bodyX = x;
    const bodyY = y - bodyH;
    const legY = y;

    ctx.fillStyle = toHsla(palette.primary, 0.9);
    ctx.fillRect(bodyX, bodyY, bodyW, bodyH);
    ctx.fillRect(bodyX + pixel * 3, bodyY - pixel * 2, headW, pixel * 2);
    ctx.fillStyle = toHsla("0 0% 96%", 0.9);
    ctx.fillRect(bodyX + pixel * 4, bodyY - pixel, pixel, pixel);
    ctx.fillStyle = toHsla(palette.dark, 0.9);
    ctx.fillRect(bodyX + pixel * 4, bodyY - pixel, pixel, pixel);
    ctx.fillStyle = toHsla(palette.accent, 0.9);
    if (frameToggle) {
        ctx.fillRect(bodyX + pixel, legY, pixel, pixel);
        ctx.fillRect(bodyX + pixel * 3, legY, pixel, pixel);
    } else {
        ctx.fillRect(bodyX + pixel * 2, legY, pixel, pixel);
        ctx.fillRect(bodyX + pixel * 4, legY, pixel, pixel);
    }
};

export const drawIdleRunnerGame = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dt: number,
    t: number,
    volumeNorm: number,
    palette: Palette,
    state: RunnerState
) => {
    const pixel = Math.max(3, Math.floor(Math.min(width, height) / 260));
    const panelW = snapToPixel(Math.min(width * 0.62, pixel * 120), pixel);
    const panelH = snapToPixel(Math.min(height * 0.24, pixel * 34), pixel);
    const panelX = snapToPixel((width - panelW) / 2, pixel);
    const panelY = snapToPixel(height - panelH - pixel * 3, pixel);
    const floorY = panelY + panelH - pixel * 6;
    const gameLeft = panelX + pixel * 3;
    const gameRight = panelX + panelW - pixel * 3;
    const gameWidth = gameRight - gameLeft;
    const playerX = gameLeft + pixel * 8;
    const playerW = pixel * 5;
    const playerH = pixel * 5;

    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt * 1.5);
    state.speed = 95 + Math.min(170, state.score * 0.9);

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
        const widthUnits = 2 + Math.floor(Math.random() * 4);
        const heightUnits = 2 + Math.floor(Math.random() * 5);
        state.obstacles.push({
            x: gameWidth + pixel * (4 + Math.floor(Math.random() * 5)),
            width: widthUnits * pixel,
            height: heightUnits * pixel,
            passed: false,
        });
        const pace = Math.max(0.45, 0.95 - Math.min(0.36, state.score * 0.003));
        state.spawnTimer = pace + Math.random() * 0.55;
    }

    const nextObstacle = state.obstacles.find((obstacle) => obstacle.x + obstacle.width >= playerX - gameLeft);
    if (nextObstacle) {
        const dist = nextObstacle.x - (playerX - gameLeft);
        const trigger = pixel * 5 + state.speed * 0.11;
        if (dist > 0 && dist < trigger && state.y <= 0 && state.cooldown <= 0) {
            state.vy = 195 + state.speed * 0.4 + volumeNorm * 70;
            state.cooldown = 0.23;
        }
    }

    state.vy -= 560 * dt;
    state.y += state.vy * dt;
    if (state.y < 0) {
        state.y = 0;
        state.vy = 0;
    }

    for (let i = state.obstacles.length - 1; i >= 0; i -= 1) {
        const obstacle = state.obstacles[i];
        obstacle.x -= state.speed * dt;

        const obsX = gameLeft + obstacle.x;
        const obsY = floorY - obstacle.height;
        const playerY = floorY - playerH - state.y;
        const collision =
            obsX < playerX + playerW &&
            obsX + obstacle.width > playerX &&
            obsY < playerY + playerH &&
            obsY + obstacle.height > playerY;

        if (collision) {
            state.best = Math.max(state.best, Math.floor(state.score));
            state.score = 0;
            state.y = 0;
            state.vy = 0;
            state.cooldown = 0.25;
            state.obstacles = [];
            state.spawnTimer = 0.8;
            state.flash = 0.85;
            break;
        }

        if (!obstacle.passed && obstacle.x + obstacle.width < playerX - gameLeft) {
            obstacle.passed = true;
            state.score += 10;
        }

        if (obstacle.x + obstacle.width < -pixel * 2) {
            state.obstacles.splice(i, 1);
        }
    }

    ctx.fillStyle = toHsla(palette.dark, 0.78);
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = toHsla(palette.border, 0.6);
    ctx.lineWidth = pixel;
    ctx.strokeRect(panelX, panelY, panelW, panelH);
    ctx.fillStyle = toHsla(palette.primary, 0.18);
    ctx.fillRect(gameLeft, panelY + pixel * 2, gameWidth, floorY - (panelY + pixel * 2));
    ctx.fillStyle = toHsla(palette.accent, 0.45);
    ctx.fillRect(gameLeft, floorY, gameWidth, pixel);

    for (let x = gameLeft; x < gameRight; x += pixel * 3) {
        ctx.fillStyle = toHsla(palette.border, 0.22);
        ctx.fillRect(x, floorY + pixel, pixel, pixel);
    }

    for (const obstacle of state.obstacles) {
        const ox = snapToPixel(gameLeft + obstacle.x, pixel);
        const oy = floorY - obstacle.height;
        ctx.fillStyle = toHsla(palette.danger, 0.74);
        ctx.fillRect(ox, oy, obstacle.width, obstacle.height);
        ctx.fillStyle = toHsla(palette.primary, 0.24);
        ctx.fillRect(ox, oy + pixel, obstacle.width, pixel);
    }

    const playerY = snapToPixel(floorY - state.y, pixel);
    drawRunnerSprite(
        ctx,
        snapToPixel(playerX, pixel),
        playerY,
        pixel,
        Math.floor(t * 8) % 2 === 0 && state.y < pixel,
        palette
    );

    const scoreBlocks = Math.min(20, Math.floor(state.score / 10));
    const bestBlocks = Math.min(20, Math.floor(state.best / 10));
    for (let i = 0; i < 20; i += 1) {
        const x = panelX + pixel * 2 + i * (pixel + 1);
        ctx.fillStyle = i < scoreBlocks ? toHsla(palette.primary, 0.75) : toHsla(palette.border, 0.2);
        ctx.fillRect(x, panelY + pixel, pixel, pixel);
        ctx.fillStyle = i < bestBlocks ? toHsla(palette.accent, 0.62) : toHsla(palette.border, 0.14);
        ctx.fillRect(x, panelY + pixel * 3, pixel, pixel);
    }

    if (state.flash > 0) {
        ctx.fillStyle = toHsla(palette.danger, 0.2 * state.flash);
        ctx.fillRect(panelX, panelY, panelW, panelH);
    }
};
