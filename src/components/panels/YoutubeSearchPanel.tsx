import type useYoutubePlayer from "@/hooks/useYoutubePlayer";

type YoutubeSearchSource = Pick<
    ReturnType<typeof useYoutubePlayer>,
    "searchLoading" | "searchResults" | "playSearchTrack" | "addToQueue"
>;

interface YoutubeSearchPanelProps {
    player: YoutubeSearchSource;
}

const YoutubeSearchPanel = ({ player }: YoutubeSearchPanelProps) => {
    const hasResults = player.searchResults.length > 0;

    return (
        <div className="px-4 pt-4">
            <div className="pixel-box p-3 max-h-96 overflow-auto">
                {player.searchLoading && (
                    <p className="text-sm text-muted-foreground">Buscando resultados...</p>
                )}
                {!player.searchLoading && !hasResults && (
                    <p className="text-sm text-muted-foreground">Sin resultados.</p>
                )}
                {hasResults && (
                    <div className="space-y-1">
                        {player.searchResults.map((item) => (
                            <div
                                key={`yt-search-${item.id}`}
                                className="flex items-center gap-2 px-2 py-2 hover:bg-secondary cursor-pointer"
                                onClick={() => {
                                    player.playSearchTrack(item);
                                }}
                            >
                                <img
                                    src={item.image}
                                    alt={item.title}
                                    className="w-8 h-8 border-2 border-border object-cover"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm truncate">{item.title}</p>
                                    <p className="text-xs text-muted-foreground truncate">{item.artist}</p>
                                </div>
                                <button
                                    className="retro-btn-secondary !text-[7px] !px-2 !py-1"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        player.playSearchTrack(item);
                                    }}
                                >
                                    Play
                                </button>
                                <button
                                    className="retro-btn-secondary !text-[7px] !px-2 !py-1"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        player.addToQueue(item);
                                    }}
                                >
                                    Colar
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default YoutubeSearchPanel;
