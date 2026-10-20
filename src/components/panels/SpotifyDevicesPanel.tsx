import type useSpotifyPlayer from "@/hooks/useSpotifyPlayer";

type SpotifyDevicesSource = Pick<ReturnType<typeof useSpotifyPlayer>, "devices" | "transferPlayback">;

interface SpotifyDevicesPanelProps {
    player: SpotifyDevicesSource;
}

const SpotifyDevicesPanel = ({ player }: SpotifyDevicesPanelProps) => (
    <div className="px-4 pt-4">
        <div className="pixel-box p-3">
            <p className="font-display text-[8px] text-primary mb-2">DISPOSITIVOS DISPONIBLES</p>
            <div className="space-y-2">
                {!player.devices.length && (
                    <p className="text-sm text-muted-foreground">No hay dispositivos activos.</p>
                )}
                {player.devices.map((device) => (
                    <button
                        key={device.id}
                        className={`w-full text-left px-3 py-2 border-2 transition-colors ${
                            device.isActive
                                ? "border-primary bg-secondary"
                                : "border-border hover:border-primary/60"
                        }`}
                        onClick={() => void player.transferPlayback(device.id)}
                        disabled={device.isRestricted}
                    >
                        <p className="text-sm">{device.name}</p>
                        <p className="text-xs text-muted-foreground">
                            {device.type} {device.isActive ? "· activo" : ""}
                        </p>
                    </button>
                ))}
            </div>
        </div>
    </div>
);

export default SpotifyDevicesPanel;
