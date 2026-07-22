import { useRef, useCallback, useEffect, useState } from "react";
import ScrollingText from "@/components/ScrollingText";
import Visualizer from "./Visualizer";
import useRetroSfx from "@/hooks/useRetroSfx";
import { Heart } from "pixelarticons/react/Heart";
import { Link } from "pixelarticons/react/Link";
import { Video } from "pixelarticons/react/Video";
import { Image } from "pixelarticons/react/Image";
import { Expand } from "pixelarticons/react/Expand";
import { PictureInPicture } from "pixelarticons/react/PictureInPicture";
import PixelIcon from "@/components/PixelIcon";
import { createPortal } from "react-dom";
import type { MutableRefObject } from "react";

interface AlbumArtDisplayProps {
    albumArt: string;
    title: string;
    artist: string;
    artistNames?: string[];
    isPlaying: boolean;
    isLiked: boolean;
    onLikeToggle: () => void;
    onShare: () => void;
    onArtistClick?: (name: string) => void;
    analyser?: AnalyserNode | null;
    onRequestCapture?: () => void;
    playerHostRef?: (node: HTMLDivElement | null) => void;
    showVideo?: boolean;
    pipMode?: boolean;
    onToggleVideoMode?: () => void;
    onTogglePipMode?: () => void;
    bpm?: number | null;
    bpmConfidence?: number;
    beatSignal?: MutableRefObject<number>;
}

