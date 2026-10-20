import type { ReactiveBackgroundVariant } from "@/components/ReactiveBackground";
import useRetroSfx from "@/hooks/useRetroSfx";
import { BACKGROUND_VARIANT_OPTIONS } from "@/lib/platformTheme";

interface BackgroundVariantSelectorProps {
    value: ReactiveBackgroundVariant;
    onChange: (variant: ReactiveBackgroundVariant) => void;
}

const BackgroundVariantSelector = ({ value, onChange }: BackgroundVariantSelectorProps) => {
    const sfx = useRetroSfx();

    return (
        <div className="mt-4 flex items-center justify-center gap-2">
            <span className="font-display text-[7px] text-muted-foreground">BG FX</span>
            {BACKGROUND_VARIANT_OPTIONS.map((option) => (
                <button
                    key={option.id}
                    onClick={() => {
                        sfx("select");
                        onChange(option.id);
                    }}
                    className={`retro-btn-secondary !text-[7px] !px-2 !py-1 ${
                        value === option.id ? "!border-primary !text-primary !bg-secondary" : ""
                    }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
};

export default BackgroundVariantSelector;
