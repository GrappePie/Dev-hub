import fallbackAlbumArt from "@/assets/album-art-placeholder.svg";
import { formatMs } from "@/lib/format";
import type { ArtistData } from "@/types/player";
import { SOUNDCLOUD_API_BASE, SOUNDCLOUD_CLIENT_ID } from "./config";
import type {
    SoundcloudApiItem,
    SoundcloudArtistProfile,
    SoundcloudCollectionResponse,
    SoundcloudPlaylist,
} from "./types";

export const hasPermalink = <T extends { permalink_url?: string }>(
    item: T | null | undefined
): item is T & { permalink_url: string } => Boolean(item?.permalink_url);

/** Returns an `https://` SoundCloud URL without query params (UTM, etc.), or "" when the value is not a SoundCloud link. */
export const normalizeSoundcloudUrl = (value: string) => {
    const raw = value.trim().split("?")[0];
    if (!raw) return "";
    if (raw.startsWith("https://soundcloud.com/") || raw.startsWith("https://on.soundcloud.com/")) return raw;
    if (raw.startsWith("http://soundcloud.com/")) return raw.replace("http://", "https://");
    if (raw.startsWith("soundcloud.com/")) return `https://${raw}`;
    return "";
};

export const buildWidgetSrc = (trackUrl: string, autoPlay = false) =>
    `https://w.soundcloud.com/player/?url=${encodeURIComponent(trackUrl)}&auto_play=${autoPlay ? "true" : "false"}&hide_related=false&show_comments=false&show_user=true&show_reposts=false&visual=false`;

export const upscaleArtwork = (url?: string | null) => {
    if (!url) return fallbackAlbumArt;
    return url.replace("-large.", "-t500x500.");
};

/** Resolves an API path (or absolute `next_href`) and adds the public `client_id` when requested. */
export const appendClientId = (path: string, includeClientId = true) => {
    const target = path.startsWith("http") ? new URL(path) : new URL(`${SOUNDCLOUD_API_BASE}${path}`);
    if (includeClientId && SOUNDCLOUD_CLIENT_ID && !target.searchParams.has("client_id")) {
        target.searchParams.set("client_id", SOUNDCLOUD_CLIENT_ID);
    }
    return target.toString();
};

/** Accepts both plain arrays and `linked_partitioning` responses (`{ collection, next_href }`). */
export const parseCollectionResponse = <T>(raw: unknown): { items: T[]; nextHref: string | null } => {
    if (Array.isArray(raw)) {
        return { items: raw as T[], nextHref: null };
    }
    const data = raw as SoundcloudCollectionResponse<T> | null;
    const items = Array.isArray(data?.collection) ? data.collection : [];
    return { items, nextHref: data?.next_href || null };
};

/** Keeps the first item for each permalink. */
export const dedupeByPermalink = (items: SoundcloudPlaylist[]) => {
    const uniqueByUrl = new Map<string, SoundcloudPlaylist>();
    items.forEach((item) => {
        if (!item.permalink_url) return;
        if (!uniqueByUrl.has(item.permalink_url)) {
            uniqueByUrl.set(item.permalink_url, item);
        }
    });
    return Array.from(uniqueByUrl.values());
};

export const mapPlaylistItems = (items: SoundcloudApiItem[]): SoundcloudPlaylist[] =>
    items
        .filter(hasPermalink)
        .map((item) => ({
            id: Number(item.id),
            title: item.title || "Playlist",
            permalink_url: item.permalink_url,
            artwork_url: item.artwork_url || item?.tracks?.[0]?.artwork_url || null,
            track_count: item.track_count || item?.tracks?.length || 0,
            subtitle: "Playlist",
            kind: "playlist" as const,
        }));

/** Library/search list entries: a single track labelled with `subtitle`. */
export const mapTrackItems = (items: SoundcloudApiItem[], subtitle: string, kind: "track" | "like"): SoundcloudPlaylist[] =>
    items
        .filter(hasPermalink)
        .map((item) => ({
            id: Number(item.id),
            title: item.title || (kind === "like" ? "Like" : "Track"),
            permalink_url: item.permalink_url,
            artwork_url: item.artwork_url || item?.user?.avatar_url || null,
            track_count: 1,
            subtitle,
            kind,
            artist: item?.user?.username || "SoundCloud",
            duration_ms: item?.duration || 0,
        }));

/** Likes may wrap the track (`{ track }`) or be the track itself. */
export const mapLikeItems = (items: SoundcloudApiItem[]): SoundcloudPlaylist[] => {
    const tracks = items
        .map((entry) => entry?.track || entry)
        .filter(Boolean);
    return mapTrackItems(tracks, "Me gusta", "like");
};

/** Queue entries without list labels (related tracks, contents of an expanded playlist). */
export const mapPlayableTracks = (items: SoundcloudApiItem[]): SoundcloudPlaylist[] =>
    items
        .filter(hasPermalink)
        .map((item) => ({
            id: Number(item.id),
            title: item.title || "Track",
            permalink_url: item.permalink_url,
            artwork_url: item.artwork_url || item?.user?.avatar_url || null,
            kind: "track" as const,
            artist: item.user?.username || "SoundCloud",
            duration_ms: item.duration || 0,
        }));

/** Maps a `/tracks?q=` response into search result entries. */
export const mapSearchResults = (raw: unknown): SoundcloudPlaylist[] =>
    mapTrackItems(parseCollectionResponse<SoundcloudApiItem>(raw).items, "Busqueda", "track");

/** Builds the artist dialog data from a user profile and the raw `/users/:id/tracks` response. */
export const mapArtistData = (user: SoundcloudArtistProfile, rawTracks: unknown): ArtistData => {
    const tracks = Array.isArray(rawTracks) ? (rawTracks as SoundcloudApiItem[]) : [];
    return {
        id: String(user.id),
        name: user.full_name || user.username,
        image: upscaleArtwork(user.avatar_url),
        followers: user.followers_count,
        externalUrl: user.permalink_url,
        topTracks: tracks.slice(0, 10).map((t) => ({
            id: String(t.id),
            uri: t.permalink_url || "",
            title: t.title || "Sin título",
            artist: t.user?.username || user.username,
            duration: formatMs(t.duration || 0),
            albumArt: upscaleArtwork(t.artwork_url || user.avatar_url),
        })),
    };
};
