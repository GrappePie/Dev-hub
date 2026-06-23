import { Message } from "pixelarticons/react/Message";
import { Heart } from "pixelarticons/react/Heart";
import PixelIcon from "@/components/PixelIcon";
import type { YouTubeComment } from "@/hooks/useYoutubePlayer";

const timeAgo = (iso: string): string => {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `hace ${days}d`;
    const months = Math.floor(days / 30);
    if (months < 12) return `hace ${months}mo`;
    return `hace ${Math.floor(months / 12)}a`;
};

const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "");

interface CommentsPanelProps {
    comments: YouTubeComment[];
    loading: boolean;
}

const CommentsPanel = ({ comments, loading }: CommentsPanelProps) => (
    <div className="pixel-box p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2">
            <span className="font-display text-[9px] text-primary flex items-center gap-2"
                  style={{ textShadow: '2px 2px 0 hsl(240 30% 4%)' }}>
                <PixelIcon icon={Message} size="sm" />
                COMENTARIOS
            </span>
        </div>

        <div className="space-y-0 max-h-64 overflow-auto">
            {loading && (
                <p className="px-2 py-3 text-sm text-muted-foreground animate-pulse">Cargando comentarios…</p>
            )}
            {!loading && !comments.length && (
                <p className="px-2 py-3 text-sm text-muted-foreground">Sin comentarios disponibles.</p>
            )}
            {comments.map((c) => (
                <div key={c.id}
                     className="flex flex-col gap-1 px-2 py-2 border-b-2 border-border/30 last:border-0">
                    <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-[8px] text-primary truncate">{c.author}</span>
                        <span className="font-display text-[7px] text-muted-foreground shrink-0">
                            {timeAgo(c.publishedAt)}
                        </span>
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed line-clamp-3">
                        {stripHtml(c.text)}
                    </p>
                    {c.likeCount > 0 && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                            <PixelIcon icon={Heart} size="xs" />
                            <span className="font-display text-[7px]">{c.likeCount.toLocaleString()}</span>
                        </div>
                    )}
                </div>
            ))}
        </div>
    </div>
);

export default CommentsPanel;
