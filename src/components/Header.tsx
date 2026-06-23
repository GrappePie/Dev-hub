import { useRef } from "react";
import useRetroSfx from "@/hooks/useRetroSfx";
import { Music } from "pixelarticons/react/Music";
import PixelIcon from "@/components/PixelIcon";

interface HeaderProps {
    isSessionActive: boolean;
    showSearchControls: boolean;
    showDeviceControl: boolean;
    showLibraryControl: boolean;
    showAuthControl?: boolean;
    authControlLabel?: string;
    authControlTitle?: string;
    authControlDisabled?: boolean;
    authControlTone?: "primary" | "secondary";
    onAuthControl?: () => void;
    onLoginToggle: () => void;
    activeDeviceName: string;
    searchQuery: string;
    searchPlaceholder?: string;
    onSearchChange: (value: string) => void;
    onSearchSubmit: () => void;
    onLibraryToggle: () => void;
    onDevicesToggle: () => void;
}

const Header = ({
                    isSessionActive,
                    showSearchControls,
                    showDeviceControl,
                    showLibraryControl,
                    showAuthControl = false,
                    authControlLabel = "Conectar",
                    authControlTitle,
                    authControlDisabled = false,
                    authControlTone = "secondary",
                    onAuthControl,
                    onLoginToggle,
                    activeDeviceName,
                    searchQuery,
                    searchPlaceholder = "► BUSCAR...",
                    onSearchChange,
                    onSearchSubmit,
                    onLibraryToggle,
                    onDevicesToggle,
                }: HeaderProps) => {
    const sfx = useRetroSfx();
    const lastTypeSfxAtRef = useRef(0);

    return (
        <header className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3 border-b-4 border-border">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary flex items-center justify-center border-2 border-foreground">
                    <PixelIcon icon={Music} size="sm" className="text-primary-foreground" />
                </div>
                <h1 className="font-display text-xs sm:text-sm text-primary" style={{ textShadow: "2px 2px 0 hsl(240 30% 4%)" }}>
                    DEV HUB
                </h1>
            </div>

            {showSearchControls && (
                <div className="flex-1 max-w-sm flex items-center gap-2">
                    <input
                        type="text"
                        placeholder={searchPlaceholder}
                        value={searchQuery}
                        className="w-full bg-secondary px-3 py-2 text-sm font-body border-2 border-border placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
                        onChange={(e) => {
                            onSearchChange(e.target.value);
                            const now = performance.now();
                            if (now - lastTypeSfxAtRef.current > 35) {
                                sfx("text");
                                lastTypeSfxAtRef.current = now;
                            }
                        }}
                        onFocus={() => sfx("select")}
                        onKeyDown={(e) => {
                            if (e.key !== "Enter") return;
                            sfx("confirm");
                            onSearchSubmit();
                        }}
                    />
                    <button
                        onClick={() => {
                            sfx("confirm");
                            onSearchSubmit();
                        }}
                        className="retro-btn-secondary !text-[8px] !px-3 !py-2"
                    >
                        Go
                    </button>
                </div>
            )}

            <div className="flex items-center gap-2">
                {showDeviceControl && (
                    <button
                        onClick={() => {
                            sfx("select");
                            onDevicesToggle();
                        }}
                        className="retro-btn-secondary !max-w-[140px] truncate"
                        title={activeDeviceName}
                    >
                        {activeDeviceName}
                    </button>
                )}
                {showLibraryControl && (
                    <button
                        onClick={() => {
                            sfx("select");
                            onLibraryToggle();
                        }}
                        className="retro-btn-secondary"
                    >
                        Biblio
                    </button>
                )}
                {showAuthControl && (
                    <button
                        onClick={() => {
                            sfx("select");
                            onAuthControl?.();
                        }}
                        className={authControlTone === "primary" ? "retro-btn" : "retro-btn-secondary"}
                        title={authControlTitle}
                        disabled={authControlDisabled}
                    >
                        {authControlLabel}
                    </button>
                )}
                <button
                    onClick={() => {
                        sfx(isSessionActive ? "cancel" : "coin");
                        onLoginToggle();
                    }}
                    className="retro-btn"
                >
                    {isSessionActive ? "Salir" : "Start"}
                </button>
            </div>
        </header>
    );
};

export default Header;
