import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import useRetroSfx from "@/hooks/useRetroSfx";
import idolSpotify from "@/assets/idol-spotify.png";
import idolYoutube from "@/assets/idol-youtube.png";
import idolSoundcloud from "@/assets/idol-soundcloud.png";
import idolFilea from "@/assets/idol-Filea.gif";
import idolMixy from "@/assets/idol-mixy.png";
import idolMixyVideo from "@/assets/idol-mixy-body.mp4";

export type PlatformId = "spotify" | "youtube" | "soundcloud" | "filea" | "mixy";

interface CharacterSelectScreenProps {
    onSelect: (platform: PlatformId) => void;
    onBack: () => void;
    initialPlatform?: PlatformId;
    onPreviewChange?: (platform: PlatformId) => void;
}

interface CharacterOption {
    id: PlatformId;
    name: string;
    platform: string;
    desc: string;
    sprite: string;
    video?: string;
    overpowered?: boolean;
    powerLevel: 4 | 5;
    colors: { primary: string; secondary: string; accent: string };
}

const characters: CharacterOption[] = [
    {
        id: "spotify",
        name: "SPOTY",
        platform: "SPOTIFY",
        desc: "La idol del streaming.",
        sprite: idolSpotify,
        powerLevel: 4,
        colors: { primary: "140 70% 45%", secondary: "140 60% 25%", accent: "0 0% 8%" },
    },
    {
        id: "youtube",
        name: "TUBY",
        platform: "YOUTUBE",
        desc: "La estrella del video.",
        sprite: idolYoutube,
        powerLevel: 4,
        colors: { primary: "0 80% 55%", secondary: "0 70% 40%", accent: "0 0% 95%" },
    },
    {
        id: "soundcloud",
        name: "CLOUDY",
        platform: "SOUNDCLOUD",
        desc: "La reina del beat.",
        sprite: idolSoundcloud,
        powerLevel: 4,
        colors: { primary: "25 95% 55%", secondary: "25 80% 40%", accent: "0 0% 95%" },
    },
    {
        id: "filea",
        name: "FILEA",
        platform: "LOCAL FILES",
        desc: "Tu idol pixel para pistas locales.",
        sprite: idolFilea,
        overpowered: true,
        powerLevel: 5,
        colors: { primary: "0 0% 96%", secondary: "0 0% 66%", accent: "0 0% 12%" },
    },
    {
        id: "mixy",
        name: "MIXY",
        platform: "MIX HUB",
        desc: "La DJ que une todos tus mundos musicales.",
        sprite: idolMixy,
        video: idolMixyVideo,
        powerLevel: 5,
        colors: { primary: "326 88% 62%", secondary: "190 92% 48%", accent: "240 30% 7%" },
    },
];

