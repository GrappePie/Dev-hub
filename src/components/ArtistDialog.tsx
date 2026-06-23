import { useEffect, useRef } from "react";
import type { ArtistData, ArtistTopTrack } from "@/hooks/useSpotifyPlayer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Play } from "pixelarticons/react/Play";
import { Link } from "pixelarticons/react/Link";
import PixelIcon from "@/components/PixelIcon";
import useRetroSfx from "@/hooks/useRetroSfx";

interface ArtistDialogProps {
    open: boolean;
    onClose: () => void;
    data: ArtistData | null;
    loading?: boolean;
    onPlayTrack?: (track: ArtistTopTrack) => void;
}

const formatFollowers = (count?: number): string => {
    if (count === undefined) return "";
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M seguidores`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K seguidores`;
    return `${count} seguidores`;
};

const SkeletonLine = ({ className = "" }: { className?: string }) => (
    <div className={`bg-secondary animate-pulse ${className}`} />
);

const ArtistDialog = ({ open, onClose, data, loading = false, onPlayTrack }: ArtistDialogProps) => {
    const sfx = useRetroSfx();
    const prevOpen = useRef(false);

    useEffect(() => {
        if (open && !prevOpen.current) sfx("menu-open");
        if (!open && prevOpen.current) sfx("menu-close");
        prevOpen.current = open;
    }, [open, sfx]);

    return (
        <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
            <DialogContent className="!fixed snes-dialog pixel-box-elevated border-4 border-border bg-background max-w-lg w-full p-0 overflow-hidden gap-0">
                <DialogHeader className="px-5 pt-5 pb-3 border-b-2 border-border">
                    <DialogTitle className="font-display text-[9px] text-primary tracking-widest">
                        ARTIST PROFILE
                    </DialogTitle>
                </DialogHeader>

                <div className="snes-dialog-content overflow-y-auto max-h-[80vh]">
                    {loading && (
                        <div className="p-5 space-y-4">
                            <div className="flex gap-4 items-start">
                                <SkeletonLine className="w-24 h-24 shrink-0" />
                                <div className="flex-1 space-y-2 pt-1">
                                    <SkeletonLine className="h-4 w-3/4" />
                                    <SkeletonLine className="h-3 w-1/2" />
                                    <SkeletonLine className="h-3 w-2/3" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <SkeletonLine className="w-8 h-8 shrink-0" />
                                        <SkeletonLine className="h-3 flex-1" />
                                        <SkeletonLine className="h-3 w-10" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {!loading && !data && (
                        <div className="p-8 text-center">
                            <p className="font-display text-[8px] text-muted-foreground">SIN DATOS</p>
                        </div>
                    )}

                    {!loading && data && (
                        <div className="p-5 space-y-4">
                            {/* Artist header */}
                            <div className="flex gap-4 items-start">
                                <img
                                    src={data.image}
                                    alt={data.name}
                                    className="w-24 h-24 object-cover border-4 border-border shrink-0"
                                    style={{ imageRendering: "auto" }}
                                />
                                <div className="flex-1 min-w-0 pt-1 space-y-2">
                                    <p
                                        className="font-display text-[10px] text-primary leading-relaxed"
                                        style={{ textShadow: "2px 2px 0 hsl(240 30% 4%)" }}
                                    >
                                        {data.name}
                                    </p>
                                    {data.followers !== undefined && (
                                        <p className="text-xs text-muted-foreground">
                                            {formatFollowers(data.followers)}
                                        </p>
                                    )}
                                    {data.genres && data.genres.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {data.genres.slice(0, 4).map((genre) => (
                                                <span
                                                    key={genre}
                                                    className="font-display text-[7px] px-1.5 py-0.5 border border-border text-muted-foreground bg-secondary"
                                                >
                                                    {genre.toUpperCase()}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {data.externalUrl && (
                                        <a
                                            href={data.externalUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="retro-btn-secondary !text-[7px] !px-2 !py-1 inline-flex items-center gap-1 mt-1"
                                        >
                                            <PixelIcon icon={Link} size="xs" />
                                            PERFIL
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Top tracks */}
                            {data.topTracks.length > 0 && (
                                <div>
                                    <p className="font-display text-[8px] text-primary mb-2">TOP TRACKS</p>
                                    <div className="pixel-box p-2 space-y-0.5">
                                        {data.topTracks.map((track, index) => (
                                            <div
                                                key={track.id}
                                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-secondary group cursor-pointer"
                                                onClick={() => onPlayTrack?.(track)}
                                            >
                                                <span className="font-display text-[7px] text-muted-foreground w-4 text-right shrink-0">
                                                    {index + 1}
                                                </span>
                                                <img
                                                    src={track.albumArt}
                                                    alt={track.title}
                                                    className="w-8 h-8 object-cover border border-border shrink-0"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm truncate leading-tight">{track.title}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                                                </div>
                                                <span className="font-display text-[7px] text-muted-foreground shrink-0 hidden group-hover:hidden">
                                                    {track.duration}
                                                </span>
                                                {onPlayTrack && (
                                                    <button
                                                        className="retro-btn-secondary !p-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={(e) => { e.stopPropagation(); onPlayTrack(track); }}
                                                        title="Reproducir"
                                                    >
                                                        <PixelIcon icon={Play} size="xs" />
                                                    </button>
                                                )}
                                                <span className="font-display text-[7px] text-muted-foreground shrink-0">
                                                    {track.duration}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ArtistDialog;
