import { useEffect, useRef } from "react";
import gsap from "gsap";
import type { PlatformId } from "@/components/CharacterSelectScreen";
import type { ReactiveBackgroundVariant } from "@/components/ReactiveBackground";
import {
    PLATFORM_THEME,
    DEFAULT_THEME,
    PLATFORM_STORAGE_KEY,
    BACKGROUND_VARIANT_STORAGE_KEY,
} from "@/lib/platformTheme";

interface UsePlatformThemeParams {
    selectedPlatform: PlatformId;
    isSessionActive: boolean;
    isCharacterVisible: boolean;
    isAuthRedirecting: boolean;
    showOAuthBridge: boolean;
    previewPlatform: PlatformId | null;
    backgroundVariant: ReactiveBackgroundVariant;
}

/** Parse "H S% L%" → { h, s, l } numbers */
function parseHsl(value: string): { h: number; s: number; l: number } | null {
    const parts = value.trim().split(/\s+/);
    if (parts.length < 3) return null;
    return { h: parseFloat(parts[0]), s: parseFloat(parts[1]), l: parseFloat(parts[2]) };
}

export function usePlatformTheme({
    selectedPlatform,
    isSessionActive,
    isCharacterVisible,
    isAuthRedirecting,
    showOAuthBridge,
    previewPlatform,
    backgroundVariant,
}: UsePlatformThemeParams) {
    const tweensRef = useRef<gsap.core.Tween[]>([]);

    useEffect(() => {
        // Kill any in-progress theme tweens
        tweensRef.current.forEach((t) => t.kill());
        tweensRef.current = [];

        const root = document.documentElement;
        const themeVars =
            !isSessionActive && !isCharacterVisible && !isAuthRedirecting && !showOAuthBridge
                ? DEFAULT_THEME
                : isCharacterVisible
                    ? (previewPlatform ? PLATFORM_THEME[previewPlatform] : DEFAULT_THEME)
                    : PLATFORM_THEME[selectedPlatform];

        Object.entries(themeVars).forEach(([key, targetValue]) => {
            const currentRaw = getComputedStyle(root).getPropertyValue(`--${key}`).trim();
            const from = parseHsl(currentRaw);
            const to = parseHsl(targetValue);

            // Fallback: instant set if values can't be parsed for tweening
            if (!from || !to) {
                root.style.setProperty(`--${key}`, targetValue);
                return;
            }

            const proxy = { h: from.h, s: from.s, l: from.l };
            const tween = gsap.to(proxy, {
                h: to.h,
                s: to.s,
                l: to.l,
                duration: 0.45,
                ease: "power2.inOut",
                overwrite: true,
                onUpdate() {
                    root.style.setProperty(
                        `--${key}`,
                        `${proxy.h.toFixed(1)} ${proxy.s.toFixed(1)}% ${proxy.l.toFixed(1)}%`
                    );
                },
            });
            tweensRef.current.push(tween);
        });

        localStorage.setItem(PLATFORM_STORAGE_KEY, selectedPlatform);

        return () => { tweensRef.current.forEach((t) => t.kill()); };
    }, [isAuthRedirecting, isCharacterVisible, isSessionActive, previewPlatform, selectedPlatform, showOAuthBridge]);

    useEffect(() => {
        localStorage.setItem(BACKGROUND_VARIANT_STORAGE_KEY, backgroundVariant);
    }, [backgroundVariant]);
}
