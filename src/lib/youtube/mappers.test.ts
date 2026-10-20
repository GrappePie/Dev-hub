import { describe, expect, it } from "vitest";
import fallbackAlbumArt from "@/assets/album-art-placeholder.svg";
import { getPlaylistItemVideoId, mapCommentThreads, mapPlaylists, mapVideoTracks, parseIsoDuration } from "./mappers";

describe("parseIsoDuration", () => {
    it("converts PT#H#M#S durations and returns 0 for missing or unsupported values", () => {
        expect(parseIsoDuration("PT1H2M3S")).toBe(3_723_000);
        expect(parseIsoDuration("PT4M5S")).toBe(245_000);
        expect(parseIsoDuration(undefined)).toBe(0);
        expect(parseIsoDuration("P1D")).toBe(0);
    });
});

describe("mapVideoTracks", () => {
    it("reads playlist video ids from contentDetails or resourceId and skips entries without one", () => {
        const tracks = mapVideoTracks(
            [
                {
                    contentDetails: { videoId: "abc" },
                    snippet: { title: "Song", channelTitle: "Band", thumbnails: { medium: { url: "m.jpg" } } },
                },
                { snippet: { resourceId: { videoId: "def" } } },
                { snippet: { title: "Deleted video" } },
            ],
            getPlaylistItemVideoId,
            new Map([["abc", 61_000]]),
            "Like"
        );

        expect(tracks).toEqual([
            {
                id: "yt-abc",
                videoId: "abc",
                uri: "https://www.youtube.com/watch?v=abc",
                title: "Song",
                artist: "Band",
                image: "m.jpg",
                durationMs: 61_000,
                duration: "1:01",
            },
            {
                id: "yt-def",
                videoId: "def",
                uri: "https://www.youtube.com/watch?v=def",
                title: "Like",
                artist: "YouTube",
                image: fallbackAlbumArt,
                durationMs: 0,
                duration: "0:00",
            },
        ]);
    });
});

describe("mapPlaylists", () => {
    it("drops playlists without id and applies fallbacks", () => {
        expect(mapPlaylists([{ id: "PL1", contentDetails: { itemCount: 7 } }, { snippet: { title: "No id" } }])).toEqual([
            {
                id: "yt-playlist-PL1",
                kind: "playlist",
                playlistId: "PL1",
                title: "Playlist",
                artist: "YouTube",
                image: fallbackAlbumArt,
                trackCount: 7,
            },
        ]);
    });
});

describe("mapCommentThreads", () => {
    it("keeps top-level comments with text and defaults the author", () => {
        const comments = mapCommentThreads([
            { id: "c1", snippet: { topLevelComment: { snippet: { textDisplay: "Temazo", likeCount: 3 } } } },
            { id: "c2", snippet: { topLevelComment: { snippet: { authorDisplayName: "Ana", textDisplay: "" } } } },
        ]);

        expect(comments).toEqual([{ id: "c1", author: "Anónimo", text: "Temazo", likeCount: 3, publishedAt: "" }]);
    });
});
