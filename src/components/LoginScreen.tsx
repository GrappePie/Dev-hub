import { useState, useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import useRetroSfx from "@/hooks/useRetroSfx";
import { Music } from "pixelarticons/react/Music";
import { Zap } from "pixelarticons/react/Zap";
import { Monitor } from "pixelarticons/react/Monitor";
import { AppWindows } from "pixelarticons/react/AppWindows";
import { PictureInPicture } from "pixelarticons/react/PictureInPicture";
import PixelIcon, { type PixelIconComponent } from "@/components/PixelIcon";

interface LoginScreenProps {
    onLogin: () => void;
    message?: string;
    isLoading?: boolean;
}

const LoginScreen = ({ onLogin, message, isLoading = false }: LoginScreenProps) => {
    const [showCursor, setShowCursor] = useState(true);
    const [textIndex, setTextIndex] = useState(0);
    const fullText = message || "Conecta tu cuenta de Spotify Premium para comenzar la aventura musical...";
    const sfx = useRetroSfx();

    const heroRef = useRef<HTMLDivElement>(null);
    const titleRef = useRef<HTMLHeadingElement>(null);
    const textBoxRef = useRef<HTMLDivElement>(null);
    const btnRef = useRef<HTMLButtonElement>(null);
    const cardsRef = useRef<HTMLDivElement>(null);
    const footerRef = useRef<HTMLParagraphElement>(null);

    useLayoutEffect(() => {
        const elems = [
            heroRef.current,
            titleRef.current,
            textBoxRef.current,
            btnRef.current,
            footerRef.current,
        ].filter(Boolean) as HTMLElement[];
        const cards = cardsRef.current ? Array.from(cardsRef.current.children) as HTMLElement[] : [];

        // Start all elements hidden
        gsap.set(elems, { opacity: 0 });
        gsap.set(heroRef.current, { scale: 0.5 });
        gsap.set([titleRef.current, textBoxRef.current, footerRef.current], { y: 10 });
        gsap.set(btnRef.current, { scale: 0.85 });
        gsap.set(cards, { opacity: 0, y: 18 });

        const tl = gsap.timeline({
            defaults: { ease: "power2.out" },
            onComplete() {
                gsap.set([...elems, ...cards], { clearProps: "opacity,scale,y,transform" });
            },
        });

        tl.to(heroRef.current, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(1.7)" })
            .to(titleRef.current, { opacity: 1, y: 0, duration: 0.25 }, "-=0.1")
            .to(textBoxRef.current, { opacity: 1, y: 0, duration: 0.25 }, "-=0.05")
            .to(btnRef.current, { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(1.7)" }, "-=0.05")
            .to(cards, { opacity: 1, y: 0, duration: 0.25, stagger: 0.1 }, "-=0.1")
            .to(footerRef.current, { opacity: 1, duration: 0.2 }, "-=0.05");

        return () => {
            tl.kill();
            gsap.set([...elems, ...cards], { clearProps: "opacity,scale,y,transform" });
        };
    }, []);

    useEffect(() => {
        const blinkInterval = setInterval(() => setShowCursor(c => !c), 500);
        return () => clearInterval(blinkInterval);
    }, []);

    useEffect(() => {
        if (textIndex < fullText.length) {
            const timer = setTimeout(() => {
                setTextIndex(i => i + 1);
                sfx("text");
            }, 35);
            return () => clearTimeout(timer);
        }
    }, [textIndex]);

    return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            {/* Pixel art music note */}
            <div ref={heroRef} className="mb-8 relative">
                <div className="w-20 h-20 bg-primary border-4 border-foreground flex items-center justify-center"
                     style={{ boxShadow: '6px 6px 0 hsl(240 30% 4%)' }}>
                    <PixelIcon icon={Music} size="xl" className="text-primary-foreground" />
                </div>
                <PixelIcon icon={Zap} size="sm" className="absolute -top-2 -right-3 text-primary animate-pulse-glow" />
                <PixelIcon icon={Zap} size="sm" className="absolute -bottom-1 -left-3 text-accent animate-pulse-glow [animation-delay:500ms]" />
            </div>

            <h2 ref={titleRef} className="font-display text-sm sm:text-base text-primary mb-6 leading-relaxed"
                style={{ textShadow: '3px 3px 0 hsl(240 30% 4%)' }}>
                DEV HUB PLAYER
            </h2>

            <div ref={textBoxRef} className="pixel-box p-6 max-w-lg w-full mb-8">
                <p className="text-left text-foreground leading-relaxed min-h-[3em]">
                    {fullText.slice(0, textIndex)}
                    <span className={`${showCursor ? 'opacity-100' : 'opacity-0'} text-primary`}>▌</span>
                </p>
            </div>

            <button
                ref={btnRef}
                onClick={() => { sfx("powerup"); onLogin(); }}
                className="retro-btn text-xs disabled:opacity-70 disabled:cursor-not-allowed"
                disabled={isLoading}
            >
                {isLoading ? "CARGANDO..." : "► PRESS START ◄"}
            </button>

            <div ref={cardsRef} className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full">
                {[
                    { icon: Monitor, title: "WEB PLAYER", desc: "Reproduce en tu navegador" },
                    { icon: AppWindows, title: "PWA APP", desc: "Instala como app nativa" },
                    { icon: PictureInPicture, title: "PiP MODE", desc: "Controles flotantes" },
                ].map((item: { icon: PixelIconComponent; title: string; desc: string }) => (
                    <div key={item.title} className="pixel-box p-4 text-center cursor-pointer" onClick={() => sfx("select")}>
                        <PixelIcon icon={item.icon} size="lg" className="mx-auto mb-2 text-primary" />
                        <h4 className="font-display text-[8px] text-primary mb-2">{item.title}</h4>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                ))}
            </div>

            <p ref={footerRef} className="mt-8 font-display text-[8px] text-muted-foreground animate-pulse-glow">
                INSERT COIN TO CONTINUE
            </p>
        </div>
    );
};

export default LoginScreen;
