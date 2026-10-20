import useRetroSfx from "@/hooks/useRetroSfx";
import type useYoutubePlayer from "@/hooks/useYoutubePlayer";
import type { YouTubeLibrarySection } from "@/hooks/useYoutubePlayer";

type YoutubeLibrarySource = Pick<
    ReturnType<typeof useYoutubePlayer>,
    | "isAuthenticated"
    | "isAuthLoading"
    | "accountName"
    | "libraryBySection"
    | "libraryNextBySection"
    | "libraryLoading"
    | "libraryLoadingMoreBySection"
    | "fetchLibrary"
    | "loadMoreLibrarySection"
    | "playLibraryItem"
    | "startLogin"
    | "logout"
>;

interface YoutubeLibraryPanelProps {
    player: YoutubeLibrarySource;
    section: YouTubeLibrarySection;
    onSectionChange: (section: YouTubeLibrarySection) => void;
}

const LIBRARY_TABS: ReadonlyArray<{ section: YouTubeLibrarySection; label: string }> = [
    { section: "playlists", label: "PLAYLISTS" },
    { section: "likes", label: "LIKES" },
    { section: "watchLater", label: "WATCH" },
];

const YoutubeLibraryPanel = ({ player, section, onSectionChange }: YoutubeLibraryPanelProps) => {
    const sfx = useRetroSfx();
    const items = player.libraryBySection[section] || [];
    const hasMore = Boolean(player.libraryNextBySection[section]);
    const loadingMore = player.libraryLoadingMoreBySection[section];

    return (
        <div className="px-4 pt-4">
            <div className="pixel-box p-3">
                <div className="flex items-center justify-between mb-3">
                    <p className="font-display text-[8px] text-primary">BIBLIOTECA YOUTUBE</p>
                    <div className="flex items-center gap-2">
                        {player.isAuthenticated && (
                            <button
                                onClick={() => void player.fetchLibrary()}
                                className="retro-btn-secondary !text-[7px] !px-2 !py-1"
                                disabled={player.libraryLoading}
                            >
                                {player.libraryLoading ? "..." : "Refresh"}
                            </button>
                        )}
                        {player.isAuthenticated ? (
                            <button
                                onClick={player.logout}
                                className="retro-btn-secondary !text-[7px] !px-2 !py-1"
                            >
                                Salir
                            </button>
                        ) : (
                            <button
                                onClick={() => void player.startLogin()}
                                className="retro-btn-secondary !text-[7px] !px-2 !py-1"
                                disabled={player.isAuthLoading}
                            >
                                {player.isAuthLoading ? "Conectando..." : "Conectar"}
                            </button>
                        )}
                    </div>
                </div>

                {player.isAuthenticated && (
                    <>
                        <p className="text-sm text-muted-foreground mb-2 truncate">
                            Cuenta: {player.accountName || "Conectada"}
                        </p>
                        <div className="grid grid-cols-3 gap-1 mb-3">
                            {LIBRARY_TABS.map((tab) => {
                                const isActive = section === tab.section;
                                const count = player.libraryBySection[tab.section]?.length || 0;
                                return (
                                    <button
                                        key={`yt-lib-tab-${tab.section}`}
                                        onClick={() => {
                                            sfx("select");
                                            onSectionChange(tab.section);
                                        }}
                                        className={`px-2 py-1 font-display text-[7px] border-2 ${
                                            isActive ? "border-primary bg-secondary text-primary" : "border-border text-muted-foreground"
                                        }`}
                                    >
                                        {tab.label} ({count})
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}

                {!player.isAuthenticated && (
                    <p className="text-sm text-muted-foreground">
                        Conecta Google para ver playlists, likes y watch later de YouTube.
                    </p>
                )}
                {player.isAuthenticated && !items.length && !player.libraryLoading && (
                    <p className="text-sm text-muted-foreground">No hay elementos en {section}.</p>
                )}
                {player.isAuthenticated && player.libraryLoading && (
                    <p className="text-sm text-muted-foreground">Cargando biblioteca...</p>
                )}

                <div className="space-y-1 max-h-80 overflow-auto">
                    {items.map((item) => (
                        <button
                            key={`yt-lib-${section}-${item.id}`}
                            onClick={() => void player.playLibraryItem(item)}
                            className="w-full text-left px-2 py-2 hover:bg-secondary flex items-center gap-2"
                        >
                            <img
                                src={item.image}
                                alt={item.title}
                                className="w-8 h-8 border-2 border-border object-cover"
                            />
                            <div className="min-w-0">
                                <p className="text-sm truncate">{item.title}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                    {item.artist}
                                    {item.kind === "playlist" ? ` · ${item.trackCount || 0} tracks` : ""}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>

                {player.isAuthenticated && hasMore && (
                    <button
                        onClick={() => void player.loadMoreLibrarySection(section)}
                        className="retro-btn-secondary !text-[7px] !px-2 !py-1 mt-3"
                        disabled={loadingMore}
                    >
                        {loadingMore ? "Cargando..." : "Cargar mas"}
                    </button>
                )}
            </div>
        </div>
    );
};

export default YoutubeLibraryPanel;
