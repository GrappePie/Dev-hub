import { describe, expect, it } from "vitest";
import fallbackAlbumArt from "@/assets/album-art-placeholder.svg";
import { findBestArtistMatch, mapArtistData, mapTrack } from "./mappers";

describe("findBestArtistMatch", () => {
    const artists = [
        { id: "1", name: "Other" },
        { id: "2", name: "Daft Punk Tribute" },
        { id: "3", name: "  daft punk " },
    ];

    it("prefers an exact (case/whitespace-insensitive) match, then a prefix match, then the first result", () => {
        expect(findBestArtistMatch(artists, "Daft Punk").id).toBe("3");
        expect(findBestArtistMatch(artists, "daft").id).toBe("2");
        expect(findBestArtistMatch(artists, "Unknown").id).toBe("1");
    });
});

describe("mapTrack", () => {
    it("returns null without a track and applies fallbacks for missing metadata", () => {
        expect(mapTrack(null)).toBeNull();
        expect(
            mapTrack({
                id: "t1",
                uri: "spotify:track:t1",
                name: "",
                duration_ms: 61000,
                artists: [{ name: "No Id" }, { id: "a2", name: "With Id" }],
            })
        ).toEqual({
            id: "t1",
            uri: "spotify:track:t1",
            title: "Sin título",
            artist: "No Id, With Id",
            artistNames: ["No Id", "With Id"],
            durationMs: 61000,
            duration: "1:01",
            albumArt: fallbackAlbumArt,
            externalUrl: undefined,
            artistId: "a2",
        });
        expect(mapTrack({ id: "t2", uri: "spotify:track:t2", name: "Song", duration_ms: 0 })).toMatchObject({
            artist: "Sin artista",
            artistNames: ["Sin artista"],
            artistId: undefined,
        });
    });
});

describe("mapArtistData", () => {
    it("maps the artist with artwork fallbacks and keeps only the top 10 tracks", () => {
        const filler = Array.from({ length: 10 }, (_, index) => ({ id: `f${index}`, uri: `spotify:track:f${index}` }));
        const data = mapArtistData({ id: "a1", name: "Artist", followers: { total: 5 }, genres: ["pop"] }, [
            {
                id: "t1",
                uri: "spotify:track:t1",
                name: "Song",
                duration_ms: 125000,
                artists: [{ name: "A" }, { name: "B" }],
                album: { images: [{ url: "large" }, { url: "medium" }, { url: "small" }] },
            },
            { id: "t2", uri: "spotify:track:t2", album: { images: [{ url: "large-only" }] } },
            ...filler,
        ]);

        expect(data).toMatchObject({ id: "a1", name: "Artist", image: fallbackAlbumArt, followers: 5, genres: ["pop"] });
        expect(data.topTracks).toHaveLength(10);
        expect(data.topTracks[0]).toEqual({
            id: "t1",
            uri: "spotify:track:t1",
            title: "Song",
            artist: "A, B",
            duration: "2:05",
            albumArt: "small",
        });
        expect(data.topTracks[1]).toMatchObject({ title: "Sin título", artist: "Sin artista", duration: "0:00", albumArt: "large-only" });
        expect(data.topTracks[9].id).toBe("f7");
    });
});
