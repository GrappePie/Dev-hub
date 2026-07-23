import type { PlatformId } from "@/components/CharacterSelectScreen";
import mixyVideo from "@/assets/idol-mixy-body.mp4";
import mixyPoster from "@/assets/idol-mixy.png";

type MixySource = Exclude<PlatformId, "mixy">;

interface MixyScreenProps {
    onChoosePlatform: (platform: MixySource) => void;
}

const sources: Array<{ id: MixySource; label: string; detail: string; color: string }> = [
    { id: "spotify", label: "SPOTY", detail: "Spotify", color: "140 70% 45%" },
    { id: "youtube", label: "TUBY", detail: "YouTube Music", color: "0 80% 55%" },
    { id: "soundcloud", label: "CLOUDY", detail: "SoundCloud", color: "25 95% 55%" },
    { id: "filea", label: "FILEA", detail: "Archivos locales", color: "0 0% 92%" },
];

const MixyScreen = ({ onChoosePlatform }: MixyScreenProps) => (
    <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-4 py-6 sm:py-10" aria-labelledby="mixy-title">
        <div className="pixel-box relative grid w-full overflow-hidden p-5 sm:grid-cols-[minmax(220px,0.8fr)_minmax(280px,1.2fr)] sm:p-8">
            <div
                className="pointer-events-none absolute inset-0 opacity-25"
                style={{
                    background:
                        "radial-gradient(circle at 22% 45%, hsl(326 88% 62% / 0.55), transparent 34%), radial-gradient(circle at 82% 35%, hsl(190 92% 48% / 0.45), transparent 32%)",
                }}
            />

            <div className="relative flex items-center justify-center">
                <video
                    src={mixyVideo}
                    poster={mixyPoster}
                    aria-label="Mixy bailando en su escenario arcade"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    className="aspect-square w-full max-w-[320px] object-contain"
                    style={{ imageRendering: "pixelated", filter: "drop-shadow(0 0 18px hsl(326 88% 62% / 0.45))" }}
                />
            </div>

            <div className="relative flex flex-col justify-center py-4 text-center sm:pl-8 sm:text-left">
                <p className="font-display text-[7px] tracking-[0.3em] text-primary">PLAYER 05 // MIX CORE ONLINE</p>
                <h2 id="mixy-title" className="mt-3 font-display text-xl text-foreground sm:text-3xl">
                    MIXY
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                    Tu DJ central para saltar entre todos los mundos musicales de Dev Hub sin perder el estilo arcade.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3" aria-label="Fuentes musicales de Mixy">
                    {sources.map((source) => (
                        <button
                            key={source.id}
                            type="button"
                            onClick={() => onChoosePlatform(source.id)}
                            className="pixel-box group p-3 text-left transition-transform hover:-translate-y-1 focus-visible:-translate-y-1"
                            style={{ borderColor: `hsl(${source.color})` }}
                        >
                            <span className="block font-display text-[8px]" style={{ color: `hsl(${source.color})` }}>
                                {source.label}
                            </span>
                            <span className="mt-1 block text-xs text-muted-foreground">{source.detail}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>

        <p className="font-display text-[7px] text-muted-foreground">SELECT A SOURCE // MIXY KEEPS THE PARTY TOGETHER</p>
    </section>
);

export default MixyScreen;
