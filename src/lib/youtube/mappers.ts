import fallbackAlbumArt from "@/assets/album-art-placeholder.svg";
import { formatMs } from "@/lib/format";
import type { CurrentTrack, QueueTrack } from "@/types/player";
import type {
    YouTubeComment,
    YouTubeCommentThreadItem,
    YouTubeLibraryPlaylistItem,
    YouTubeLibraryTrackItem,
    YouTubePlaylist,
    YouTubePlaylistItem,
    YouTubeSearchResult,
    YouTubeSnippet,
    YouTubeThumbnails,
    YouTubeTrack,
} from "./types";

/** ISO 8601 video duration (`PT#H#M#S`) in milliseconds; 0 when missing or unsupported. */
export const parseIsoDuration = (value?: string) => {
    if (!value) return 0;
    const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    if (!match) return 0;
    const hours = Number(match[1] || 0);
    const mins = Number(match[2] || 0);
    const secs = Number(match[3] || 0);
    return ((hours * 60 + mins) * 60 + secs) * 1000;
};

export const toWatchUrl = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`;

export const pickThumb = (value?: YouTubeThumbnails) =>
    value?.high?.url || value?.medium?.url || value?.default?.url || fallbackAlbumArt;

export const mapQueueTrack = (track: YouTubeTrack): QueueTrack => ({
    id: track.id,
    title: track.title,
    artist: track.artist,
    duration: track.duration,
    uri: track.uri,
});

export const mapCurrentTrack = (track: YouTubeTrack): CurrentTrack => ({
    id: track.id,
    uri: track.uri,
    title: track.title,
    artist: track.artist,
    artistNames: [track.artist],
    durationMs: track.durationMs,
    duration: track.duration,
    albumArt: track.image || fallbackAlbumArt,
    externalUrl: track.uri,
});

export const getSearchResultVideoId = (item: YouTubeSearchResult) => item.id?.videoId;

/** Playlist entries expose the video id in `contentDetails` or, for some playlists, only in `snippet.resourceId`. */
export const getPlaylistItemVideoId = (item: YouTubePlaylistItem) =>
    item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;

/** Ids whose durations must be looked up separately: search and playlist endpoints don't return them. */
export const collectVideoIds = <T>(items: T[], getVideoId: (item: T) => string | undefined) =>
    items.map(getVideoId).filter((value): value is string => Boolean(value));

/** Maps search results or playlist entries to playable tracks, skipping entries without a video id. */
export const mapVideoTracks = <T extends { snippet?: YouTubeSnippet }>(
    items: T[],
    getVideoId: (item: T) => string | undefined,
    durationById: ReadonlyMap<string, number>,
    fallbackTitle: string
): YouTubeTrack[] =>
    items.flatMap((item) => {
        const videoId = getVideoId(item);
        if (!videoId) return [];
        const durationMs = durationById.get(videoId) || 0;
        return [
            {
                id: `yt-${videoId}`,
                videoId,
                uri: toWatchUrl(videoId),
                title: item.snippet?.title || fallbackTitle,
                artist: item.snippet?.channelTitle || "YouTube",
                image: pickThumb(item.snippet?.thumbnails),
                durationMs,
                duration: formatMs(durationMs),
            },
        ];
    });

export const toLibraryTrackItems = (tracks: YouTubeTrack[]): YouTubeLibraryTrackItem[] =>
    tracks.map((track) => ({ kind: "track", ...track }));

export const mapPlaylists = (items: YouTubePlaylist[]): YouTubeLibraryPlaylistItem[] =>
    items
        .filter((item) => item.id)
        .map((item) => ({
            id: `yt-playlist-${item.id}`,
            kind: "playlist",
            playlistId: item.id as string,
            title: item.snippet?.title || "Playlist",
            artist: item.snippet?.channelTitle || "YouTube",
            image: pickThumb(item.snippet?.thumbnails),
            trackCount: Number(item.contentDetails?.itemCount || 0),
        }));

/** Top-level comments with text; replies and empty comments are dropped. */
export const mapCommentThreads = (items: YouTubeCommentThreadItem[]): YouTubeComment[] =>
    items
        .map((item) => {
            const snippet = item.snippet?.topLevelComment?.snippet;
            return {
                id: item.id || String(Math.random()),
                author: snippet?.authorDisplayName || "Anónimo",
                text: snippet?.textDisplay || "",
                likeCount: snippet?.likeCount || 0,
                publishedAt: snippet?.publishedAt || "",
            };
        })
        .filter((comment) => comment.text);
