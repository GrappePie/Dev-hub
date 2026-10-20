import type { SOUNDCLOUD_OAUTH_MESSAGE_TYPE } from "./config";

export interface SoundcloudTokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
}

export interface SoundcloudUser {
    id: number;
    username: string;
    full_name?: string;
    avatar_url?: string;
    permalink_url?: string;
}

/** Profile returned by `/users/:id`, used for the artist dialog. */
export interface SoundcloudArtistProfile {
    id: number;
    username: string;
    full_name?: string;
    avatar_url?: string | null;
    followers_count?: number;
    description?: string;
    permalink_url?: string;
}

/** Item shown in the library, search results and play queues (playlist, own track or like). */
export interface SoundcloudPlaylist {
    id: number;
    title: string;
    permalink_url: string;
    artwork_url?: string | null;
    track_count?: number;
    subtitle?: string;
    kind?: "playlist" | "track" | "like";
    artist?: string;
    duration_ms?: number;
}

export type SoundcloudLibrarySection = "playlists" | "tracks" | "likes";

/** Message posted by the OAuth popup back to the opener window. */
export interface SoundcloudPopupMessage {
    type: typeof SOUNDCLOUD_OAUTH_MESSAGE_TYPE;
    code?: string;
    state?: string | null;
    error?: string;
}

export interface ScTimedComment {
    id: number;
    body: string;
    timestamp: number; // milliseconds into the track
    user: { username: string; avatar_url?: string | null };
}

export interface SoundcloudCollectionResponse<T> {
    collection?: T[];
    next_href?: string | null;
}

/** Loose shape of the track, playlist and like items returned by the SoundCloud API. */
export interface SoundcloudApiItem {
    id?: number | string;
    title?: string;
    permalink_url?: string;
    artwork_url?: string | null;
    duration?: number;
    track_count?: number;
    user?: { id?: number | string; username?: string; avatar_url?: string | null };
    tracks?: SoundcloudApiItem[];
    track?: SoundcloudApiItem;
}
