import type useSpotifyPlayer from "@/hooks/useSpotifyPlayer";

type SpotifyLibrarySource = Pick<
    ReturnType<typeof useSpotifyPlayer>,
    "playlists" | "playlistsLoading" | "playlistsHasMore" | "playFavorites" | "playPlaylist" | "loadPlaylists"
>;

interface SpotifyLibraryPanelProps {
    player: SpotifyLibrarySource;
}

const SpotifyLibraryPanel = ({ player }: SpotifyLibraryPanelProps) => (
    <div className="px-4 pt-4">
        <div className="pixel-box p-3">
            <div className="flex items-center justify-between mb-3">
                <p className="font-display text-[8px] text-primary">BIBLIOTECA</p>
                <button
                    onClick={() => void player.playFavorites()}
                    className="retro-btn-secondary !text-[7px] !px-2 !py-1"
                >
                    Favoritos
                </button>
            </div>
            <div className="space-y-1 max-h-80 overflow-auto">
                {!player.playlists.length && !player.playlistsLoading && (
                    <p className="text-sm text-muted-foreground">No hay playlists disponibles.</p>
                )}
                {player.playlists.map((playlist) => (
                    <button
                        key={playlist.id}
                        onClick={() => void player.playPlaylist(playlist.id)}
                        className="w-full text-left px-2 py-2 hover:bg-secondary flex items-center gap-2"
                    >
                        <img src={playlist.image} alt={playlist.name} className="w-8 h-8 border-2 border-border object-cover" />
                        <div className="min-w-0">
                            <p className="text-sm truncate">{playlist.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                                {playlist.owner} · {playlist.tracksTotal} tracks
                            </p>
                        </div>
                    </button>
                ))}
            </div>
            {player.playlistsHasMore && (
                <button
                    onClick={() => void player.loadPlaylists("append")}
                    className="retro-btn-secondary !text-[7px] !px-2 !py-1 mt-3"
                    disabled={player.playlistsLoading}
                >
                    {player.playlistsLoading ? "Cargando..." : "Cargar mas"}
                </button>
            )}
        </div>
    </div>
);

export default SpotifyLibraryPanel;
