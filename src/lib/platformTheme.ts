import type { PlatformId } from "@/components/CharacterSelectScreen";
import type { ReactiveBackgroundVariant } from "@/components/ReactiveBackground";

export const PLATFORM_STORAGE_KEY = "mh_selected_platform";
export const BACKGROUND_VARIANT_STORAGE_KEY = "mh_background_variant";

export const isPlatformId = (value: string): value is PlatformId =>
    value === "spotify" || value === "youtube" || value === "soundcloud" || value === "filea";

export const getStoredPlatform = (): PlatformId => {
    const raw = localStorage.getItem(PLATFORM_STORAGE_KEY);
    if (raw && isPlatformId(raw)) return raw;
    return "spotify";
};

export const isBackgroundVariant = (value: string): value is ReactiveBackgroundVariant =>
    value === "arcadeGrid" || value === "starfieldShooter" || value === "pixelCritters";

export const getStoredBackgroundVariant = (): ReactiveBackgroundVariant => {
    const raw = localStorage.getItem(BACKGROUND_VARIANT_STORAGE_KEY);
    if (raw && isBackgroundVariant(raw)) return raw;
    return "starfieldShooter";
};

export const PLATFORM_THEME: Record<PlatformId, Record<string, string>> = {
    spotify: {
        primary: "140 70% 45%",
        "primary-foreground": "0 0% 8%",
        border: "140 55% 40%",
        ring: "140 70% 45%",
        accent: "140 60% 35%",
        "accent-foreground": "140 70% 90%",
        "primary-bright": "140 80% 62%",
        "primary-dark": "140 58% 28%",
    },
    youtube: {
        primary: "0 80% 55%",
        "primary-foreground": "0 0% 98%",
        border: "0 65% 45%",
        ring: "0 80% 55%",
        accent: "0 70% 42%",
        "accent-foreground": "0 0% 97%",
        "primary-bright": "0 90% 72%",
        "primary-dark": "0 70% 35%",
    },
    soundcloud: {
        primary: "25 95% 55%",
        "primary-foreground": "0 0% 10%",
        border: "25 80% 45%",
        ring: "25 95% 55%",
        accent: "25 85% 45%",
        "accent-foreground": "0 0% 96%",
        "primary-bright": "25 100% 72%",
        "primary-dark": "25 78% 34%",
    },
    filea: {
        primary: "0 0% 96%",
        "primary-foreground": "0 0% 10%",
        border: "0 0% 72%",
        ring: "0 0% 96%",
        accent: "0 0% 36%",
        "accent-foreground": "0 0% 96%",
        "primary-bright": "0 0% 100%",
        "primary-dark": "0 0% 56%",
    },
};

export const DEFAULT_THEME: Record<string, string> = {
    primary: "45 100% 55%",
    "primary-foreground": "240 30% 8%",
    border: "45 60% 45%",
    ring: "45 100% 55%",
    accent: "140 60% 40%",
    "accent-foreground": "140 60% 85%",
    "primary-bright": "45 100% 75%",
    "primary-dark": "45 80% 35%",
};

export const PLATFORM_MESSAGE: Record<PlatformId, string> = {
    spotify: "", // driven by spotify.statusText
    youtube: "Modo YouTube listo. Busca canciones y reproduce al instante.",
    soundcloud: "Modo SoundCloud listo. Conecta tu cuenta para ver tus playlists.",
    filea: "Filea ya esta en casa. Modo local en construccion.",
};
