import type useSpotifyPlayer from "@/hooks/useSpotifyPlayer";

type SpotifySearchSource = Pick<
    ReturnType<typeof useSpotifyPlayer>,
    "searchLoading" | "searchResults" | "playSearchTrack" | "addToQueue" | "playAlbum"
>;

interface SpotifySearchPanelProps {
    player: SpotifySearchSource;
}

const SpotifySearchPanel = ({ player }: SpotifySearchPanelProps) => {
    const { tracks, albums, artists } = player.searchResults;
    const hasResults = tracks.length > 0 || albums.length > 0 || artists.length > 0;

    return (
        <div className="px-4 pt-4">
            <div className="pixel-box p-3 max-h-96 overflow-auto">
                {player.searchLoading && (
                    <p className="text-sm text-muted-foreground">Buscando resultados...</p>
                )}
                {!player.searchLoading && !hasResults && (
                    <p className="text-sm text-muted-foreground">Sin resultados.</p>
                )}
                {!!tracks.length && (
                    <div className="mb-3">
                        <p className="font-display text-[8px] text-primary mb-2">CANCIONES</p>
                        <div className="space-y-1">
                            {tracks.map((track) => (
                                <div
                                    key={track.id}
                                    className="flex items-center gap-2 px-2 py-2 hover:bg-secondary cursor-pointer"
                                    onClick={() => {
                                        void player.playSearchTrack(track);
                                    }}
                                >
                                    <img src={track.image} alt={track.name} className="w-8 h-8 border-2 border-border object-cover" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm truncate">{track.name}</p>
                                        <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                                    </div>
                                    <button
                                        className="retro-btn-secondary !text-[7px] !px-2 !py-1"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            void player.addToQueue(track.uri);
                                        }}
                                    >
                                        Colar
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {!!albums.length && (
                    <div className="mb-3">
                        <p className="font-display text-[8px] text-primary mb-2">ALBUMES</p>
                        <div className="space-y-1">
                            {albums.map((album) => (
                                <div
                                    key={album.id}
                                    className="flex items-center gap-2 px-2 py-2 hover:bg-secondary cursor-pointer"
                                    onClick={() => void player.playAlbum(album.id)}
                                >
                                    <img src={album.image} alt={album.name} className="w-8 h-8 border-2 border-border object-cover" />
                                    <p className="text-sm truncate">{album.name}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {!!artists.length && (
                    <div>
                        <p className="font-display text-[8px] text-primary mb-2">ARTISTAS</p>
                        <div className="space-y-1">
                            {artists.map((artist) => (
                                <div key={artist.id} className="flex items-center gap-2 px-2 py-2">
                                    <img src={artist.image} alt={artist.name} className="w-8 h-8 border-2 border-border rounded-full object-cover" />
                                    <p className="text-sm truncate">{artist.name}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SpotifySearchPanel;
