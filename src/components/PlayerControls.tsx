import useRetroSfx from "@/hooks/useRetroSfx";
import { Play } from "pixelarticons/react/Play";
import { Shuffle } from "pixelarticons/react/Shuffle";
import { Repeat } from "pixelarticons/react/Repeat";
import { ArrowLeftBox } from "pixelarticons/react/ArrowLeftBox";
import { ArrowRightBox } from "pixelarticons/react/ArrowRightBox";
import { Volume1 } from "pixelarticons/react/Volume1";
import { Volume3 } from "pixelarticons/react/Volume3";
import PixelIcon from "@/components/PixelIcon";
import type { SVGProps } from "react";

interface PlayerControlsProps {
    isPlaying: boolean;
    shuffleMode: "off" | "shuffle" | "smart";
    repeatMode: number;
    progress: number;
    volume: number;
    currentTime: string;
    totalTime: string;
    onPlayPause: () => void;
    onNext: () => void;
    onPrev: () => void;
    onShuffleCycle: () => void;
    onRepeatToggle: () => void;
    onProgressChange: (v: number) => void;
    onVolumeChange: (v: number) => void;
}

const PlayerControls = ({
                            isPlaying, shuffleMode, repeatMode, progress, volume,
                            currentTime, totalTime,
                            onPlayPause, onNext, onPrev, onShuffleCycle, onRepeatToggle,
                            onProgressChange, onVolumeChange,
                        }: PlayerControlsProps) => {
    const sfx = useRetroSfx();
    const isSmartShuffle = shuffleMode === "smart";

    const PausePixel = (props: SVGProps<SVGSVGElement>) => (
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M6 5h4v14H6V5Zm8 0h4v14h-4V5Z" />
        </svg>
    );

    const VolumeMutePixel = (props: SVGProps<SVGSVGElement>) => (
        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M9 2h2v20H9v-2H7v-2h2V6H7V4h2V2ZM7 8H3v8h4v-2H5v-4h2V8Zm10 3h2v2h-2v-2Zm-2-2h2v2h-2V9Zm2 4h2v2h-2v-2Zm-2 2h2v2h-2v-2Z" />
        </svg>
    );

    return (
        <div className="pixel-box-elevated p-5 sm:p-6">
            <div className="flex flex-col gap-5">
                <div className="flex items-center gap-2">
          <span className="font-display text-[8px] text-primary flex items-center gap-2">
            <span className="w-2 h-2 bg-accent border border-foreground animate-pulse-glow" />
            EN REPRODUCCIÓN
          </span>
                </div>

                <div className="space-y-2">
                    <div
                        className="relative h-3 bg-secondary border-2 border-border cursor-pointer"
                        onClick={(e) => {
                            sfx("select");
                            const rect = e.currentTarget.getBoundingClientRect();
                            onProgressChange(((e.clientX - rect.left) / rect.width) * 100);
                        }}
                    >
                        <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
                        <div
                            className="absolute top-[-4px] w-2 h-[calc(100%+8px)] bg-foreground"
                            style={{ left: `${progress}%`, transform: 'translateX(-50%)' }}
                        />
                    </div>
                    <div className="flex justify-between font-display text-[8px] text-muted-foreground">
                        <span>{currentTime}</span>
                        <span>{totalTime}</span>
                    </div>
                </div>

                <div className="flex items-center justify-center gap-3 sm:gap-5">
                    <button
                        onClick={() => { sfx("toggle"); onShuffleCycle(); }}
                        aria-label={isSmartShuffle ? "Smart shuffle activado" : shuffleMode === "shuffle" ? "Shuffle activado" : "Shuffle desactivado"}
                        title={isSmartShuffle ? "Smart Shuffle power field" : shuffleMode === "shuffle" ? "Shuffle activado" : "Shuffle desactivado"}
                        className={`retro-btn-secondary !p-2 ${
                            shuffleMode === "shuffle" ? "!border-primary !text-primary" :
                            isSmartShuffle ? "smart-shuffle-power-field !border-accent !text-accent" : ""
                        }`}
                    >
                        <span className={`${isSmartShuffle ? "smart-shuffle-core " : ""}relative block`}>
                            <PixelIcon icon={Shuffle} size="sm" />
                        </span>
                    </button>

                    <button onClick={() => { sfx("navigate"); onPrev(); }} className="retro-btn-secondary !p-2">
                        <PixelIcon icon={ArrowLeftBox} size="md" />
                    </button>

                    <button
                        onClick={() => { sfx(isPlaying ? "cancel" : "confirm"); onPlayPause(); }}
                        className="retro-btn !px-5 !py-3 flex items-center justify-center"
                    >
                        {isPlaying ? <PixelIcon icon={PausePixel} size="md" /> : <PixelIcon icon={Play} size="md" className="translate-x-[1px]" />}
                    </button>

                    <button onClick={() => { sfx("navigate"); onNext(); }} className="retro-btn-secondary !p-2">
                        <PixelIcon icon={ArrowRightBox} size="md" />
                    </button>

                    <button
                        onClick={() => { sfx("toggle"); onRepeatToggle(); }}
                        className={`retro-btn-secondary !p-2 ${repeatMode > 0 ? '!border-primary !text-primary' : ''}`}
                    >
                        <span className="relative block">
                            <PixelIcon icon={Repeat} size="sm" />
                            {repeatMode === 2 && (
                                <span className="absolute -top-2 -right-1 font-display text-[7px] leading-none text-primary">1</span>
                            )}
                        </span>
                    </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => { sfx("toggle"); onVolumeChange(volume > 0 ? 0 : 0.5); }}
                            className="text-muted-foreground hover:text-primary transition-colors"
                        >
                            {volume === 0
                                ? <PixelIcon icon={VolumeMutePixel} size="md" />
                                : volume < 0.5
                                    ? <PixelIcon icon={Volume1} size="md" />
                                    : <PixelIcon icon={Volume3} size="md" />}
                        </button>
                        <input
                            type="range" min="0" max="1" step="0.01" value={volume}
                            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                            className="w-full sm:w-36"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="pixel-box !p-2 flex items-center gap-2">
                            <span className="font-display text-[7px] text-primary">A</span>
                            <span className="text-xs text-muted-foreground">Play</span>
                        </div>
                        <div className="pixel-box !p-2 flex items-center gap-2">
                            <span className="font-display text-[7px] text-primary">L/R</span>
                            <span className="text-xs text-muted-foreground">±5s</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlayerControls;
