interface SmartShuffleCandidate {
    id: string;
    uri?: string;
}

export const getSpotifyRecommendationsPath = (trackId: string, limit = 5) =>
    `/recommendations?seed_tracks=${encodeURIComponent(trackId)}&limit=${encodeURIComponent(limit)}`;

export const getSpotifyArtistTopTracksPath = (artistId: string, market = "ES") =>
    `/artists/${encodeURIComponent(artistId)}/top-tracks?market=${encodeURIComponent(market)}`;

export const getSmartShuffleCandidate = (
    tracks: SmartShuffleCandidate[],
    currentTrackId: string,
    random = Math.random
): SmartShuffleCandidate | null => {
    const candidates = tracks.filter((track) => track.id !== currentTrackId && !!track.uri);
    if (!candidates.length) return null;

    return candidates[Math.floor(random() * candidates.length)];
};
