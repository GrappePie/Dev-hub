export type YouTubeLibrarySection = "playlists" | "likes" | "watchLater";

export interface YouTubeThumbnails {
    high?: { url?: string };
    medium?: { url?: string };
    default?: { url?: string };
}

export interface YouTubeSnippet {
    title?: string;
    channelTitle?: string;
    thumbnails?: YouTubeThumbnails;
}

export interface YouTubeSearchResult {
    id?: { videoId?: string };
    snippet?: YouTubeSnippet;
}

export interface YouTubePlaylist {
    id?: string;
    snippet?: YouTubeSnippet;
    contentDetails?: {
        itemCount?: number;
    };
}

export interface YouTubePlaylistItem {
    snippet?: YouTubeSnippet & {
        resourceId?: {
            videoId?: string;
        };
    };
    contentDetails?: {
        videoId?: string;
    };
}

export interface YouTubeVideoDetails {
    id?: string;
    contentDetails?: {
        duration?: string;
    };
}

/** `/channels?mine=true` entry: display name plus the ids of the likes and watch-later playlists. */
export interface YouTubeChannel {
    snippet?: { title?: string };
    contentDetails?: { relatedPlaylists?: { likes?: string; watchLater?: string } };
}

export interface YouTubePagedResponse<T> {
    items?: T[];
    nextPageToken?: string;
}

export interface YouTubeCommentSnippet {
    authorDisplayName?: string;
    textDisplay?: string;
    likeCount?: number;
    publishedAt?: string;
}

export interface YouTubeCommentThreadItem {
    id?: string;
    snippet?: { topLevelComment?: { snippet?: YouTubeCommentSnippet } };
}

export interface YouTubeComment {
    id: string;
    author: string;
    text: string;
    likeCount: number;
    publishedAt: string;
}

export interface YouTubeTrack {
    id: string;
    videoId: string;
    uri: string;
    title: string;
    artist: string;
    image: string;
    durationMs: number;
    duration: string;
}

export interface YouTubeLibraryPlaylistItem {
    id: string;
    kind: "playlist";
    playlistId: string;
    title: string;
    artist: string;
    image: string;
    trackCount: number;
}

export interface YouTubeLibraryTrackItem extends YouTubeTrack {
    kind: "track";
}

export type YouTubeLibraryItem = YouTubeLibraryPlaylistItem | YouTubeLibraryTrackItem;
