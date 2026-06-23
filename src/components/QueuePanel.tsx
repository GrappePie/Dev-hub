import useRetroSfx from "@/hooks/useRetroSfx";
import { Music } from "pixelarticons/react/Music";
import { Play } from "pixelarticons/react/Play";
import PixelIcon from "@/components/PixelIcon";

interface Track {
    id: string;
    title: string;
    artist: string;
    duration: string;
}

interface QueuePanelProps {
    tracks: Track[];
    onRefresh: () => void;
    onTrackSelect: (trackId: string) => void;
}

const QueuePanel = ({ tracks, onRefresh, onTrackSelect }: QueuePanelProps) => {
    const sfx = useRetroSfx();

    return (
        <div className="pixel-box p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <span className="font-display text-[9px] text-primary flex items-center gap-2"
                      style={{ textShadow: '2px 2px 0 hsl(240 30% 4%)' }}>
                    <PixelIcon icon={Music} size="sm" />
                    COLA
                </span>
                <button
                    onClick={() => {
                        sfx("select");
                        onRefresh();
                    }}
                    className="retro-btn-secondary !text-[7px] !px-2 !py-1"
                >
                    REFRESH
                </button>
            </div>

            <div className="space-y-0 max-h-64 overflow-auto">
                {!tracks.length && (
                    <p className="px-2 py-3 text-sm text-muted-foreground">Sin próximos tracks en cola.</p>
                )}
                {tracks.map((track, i) => (
                    <div
                        key={track.id}
                        onClick={() => {
                            sfx("navigate");
                            onTrackSelect(track.id);
                        }}
                        className="group flex items-center gap-3 px-2 py-2 border-b-2 border-border/30 last:border-0 hover:bg-secondary/80 cursor-pointer transition-colors"
                    >
                        <span className="w-5 font-display text-[8px] text-muted-foreground text-center group-hover:hidden">
              {String(i + 1).padStart(2, '0')}
            </span>
                        <PixelIcon icon={Play} size="xs" className="text-primary hidden group-hover:block" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{track.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                        </div>
                        <span className="font-display text-[8px] text-muted-foreground">{track.duration}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default QueuePanel;