const IdolSprite = ({
    sprite,
    video,
    alt,
    frame,
    selected,
    primaryColor,
    overpowered = false,
}: {
    sprite: string;
    video?: string;
    alt: string;
    frame: number;
    selected: boolean;
    primaryColor: string;
    overpowered?: boolean;
}) => {
    const bounceY = selected ? Math.sin(frame * 0.5) * 5 : 0;
    const breathScale = 1 + Math.sin(frame * 0.3) * 0.02;
    const sway = selected ? Math.sin(frame * 0.25) * 2 : Math.sin(frame * 0.15) * 0.8;
    const powerPulse = (Math.sin(frame * 0.42) + 1) / 2;
    const powerShakeX = selected && overpowered ? Math.sin(frame * 1.15) * 0.9 : 0;
    const powerScale = selected && overpowered ? 1 + Math.sin(frame * 0.3) * 0.03 : 1;
    const shadowScale = selected ? 0.7 + Math.sin(frame * 0.5) * 0.1 : 0.7;
    const shadowOpacity = selected ? 0.5 - Math.sin(frame * 0.5) * 0.15 : 0.35;

    return (
        <div
            className="relative"
            style={{
                transform: `translate(${powerShakeX}px, ${bounceY}px) scale(${powerScale})`,
                transition: "transform 0.1s ease-out",
            }}
        >
            {video ? (
                <video
                    src={video}
                    poster={sprite}
                    aria-label={alt}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    className="w-24 h-24 sm:w-32 sm:h-32 object-contain"
                    style={{
                        imageRendering: "pixelated",
                        filter: selected
                            ? `drop-shadow(0 0 8px hsl(${primaryColor} / 0.6)) drop-shadow(0 4px 6px hsl(0 0% 0% / 0.4))`
                            : "drop-shadow(0 2px 4px hsl(0 0% 0% / 0.3))",
                        transition: "filter 0.3s ease",
                    }}
                />
            ) : (
                <img
                    src={sprite}
                    alt={alt}
                    className="w-24 h-24 sm:w-32 sm:h-32 object-contain"
                    style={{
                        imageRendering: "pixelated",
                        transform: `scaleY(${breathScale}) rotate(${sway}deg)`,
                        filter: selected
                            ? overpowered
                                ? `drop-shadow(0 0 ${8 + powerPulse * 8}px hsl(0 0% 100% / 0.85)) drop-shadow(0 0 ${16 + powerPulse * 10}px hsl(190 100% 80% / 0.55)) drop-shadow(0 4px 6px hsl(0 0% 0% / 0.45))`
                                : `drop-shadow(0 0 8px hsl(${primaryColor} / 0.6)) drop-shadow(0 4px 6px hsl(0 0% 0% / 0.4))`
                            : "drop-shadow(0 2px 4px hsl(0 0% 0% / 0.3))",
                        transition: "filter 0.3s ease",
                    }}
                />
            )}
            {selected && (
                <div
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{
                        border: `2px solid hsl(${primaryColor} / ${0.3 + Math.sin(frame * 0.4) * 0.2})`,
                        transform: `scale(${1.1 + Math.sin(frame * 0.3) * 0.05})`,
                        borderRadius: "50%",
                    }}
                />
            )}
            {selected && overpowered && (
                <div
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{
                        border: `2px solid hsl(0 0% 100% / ${0.35 + powerPulse * 0.35})`,
                        transform: `scale(${1.23 + Math.sin(frame * 0.24) * 0.08})`,
                        borderRadius: "50%",
                        boxShadow: `0 0 ${8 + powerPulse * 10}px hsl(0 0% 100% / 0.65)`,
                    }}
                />
            )}
            {selected &&
                (overpowered ? [0, 1, 2, 3, 4, 5] : [0, 1, 2]).map((i) => {
                    const angle = (frame * 0.2 + i * 2.1) % (Math.PI * 2);
                    const radius = (overpowered ? 58 : 50) + Math.sin(frame * 0.15 + i) * (overpowered ? 14 : 10);
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius * 0.5 - 20;
                    const sparkleOpacity = (Math.sin(frame * 0.5 + i * 1.5) + 1) / 2;
                    return (
                        <div
                            key={i}
                            className="absolute pointer-events-none"
                            style={{
                                left: `calc(50% + ${x}px)`,
                                top: `calc(50% + ${y}px)`,
                                width: overpowered ? 5 : 4,
                                height: overpowered ? 5 : 4,
                                background: overpowered ? "hsl(0 0% 100%)" : `hsl(${primaryColor})`,
                                opacity: sparkleOpacity * (overpowered ? 1 : 0.8),
                                boxShadow: overpowered
                                    ? "0 0 8px hsl(0 0% 100% / 0.9), 0 0 12px hsl(190 100% 80% / 0.6)"
                                    : `0 0 4px hsl(${primaryColor} / 0.6)`,
                            }}
                        />
                    );
                })}
            <div
                className="absolute rounded-full"
                style={{
                    bottom: -8,
                    left: `${(1 - shadowScale) * 50}%`,
                    width: `${shadowScale * 100}%`,
                    height: 6,
                    background: overpowered
                        ? `hsl(0 0% 100% / ${0.08 + powerPulse * 0.2})`
                        : `hsl(0 0% 0% / ${shadowOpacity})`,
                    filter: "blur(3px)",
                }}
            />
        </div>
    );
};

