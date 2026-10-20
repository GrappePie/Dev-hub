/**
 * Provider-agnostic player domain types.
 *
 * Every provider hook (Spotify, SoundCloud, YouTube) and the UI depend on these
 * abstractions instead of importing types from each other (Dependency Inversion).
 */

export type ShuffleMode = "off" | "shuffle" | "smart";

export interface QueueTrack {
    id: string;
    title: string;
    artist: string;
    duration: string;
    uri: string;
}

export interface CurrentTrack {
    id: string;
    uri: string;
    title: string;
    artist: string;
    artistNames: string[];
    durationMs: number;
    duration: string;
    albumArt: string;
    externalUrl?: string;
    artistId?: string;
}

export interface ArtistTopTrack {
    id: string;
    uri: string;
    title: string;
    artist: string;
    duration: string;
    albumArt: string;
}

export interface ArtistData {
    id: string;
    name: string;
    image: string;
    followers?: number;
    genres?: string[];
    externalUrl?: string;
    topTracks: ArtistTopTrack[];
}

/** Read-only playback state every provider exposes to the app shell. */
export interface PlaybackSnapshot {
    isPlaying: boolean;
    /** Track progress as a percentage (0-100). */
    progress: number;
    /** Output volume (0-1). */
    volume: number;
}

/** Minimal contract needed to run a debounced catalog search (Interface Segregation). */
export interface CatalogSearch {
    searchCatalog: (query: string) => Promise<void>;
    clearSearchResults: () => void;
}

/** Full search contract implemented by every streaming provider. */
export interface SearchProvider extends CatalogSearch {
    searchAndPlay: (query: string) => Promise<void>;
}
