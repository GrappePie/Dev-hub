import { useCallback, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { toast } from "@/hooks/use-toast";
import { EMPTY_SEARCH_RESULTS } from "@/lib/spotify/config";
import { findBestArtistMatch, mapArtistData, mapPlaylists, mapSearchResults } from "@/lib/spotify/mappers";
import type {
    PlaylistItem,
    SearchResults,
    SearchTrackItem,
    SpotifyApiRequest,
    SpotifyArtist,
    SpotifyArtistSearchItem,
    SpotifyPlaylist,
    SpotifySearchResponse,
    SpotifyTopTrackItem,
    SpotifyTrackDetails,
} from "@/lib/spotify/types";
import type { ArtistData } from "@/types/player";

interface UseSpotifyLibraryParams {
    api: SpotifyApiRequest;
    accessTokenRef: MutableRefObject<string | null>;
    previewAudioRef: MutableRefObject<HTMLAudioElement | null>;
    playUris: (uris: string[]) => Promise<void>;
}

/** User library and catalog: paginated playlists, search (+ play first hit), track previews and artist details. */
export const useSpotifyLibrary = ({ api, accessTokenRef, previewAudioRef, playUris }: UseSpotifyLibraryParams) => {
    const playlistsNextRef = useRef<string | null>(null);

    const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
    const [playlistsLoading, setPlaylistsLoading] = useState(false);
    const [playlistsHasMore, setPlaylistsHasMore] = useState(false);
    const [libraryLoaded, setLibraryLoaded] = useState(false);

    const [searchResults, setSearchResults] = useState<SearchResults>(EMPTY_SEARCH_RESULTS);
    const [searchLoading, setSearchLoading] = useState(false);

    const loadPlaylists = useCallback(
        async (mode: "reset" | "append" = "reset") => {
            if (playlistsLoading) return;
            const endpoint = mode === "append" ? playlistsNextRef.current : "/me/playlists?limit=20";
            if (!endpoint) return;

            setPlaylistsLoading(true);
            try {
                const response = await api(endpoint, {}, { silent: true });
                if (!response.ok) return;
                const data = (await response.json()) as { items?: SpotifyPlaylist[]; next?: string | null };
                playlistsNextRef.current = data.next || null;
                setPlaylistsHasMore(Boolean(data.next));
                const mapped = mapPlaylists(data.items || []);
                setPlaylists((prev) => (mode === "append" ? [...prev, ...mapped] : mapped));
                setLibraryLoaded(true);
            } finally {
                setPlaylistsLoading(false);
            }
        },
        [api, playlistsLoading]
    );

    const ensureLibraryLoaded = useCallback(async () => {
        if (libraryLoaded) return;
        await loadPlaylists("reset");
    }, [libraryLoaded, loadPlaylists]);

    const searchCatalog = useCallback(
        async (query: string) => {
            const q = query.trim();
            if (!q) {
                setSearchResults(EMPTY_SEARCH_RESULTS);
                return;
            }
            setSearchLoading(true);
            try {
                const response = await api(
                    `/search?type=track,album,artist&limit=8&q=${encodeURIComponent(q)}`,
                    {},
                    { silent: true }
                );
                if (!response.ok) {
                    setSearchResults(EMPTY_SEARCH_RESULTS);
                    return;
                }
                const data = (await response.json()) as SpotifySearchResponse;
                setSearchResults(mapSearchResults(data));
            } finally {
                setSearchLoading(false);
            }
        },
        [api]
    );

    const clearSearchResults = useCallback(() => {
        setSearchResults(EMPTY_SEARCH_RESULTS);
    }, []);

    const searchAndPlay = useCallback(
        async (query: string) => {
            const q = query.trim();
            if (!q) return;
            const response = await api(`/search?type=track&limit=5&q=${encodeURIComponent(q)}`, {}, { silent: true });
            if (!response.ok) return;
            const data = (await response.json()) as { tracks?: { items?: SpotifyTrackDetails[] } };
            const firstTrack = data.tracks?.items?.[0];
            if (!firstTrack) {
                toast({ title: "Sin resultados", description: "No se encontraron canciones con esa busqueda." });
                return;
            }
            await playUris([firstTrack.uri]);
            toast({
                title: "Reproduciendo busqueda",
                description: `${firstTrack.name} · ${(firstTrack.artists || []).map((a: SpotifyArtist) => a.name).join(", ")}`,
            });
        },
        [api, playUris]
    );

    const playPreviewForTrackId = useCallback(
        async (trackId: string) => {
            if (!trackId || !previewAudioRef.current) return;
            const response = await api(`/tracks/${trackId}`, {}, { silent: true });
            if (!response.ok) return;
            const data = (await response.json()) as SpotifyTrackDetails;
            if (!data.preview_url) return;
            previewAudioRef.current.src = data.preview_url;
            try {
                await previewAudioRef.current.play();
            } catch {
                // Ignore autoplay blocking.
            }
        },
        [api, previewAudioRef]
    );

    const playSearchTrack = useCallback(
        async (track: SearchTrackItem) => {
            if (!track?.uri) return;
            await playUris([track.uri]);
        },
        [playUris]
    );

    const fetchArtistData = useCallback(async (artistName: string): Promise<ArtistData | null> => {
        if (!artistName || !accessTokenRef.current) return null;
        try {
            const searchRes = await api(
                `/search?type=artist&limit=10&q=${encodeURIComponent(artistName)}`,
                {},
                { silent: true }
            );
            if (!searchRes.ok) return null;
            const searchData = (await searchRes.json()) as {
                artists?: { items?: SpotifyArtistSearchItem[] };
            };
            const items = searchData.artists?.items ?? [];
            if (!items.length) return null;

            const artistItem = findBestArtistMatch(items, artistName);

            const topTracksRes = await api(
                `/artists/${artistItem.id}/top-tracks?market=ES`,
                {},
                { silent: true }
            );
            const topTracksData = topTracksRes.ok
                ? ((await topTracksRes.json()) as { tracks?: SpotifyTopTrackItem[] })
                : { tracks: [] };

            return mapArtistData(artistItem, topTracksData.tracks || []);
        } catch {
            return null;
        }
    }, [api, accessTokenRef]);

    const resetLibrary = useCallback(() => {
        setPlaylists([]);
        setSearchResults(EMPTY_SEARCH_RESULTS);
        playlistsNextRef.current = null;
        setLibraryLoaded(false);
    }, []);

    return {
        playlists,
        playlistsLoading,
        playlistsHasMore,
        searchResults,
        searchLoading,
        loadPlaylists,
        ensureLibraryLoaded,
        searchCatalog,
        clearSearchResults,
        searchAndPlay,
        playPreviewForTrackId,
        playSearchTrack,
        fetchArtistData,
        resetLibrary,
    };
};
