import type { MutableRefObject } from "react";

export type ReactiveBackgroundVariant = "arcadeGrid" | "starfieldShooter" | "pixelCritters";

export interface ReactiveBackgroundProps {
    enabled: boolean;
    isPlaying: boolean;
    progress: number;
    volume: number;
    variant: ReactiveBackgroundVariant;
    analyser?: AnalyserNode | null;
    activeComment?: { body: string; username: string } | null;
    beatSignal?: MutableRefObject<number>;
    bpm?: number | null;
    transitionActive?: boolean;
}

export interface Star {
    x: number;
    y: number;
    z: number;
    speed: number;
}

export interface Palette {
    primary: string;
    accent: string;
    dark: string;
    border: string;
    danger: string;
}

export interface RunnerObstacle {
    x: number;
    width: number;
    height: number;
    passed: boolean;
}

export interface RunnerState {
    y: number;
    vy: number;
    cooldown: number;
    obstacles: RunnerObstacle[];
    speed: number;
    score: number;
    best: number;
    spawnTimer: number;
    flash: number;
}

export interface CritterIndividualState {
    phase: number;        // 0→1 arc progress (0=launch, 1=landed)
    targetHeight: number; // max jump amplitude (0-1) set at launch
    cooldown: number;     // seconds of rest after landing
    jumpTimer: number;    // countdown to next autonomous jump (seconds)
    comment?: string;
    commentUser?: string;
    commentTimer: number; // seconds remaining to show the comment (0 = none)
}

export interface CritterState {
    frogs: CritterIndividualState[]; // one entry per critter (frogs + rabbits share this flat array)
    pendingComment?: { body: string; username: string } | null;
}

export const createCritterState = (): CritterState => ({ frogs: [], pendingComment: null });