const CharacterSelectScreen = ({ onSelect, onBack, initialPlatform = "spotify", onPreviewChange }: CharacterSelectScreenProps) => {
    const initialIndex = Math.max(
        0,
        characters.findIndex((character) => character.id === initialPlatform)
    );
    const [selected, setSelected] = useState(initialIndex);
    const [frame, setFrame] = useState(0);
    const [confirmed, setConfirmed] = useState(false);
    const sfx = useRetroSfx();
    const cardsRef = useRef<HTMLDivElement>(null);
    const confirmBtnRef = useRef<HTMLButtonElement>(null);

    const playSelectionSfx = useCallback(
        (platform: PlatformId) => {
            sfx(platform === "filea" || platform === "mixy" ? "ultimate" : "select");
        },
        [sfx]
    );

    useLayoutEffect(() => {
        if (!cardsRef.current) return;
        const cards = Array.from(cardsRef.current.children) as HTMLElement[];

        // Set initial state explicitly, then tween to natural state
        gsap.set(cards, { opacity: 0, y: 24 });
        const tween = gsap.to(cards, {
            opacity: 1,
            y: 0,
            duration: 0.35,
            stagger: 0.08,
            ease: "back.out(1.4)",
            onComplete() {
                // Clear inline styles so CSS classes (e.g. opacity-70 for unselected) take over
                gsap.set(cards, { clearProps: "opacity,y,transform" });
            },
        });

        return () => { tween.kill(); gsap.set(cards, { clearProps: "opacity,y,transform" }); };
    }, []);

    useEffect(() => {
        const nextIndex = Math.max(
            0,
            characters.findIndex((character) => character.id === initialPlatform)
        );
        setSelected(nextIndex);
        setConfirmed(false);
    }, [initialPlatform]);

    const handleConfirm = useCallback(() => {
        if (confirmed) return;
        setConfirmed(true);
        sfx("powerup");
        const selectedCharacter = characters[selected];
        if (confirmBtnRef.current) {
            gsap.timeline()
                .to(confirmBtnRef.current, { scale: 1.15, duration: 0.1, ease: "power2.out" })
                .to(confirmBtnRef.current, { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.4)" });
        }
        setTimeout(() => onSelect(selectedCharacter.id), 800);
    }, [confirmed, onSelect, selected, sfx]);

    useEffect(() => {
        const interval = setInterval(() => setFrame((value) => value + 1), 80);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            if (confirmed) return;

            if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
                event.preventDefault();
                setSelected((value) => {
                    const next = Math.max(0, value - 1);
                    if (next !== value) {
                        playSelectionSfx(characters[next].id);
                        onPreviewChange?.(characters[next].id);
                    }
                    return next;
                });
            }

            if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
                event.preventDefault();
                setSelected((value) => {
                    const next = Math.min(characters.length - 1, value + 1);
                    if (next !== value) {
                        playSelectionSfx(characters[next].id);
                        onPreviewChange?.(characters[next].id);
                    }
                    return next;
                });
            }

            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleConfirm();
            }

            if (event.key === "Escape") {
                event.preventDefault();
                sfx("cancel");
                onBack();
            }
        };

        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [confirmed, handleConfirm, onBack, onPreviewChange, playSelectionSfx, sfx]);

    const selectedCharacter = characters[selected];

    return (
        <div className="flex flex-col items-center py-8 px-4">
            <h2 className="font-display text-xs sm:text-sm text-primary mb-2 animate-pulse-glow" style={{ textShadow: "3px 3px 0 hsl(240 30% 4%)" }}>
                SELECT YOUR PLAYER
            </h2>
            <p className="text-muted-foreground text-sm mb-8">LEFT/RIGHT TO CHOOSE PLATFORM</p>

            <div ref={cardsRef} className="flex items-end gap-4 sm:gap-8 mb-8 flex-wrap justify-center">
                {characters.map((character, index) => {
                    const isSelected = index === selected;
                    return (
                        <button
                            key={character.id}
                            onClick={() => {
                                if (index !== selected) playSelectionSfx(characters[index].id);
                                setSelected(index);
                                onPreviewChange?.(characters[index].id);
                            }}
                            onDoubleClick={handleConfirm}
                            className={`
                                flex flex-col items-center p-4 sm:p-6 pixel-box cursor-pointer transition-all duration-100
                                ${isSelected ? "scale-105" : "opacity-70 scale-95"}
                                ${confirmed && isSelected ? "animate-pulse-glow" : ""}
                            `}
                            style={
                                isSelected
                                    ? {
                                          borderColor: "hsl(45 60% 45%)",
                                          boxShadow: character.overpowered
                                              ? "0 0 24px hsl(0 0% 100% / 0.55), 0 0 32px hsl(190 100% 80% / 0.3), 6px 6px 0 hsl(240 30% 4%)"
                                              : "0 0 20px hsl(45 100% 55% / 0.35), 6px 6px 0 hsl(240 30% 4%)",
                                      }
                                    : {
                                          borderColor: `hsl(${character.colors.primary})`,
                                          boxShadow: `0 0 10px hsl(${character.colors.primary} / 0.22), 6px 6px 0 hsl(240 30% 4%)`,
                                      }
                            }
                        >
                            {isSelected && (
                                <span
                                    className="font-display text-xs mb-2"
                                    style={{ color: `hsl(${character.colors.primary})`, animation: "retro-bounce 0.5s step-end infinite" }}
                                >
                                    v
                                </span>
                            )}
                            <div className="mb-4" style={{ minHeight: 128 }}>
                                <IdolSprite
                                    sprite={character.sprite}
                                    video={character.video}
                                    alt={`${character.name}, ${character.platform}`}
                                    frame={isSelected ? frame : 0}
                                    selected={isSelected}
                                    primaryColor={character.colors.primary}
                                    overpowered={character.overpowered}
                                />
                            </div>
                            <div
                                className="px-3 py-1 font-display text-[7px] sm:text-[8px] tracking-wider"
                                style={{
                                    background: `hsl(${character.colors.primary})`,
                                    color: `hsl(${character.colors.accent})`,
                                    boxShadow: "2px 2px 0 hsl(240 30% 4%)",
                                }}
                            >
                                {character.name}
                            </div>
                            {character.overpowered && (
                                <span className="mt-2 font-display text-[7px] text-primary animate-pulse-glow">
                                    OVERPOWERED
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="pixel-box p-4 sm:p-6 max-w-md w-full text-center mb-6">
                <h3 className="font-display text-[9px] sm:text-[10px] mb-2" style={{ color: `hsl(${selectedCharacter.colors.primary})` }}>
                    {selectedCharacter.name} - {selectedCharacter.platform}
                </h3>
                <p className="text-foreground text-sm">{selectedCharacter.desc}</p>
                <div className="flex justify-center gap-2 mt-3">
                    {[0, 1, 2, 3, 4].map((index) => (
                        <div
                            key={index}
                            className="w-3 h-3"
                            style={{
                                background:
                                    index < selectedCharacter.powerLevel ? `hsl(${selectedCharacter.colors.primary})` : "hsl(var(--muted))",
                                border: "1px solid hsl(240 30% 4%)",
                            }}
                        />
                    ))}
                    <span className="font-display text-[7px] text-muted-foreground ml-2">
                        {selectedCharacter.overpowered ? "OVERPOWERED" : "POWER"}
                    </span>
                </div>
            </div>

            <div className="flex gap-4">
                <button
                    onClick={() => {
                        sfx("cancel");
                        onBack();
                    }}
                    className="retro-btn-secondary text-[8px]"
                >
                    BACK
                </button>
                <button
                    ref={confirmBtnRef}
                    onClick={handleConfirm}
                    className="retro-btn text-[8px]"
                    style={{
                        background: `hsl(${selectedCharacter.colors.primary})`,
                        borderColor: `hsl(${selectedCharacter.colors.primary})`,
                    }}
                >
                    CONFIRM
                </button>
            </div>

            <p className="mt-6 font-display text-[7px] text-muted-foreground">A: CONFIRM  B: BACK  LEFT/RIGHT: MOVE</p>
        </div>
    );
};

export default CharacterSelectScreen;
