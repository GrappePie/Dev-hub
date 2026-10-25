export interface TokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
}

export interface SpotifyTokenError {
    error?: string;
    error_description?: string;
}

export interface OAuthPopupMessage {
    type: "spotify-oauth-callback";
    code?: string | null;
    state?: string | null;
    error?: string;
}

export interface AuthFeedback {
    id: number;
    kind: "success" | "error";
}

export interface SpotifyArtist {
    id?: string;
    name: string;
    uri?: string;
}

export interface SpotifyImage {
    url: string;
    width?: number;
    height?: number;
}

export interface SpotifyAlbum {
    id: string;
    name: string;
    images?: SpotifyImage[];
}

export interface SpotifyPlaylist {
    id: string;
    name: string;
    images?: SpotifyImage[];
    owner?: { display_name?: string };
    tracks?: { total?: number };
}

export interface SpotifyDevice {
    id: string;
    is_active: boolean;
    is_restricted: boolean;
    name: string;
    type: string;
}

export interface SpotifyTrackDetails extends SpotifyWebTrack {
    preview_url?: string | null;
}

export interface SpotifySearchResponse {
    tracks?: { items?: SpotifyTrackDetails[] };
    albums?: { items?: SpotifyAlbum[] };
    artists?: { items?: Array<{ id: string; name: string; images?: SpotifyImage[] }> };
}

export interface SpotifyRecommendationTrack {
    id: string;
    uri?: string;
}

export interface SpotifyRecommendationsResponse {
    tracks?: SpotifyRecommendationTrack[];
}

export interface SpotifyArtistSearchItem {
    id: string;
    name: string;
    images?: Array<{ url: string }>;
    followers?: { total?: number };
    genres?: string[];
    external_urls?: { spotify?: string };
}

export interface SpotifyTopTrackItem {
    id: string;
    uri: string;
    name?: string;
    duration_ms?: number;
    artists?: Array<{ name: string }>;
    album?: { images?: Array<{ url: string }> };
}

export interface DeviceItem {
    id: string;
    name: string;
    type: string;
    isActive: boolean;
    isRestricted: boolean;
}

export interface PlaylistItem {
    id: string;
    name: string;
    owner: string;
    image: string;
    tracksTotal: number;
}

export interface SearchTrackItem {
    durationMs?: number;
    id: string;
    uri: string;
    name: string;
    artist: string;
    image: string;
}

export interface SearchAlbumItem {
    id: string;
    name: string;
    image: string;
}

export interface SearchArtistItem {
    id: string;
    name: string;
    image: string;
}

export interface SearchResults {
    tracks: SearchTrackItem[];
    albums: SearchAlbumItem[];
    artists: SearchArtistItem[];
}

export interface SpotifyApiOptions {
    silent?: boolean;
}

/** Authorized Web API request: relative paths are resolved against the API base URL. */
export type SpotifyApiRequest = (path: string, init?: RequestInit, opts?: SpotifyApiOptions) => Promise<Response>;

export type SpotifyDeviceCommand = (deviceId: string) => Promise<Response>;

/** Runs a playback command against the resolved device, retrying on another device when Spotify reports "device not found". */
export type ExecuteWithDeviceRecovery = (runner: SpotifyDeviceCommand) => Promise<Response | null>;
