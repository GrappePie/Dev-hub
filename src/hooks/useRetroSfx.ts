import { useCallback, useRef } from "react";

type SfxType =
    | "select"    // menu cursor move / hover
    | "confirm"   // press start, play, confirm action
    | "cancel"    // back, pause, deselect
    | "navigate"  // skip track, next/prev
    | "toggle"    // shuffle, repeat, like
    | "coin"      // login transition
    | "powerup"   // special action
    | "ultimate"  // overpowered character selection
    | "success"   // auth ok / positive completion
    | "fail"      // auth failed / negative result
    | "text"      // typewriter tick
    | "menu-open" // SNES RPG dialog box open
    | "menu-close"; // SNES RPG dialog box close

const useRetroSfx = () => {
    const ctxRef = useRef<AudioContext | null>(null);

    const getCtx = useCallback(() => {
        if (!ctxRef.current) {
            const ctx = new AudioContext();
            // Mark as our own context so the audio interceptor ignores it
            (ctx as AudioContext & { __devhubOwned?: boolean }).__devhubOwned = true;
            ctxRef.current = ctx;
        }
        return ctxRef.current;
    }, []);

    const playTone = useCallback(
        (freq: number, duration: number, type: OscillatorType = "square", volume = 0.15, detune = 0) => {
            const ctx = getCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            osc.detune.value = detune;
            gain.gain.setValueAtTime(volume, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + duration);
        },
        [getCtx]
    );

    const play = useCallback(
        (sfx: SfxType) => {
            try {
                switch (sfx) {
                    case "select":
                        // Quick high blip like Zelda menu cursor
                        playTone(880, 0.06, "square", 0.1);
                        break;

                    case "confirm":
                        // Two-tone ascending like Mario coin but shorter
                        playTone(660, 0.08, "square", 0.12);
                        setTimeout(() => playTone(880, 0.12, "square", 0.12), 60);
                        break;

                    case "cancel":
                        // Descending tone
                        playTone(440, 0.08, "square", 0.1);
                        setTimeout(() => playTone(330, 0.1, "square", 0.1), 60);
                        break;

                    case "navigate":
                        // Quick sweep like Zelda menu scroll
                        playTone(587, 0.05, "square", 0.1);
                        setTimeout(() => playTone(784, 0.07, "square", 0.1), 40);
                        break;

                    case "toggle":
                        // Short chirp
                        playTone(1047, 0.04, "square", 0.08);
                        setTimeout(() => playTone(1319, 0.06, "square", 0.08), 35);
                        break;

                    case "coin":
                        // Classic Mario coin sound
                        playTone(988, 0.08, "square", 0.13);
                        setTimeout(() => playTone(1319, 0.3, "square", 0.13), 70);
                        break;

                    case "powerup":
                        // Ascending arpeggio like Mario power-up
                        [523, 659, 784, 1047].forEach((f, i) => {
                            setTimeout(() => playTone(f, 0.1, "square", 0.1), i * 60);
                        });
                        break;

                    case "ultimate":
                        // Long heroic power burst for overpowered selection
                        [494, 659, 784, 988, 1319].forEach((f, i) => {
                            setTimeout(() => playTone(f, 0.12, "square", 0.11), i * 58);
                        });
                        setTimeout(() => playTone(1568, 0.28, "sawtooth", 0.09), 300);
                        break;

                    case "success":
                        // Bright success jingle
                        [784, 988, 1175, 1568].forEach((f, i) => {
                            setTimeout(() => playTone(f, 0.11, "square", 0.11), i * 55);
                        });
                        break;

                    case "fail":
                        // Short descending fail tone
                        [440, 370, 294].forEach((f, i) => {
                            setTimeout(() => playTone(f, 0.12, "square", 0.11), i * 70);
                        });
                        break;

                    case "text":
                        // Tiny tick for typewriter
                        playTone(440 + Math.random() * 200, 0.02, "square", 0.04);
                        break;

                    case "menu-open":
                        // SNES RPG dialog open – quick ascending arpeggio (Chrono Trigger / FF style)
                        [523, 659, 784, 1047].forEach((f, i) => {
                            setTimeout(() => playTone(f, 0.07, "square", 0.09), i * 40);
                        });
                        setTimeout(() => playTone(1047, 0.18, "square", 0.07, -10), 175);
                        break;

                    case "menu-close":
                        // Quick descending sweep on close
                        [784, 523].forEach((f, i) => {
                            setTimeout(() => playTone(f, 0.06, "square", 0.07), i * 40);
                        });
                        break;
                }
            } catch {
                // AudioContext not available
            }
        },
        [playTone]
    );

    return play;
};

export default useRetroSfx;
