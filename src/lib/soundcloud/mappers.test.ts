import { describe, expect, it } from "vitest";
import { mapArtistData, mapPlayableTracks, mapSearchResults, normalizeSoundcloudUrl } from "./mappers";

describe("normalizeSoundcloudUrl", () => {
    it("upgrades to https, strips query params and rejects non-SoundCloud links", () => {
        expect(normalizeSoundcloudUrl(" http://soundcloud.com/artist/song?utm_source=x ")).toBe("https://soundcloud.com/artist/song");
        expect(normalizeSoundcloudUrl("soundcloud.com/artist/song")).toBe("https://soundcloud.com/artist/song");
        expect(normalizeSoundcloudUrl("https://on.soundcloud.com/abc")).toBe("https://on.soundcloud.com/abc");
        expect(normalizeSoundcloudUrl("https://youtube.com/watch?v=1")).toBe("");
    });
});

describe("mapSearchResults", () => {
    it("maps search hits with list labels and fallbacks, skipping items without permalink", () => {
        const results = mapSearchResults({
            collection: [
                { id: "7", permalink_url: "https://soundcloud.com/a/t", user: { avatar_url: "avatar.jpg" } },
                { id: 8, title: "Sin enlace" },
            ],
        });

        expect(results).toEqual([
            {
                id: 7,
                title: "Track",
                permalink_url: "https://soundcloud.com/a/t",
                artwork_url: "avatar.jpg",
                track_count: 1,
                subtitle: "Busqueda",
                kind: "track",
                artist: "SoundCloud",
                duration_ms: 0,
            },
        ]);
    });
});

describe("mapPlayableTracks", () => {
    it("maps queue entries without list labels", () => {
        const tracks = mapPlayableTracks([
            { id: 3, title: "Song", permalink_url: "https://soundcloud.com/a/s", duration: 1000, user: { username: "Artist" } },
        ]);

        expect(tracks).toEqual([
            {
                id: 3,
                title: "Song",
                permalink_url: "https://soundcloud.com/a/s",
                artwork_url: null,
                kind: "track",
                artist: "Artist",
                duration_ms: 1000,
            },
        ]);
    });
});

describe("mapArtistData", () => {
    const user = { id: 9, username: "dj", avatar_url: "https://i1.sndcdn.com/avatar-large.jpg", followers_count: 5 };

    it("upscales artwork and falls back to the artist for missing track fields", () => {
        const artist = mapArtistData(user, [{ id: 1, duration: 61000 }]);

        expect(artist).toMatchObject({ id: "9", name: "dj", image: "https://i1.sndcdn.com/avatar-t500x500.jpg", followers: 5 });
        expect(artist.topTracks).toEqual([
            { id: "1", uri: "", title: "Sin título", artist: "dj", duration: "1:01", albumArt: "https://i1.sndcdn.com/avatar-t500x500.jpg" },
        ]);
    });

    it("ignores non-array track payloads", () => {
        expect(mapArtistData(user, { collection: [] }).topTracks).toEqual([]);
    });
});