const AlbumArtDisplay = ({
                             albumArt,
                             title,
                             artist,
                             artistNames = [],
                             isPlaying,
                             isLiked,
                             onLikeToggle,
                             onShare,
                             onArtistClick,
                             analyser,
                             onRequestCapture,
                             playerHostRef,
                             showVideo = false,
                             pipMode = false,
                             onToggleVideoMode,
                             onTogglePipMode,
                             bpm,
                             bpmConfidence,
                             beatSignal,
                         }: AlbumArtDisplayProps) => {
    const sfx = useRetroSfx();
    const names = artistNames.length ? artistNames : [artist];
    const videoContainerRef = useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener("fullscreenchange", onFsChange);
        return () => document.removeEventListener("fullscreenchange", onFsChange);
    }, []);

    const handleFullscreen = useCallback(async () => {
        try {
            if (!document.fullscreenElement) {
                await videoContainerRef.current?.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch {
            // fullscreen not supported
        }
    }, []);

    const imgSize = "w-52 h-52 sm:w-60 sm:h-60 xl:w-68 xl:h-68";

    // PiP controls toolbar rendered via portal (buttons only — video stays in normal DOM)
    const pipControlsPortal = showVideo && pipMode && playerHostRef
        ? createPortal(
            <div style={{
                position: "fixed",
                bottom: "calc(1.5rem + 208px + 4px)",
                right: "1.5rem",
                zIndex: 10000,
                display: "flex",
                gap: 4,
                background: "hsl(var(--secondary))",
                border: "2px solid hsl(var(--border))",
                padding: "3px 5px",
                boxShadow: "4px 4px 0 hsl(240 30% 4%)",
            }}>
                <button className="retro-btn-secondary !p-1" title="Expandir" onClick={onTogglePipMode}>
                    <PixelIcon icon={Expand} size="sm" />
                </button>
                <button className="retro-btn-secondary !p-1" title="Regresar a imagen" onClick={onToggleVideoMode}>
                    <PixelIcon icon={Image} size="sm" />
                </button>
            </div>,
            document.body
        )
        : null;

    return (
        <div className="pixel-box-elevated p-5 flex flex-col items-center gap-5 relative scanlines">
            <div className="relative">
                {/* Album art — hidden when video is inline (not pip) */}
                <img
                    src={albumArt}
                    alt={title}
                    className={`${imgSize} object-cover border-4 border-border ${showVideo && !pipMode ? "invisible" : ""}`}
                    style={{ boxShadow: '4px 4px 0 hsl(240 30% 4%)', imageRendering: 'auto' }}
                />

                {/*
                    Video container — always mounted and at least 200 x 200.
                    Never conditionally unmounted to prevent player destruction on mode change.
                    CSS position/visibility changes based on mode:
                    - image mode: a visible 200 x 200 panel below the cover
                    - inline mode: absolute covering the image
                    - PiP mode: fixed at viewport bottom-right
                */}
                {playerHostRef && (
                    <div
                        ref={!pipMode ? videoContainerRef : undefined}
                        style={
                            !showVideo
                                ? { position: "relative", width: 208, height: 208, margin: "12px auto 0", background: "black", border: "4px solid hsl(var(--border))", boxShadow: "4px 4px 0 hsl(240 30% 4%)", overflow: "hidden" }
                                : pipMode
                                ? { position: "fixed", bottom: "1.5rem", right: "1.5rem", width: 356, height: 208, zIndex: 9999, background: "black", border: "4px solid hsl(var(--border))", boxShadow: "4px 4px 0 hsl(240 30% 4%)", overflow: "hidden" }
                                : { position: "absolute", inset: 0, border: "4px solid hsl(var(--border))", boxShadow: "4px 4px 0 hsl(240 30% 4%)", overflow: "hidden" }
                        }
                    >
                        <div ref={playerHostRef} className="yt-video-container w-full h-full" />

                    </div>
                )}

                {/* Playing indicator — only in image mode */}
                {isPlaying && !showVideo && (
                    <div className="absolute top-2 right-2 w-3 h-3 bg-accent border border-foreground animate-pulse-glow" />
                )}

            </div>

            {playerHostRef && !showVideo && onToggleVideoMode && (
                <button
                    onClick={() => { sfx("select"); onToggleVideoMode(); }}
                    title="Alternar video y portada"
                    className="retro-btn-secondary !p-1.5 flex items-center gap-1"
                >
                    <PixelIcon icon={Video} size="sm" />
                    <span className="font-display text-[7px]">MOSTRAR VIDEO</span>
                </button>
            )}

            {/* Keep custom controls outside the YouTube viewport so they never obscure it. */}
            {playerHostRef && showVideo && !pipMode && (
                <div className="flex items-center justify-center gap-2">
                    <button
                        className="retro-btn-secondary !p-1.5"
                        title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                        onClick={() => void handleFullscreen()}
                    >
                        <PixelIcon icon={Expand} size="sm" />
                    </button>
                    <button className="retro-btn-secondary !p-1.5" title="Mini reproductor" onClick={onTogglePipMode}>
                        <PixelIcon icon={PictureInPicture} size="sm" />
                    </button>
                    <button className="retro-btn-secondary !p-1.5" title="Mostrar portada" onClick={onToggleVideoMode}>
                        <PixelIcon icon={Image} size="sm" />
                    </button>
                </div>
            )}

            {/* PiP placeholder — shown in the image slot when video is floating */}
            {playerHostRef && showVideo && pipMode && (
                <div
                    style={{ boxShadow: '4px 4px 0 hsl(240 30% 4%)' }}
                    className={`${imgSize} border-4 border-border flex items-center justify-center bg-card`}
                >
                    <span className="font-display text-[7px] text-muted-foreground text-center px-2">VIDEO<br/>FLOTANTE</span>
                </div>
            )}

            {pipControlsPortal}

            <div className="w-full pixel-box p-4">
                <ScrollingText
                    text={title}
                    className="font-display text-[10px] text-primary mb-1 w-full"
                    style={{ textShadow: '2px 2px 0 hsl(240 30% 4%)' }}
                />

                <div className="flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
                    {names.map((name, i) => (
                        <span key={name} className="flex items-center gap-x-1">
                            {onArtistClick ? (
                                <button
                                    onClick={() => { sfx("select"); onArtistClick(name); }}
                                    className="hover:text-primary transition-colors"
                                    title="Ver perfil del artista"
                                >
                                    {name}
                                </button>
                            ) : (
                                <span>{name}</span>
                            )}
                            {i < names.length - 1 && <span className="text-muted-foreground/50">·</span>}
                        </span>
                    ))}
                </div>

                <div className="mt-3 flex items-center gap-3">
                    <button
                        onClick={() => { sfx(isLiked ? "cancel" : "coin"); onLikeToggle(); }}
                        className={`retro-btn-secondary !p-2 ${isLiked ? '!bg-destructive !text-destructive-foreground !border-destructive' : ''}`}
                    >
                        <PixelIcon icon={Heart} size="sm" className={isLiked ? "text-destructive-foreground" : ""} />
                    </button>
                    <button onClick={() => { sfx("confirm"); onShare(); }} className="retro-btn-secondary !p-2">
                        <PixelIcon icon={Link} size="sm" />
                    </button>
                    <span className="ml-auto font-display text-[8px] text-muted-foreground">
                        {isPlaying ? "NOW PLAYING" : "PAUSED"}
                    </span>
                </div>
            </div>

            <Visualizer isPlaying={isPlaying} analyser={analyser} onRequestCapture={onRequestCapture} bpm={bpm} bpmConfidence={bpmConfidence} beatSignal={beatSignal} />
        </div>
    );
};

export default AlbumArtDisplay;
