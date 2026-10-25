import fallbackAlbumArt from "@/assets/album-art-placeholder.svg";
import { formatMs } from "@/lib/format";
import type {
    DeviceItem,
    PlaylistItem,
    SearchResults,
    SpotifyArtistSearchItem,
    SpotifyDevice,
    SpotifyPlaylist,
    SpotifySearchResponse,
    SpotifyTopTrackItem,
} from "@/lib/spotify/types";
import type { ArtistData, CurrentTrack, QueueTrack } from "@/types/player";

export const mapQueue = (tracks: SpotifyWebTrack[] = []): QueueTrack[] =>
    tracks.map((track, index) => ({
        id: track.id || `${track.uri}-${index}`,
        title: track.name || "Unknown track",
        artist: (track.artists || []).map((artist) => artist.name).join(", ") || "Unknown artist",
        duration: formatMs(track.duration_ms || 0),
        uri: track.uri,
    }));

export const mapTrack = (track?: SpotifyWebTrack | null): CurrentTrack | null => {
    if (!track) return null;
    const names = (track.artists || []).map((a) => a.name).filter(Boolean);
    return {
        id: track.id,
        uri: track.uri,
        title: track.name || "Sin título",
        artist: names.join(", ") || "Sin artista",
        artistNames: names.length ? names : ["Sin artista"],
        durationMs: track.duration_ms || 0,
        duration: formatMs(track.duration_ms || 0),
        albumArt: track.album?.images?.[0]?.url || fallbackAlbumArt,
        externalUrl: track.external_urls?.spotify,
        artistId: (track.artists || []).find((artist) => artist.id)?.id,
    };
};

export const mapDevices = (devices: SpotifyDevice[]): DeviceItem[] =>
    devices.map((device) => ({
        id: device.id,
        name: device.name,
        type: device.type,
        isActive: device.is_active,
        isRestricted: device.is_restricted,
    }));

export const mapPlaylists = (items: SpotifyPlaylist[]): PlaylistItem[] =>
    items.map((playlist) => ({
        id: playlist.id,
        name: playlist.name,
        owner: playlist.owner?.display_name || "Unknown owner",
        image: playlist.images?.[0]?.url || fallbackAlbumArt,
        tracksTotal: playlist.tracks?.total || 0,
    }));

export const mapSearchResults = (data: SpotifySearchResponse): SearchResults => ({
    tracks: (data.tracks?.items || []).map((track) => ({
        id: track.id,
        uri: track.uri,
        name: track.name || "Sin título",
        artist: (track.artists || []).map((artist) => artist.name).join(", ") || "Sin artista",
        image: track.album?.images?.[2]?.url || track.album?.images?.[0]?.url || fallbackAlbumArt,
        durationMs: track.duration_ms || 0,
    })),
    albums: (data.albums?.items || []).map((album) => ({
        id: album.id,
        name: album.name || "Sin nombre",
        image: album.images?.[2]?.url || album.images?.[0]?.url || fallbackAlbumArt,
    })),
    artists: (data.artists?.items || []).map((artist) => ({
        id: artist.id,
        name: artist.name || "Sin nombre",
        image: artist.images?.[2]?.url || artist.images?.[0]?.url || fallbackAlbumArt,
    })),
});

/** Expects a non-empty `items` list. */
export const findBestArtistMatch = (items: SpotifyArtistSearchItem[], artistName: string) => {
    const normalise = (s: string) => s.toLowerCase().trim();
    const target = normalise(artistName);
    // Prefer exact match, then starts-with, then first result
    return (
        items.find((a) => normalise(a.name) === target) ??
        items.find((a) => normalise(a.name).startsWith(target)) ??
        items[0]
    );
};

export const mapArtistData = (artistItem: SpotifyArtistSearchItem, topTracks: SpotifyTopTrackItem[]): ArtistData => ({
    id: artistItem.id,
    name: artistItem.name,
    image: artistItem.images?.[0]?.url || fallbackAlbumArt,
    followers: artistItem.followers?.total,
    genres: artistItem.genres,
    externalUrl: artistItem.external_urls?.spotify,
    topTracks: topTracks.slice(0, 10).map((t) => ({
        id: t.id,
        uri: t.uri,
        title: t.name || "Sin título",
        artist: (t.artists || []).map((a) => a.name).join(", ") || "Sin artista",
        duration: formatMs(t.duration_ms || 0),
        albumArt: t.album?.images?.[2]?.url || t.album?.images?.[0]?.url || fallbackAlbumArt,
    })),
});
