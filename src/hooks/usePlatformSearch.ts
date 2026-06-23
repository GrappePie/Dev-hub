import { useEffect } from "react";
import type useSpotifyPlayer from "@/hooks/useSpotifyPlayer";
import type useSoundcloudPlayer from "@/hooks/useSoundcloudPlayer";
import type useYoutubePlayer from "@/hooks/useYoutubePlayer";

type SpotifyPlayer = ReturnType<typeof useSpotifyPlayer>;
type SoundcloudPlayer = ReturnType<typeof useSoundcloudPlayer>;
type YoutubePlayer = ReturnType<typeof useYoutubePlayer>;

interface UsePlatformSearchParams {
    searchQuery: string;
    isLoggedIn: boolean;
    isSoundcloudMode: boolean;
    isYouTubeMode: boolean;
    spotify: SpotifyPlayer;
    soundcloud: SoundcloudPlayer;
    youtube: YoutubePlayer;
}

export function usePlatformSearch({
    searchQuery,
    isLoggedIn,
    isSoundcloudMode,
    isYouTubeMode,
    spotify,
    soundcloud,
    youtube,
}: UsePlatformSearchParams) {
    useEffect(() => {
        if (!isLoggedIn) return;
        const query = searchQuery.trim();
        if (!query) {
            spotify.clearSearchResults();
            return;
        }
        const timer = setTimeout(() => {
            void spotify.searchCatalog(query);
        }, 300);
        return () => clearTimeout(timer);
    }, [isLoggedIn, searchQuery, spotify.clearSearchResults, spotify.searchCatalog]);

    useEffect(() => {
        if (!isSoundcloudMode) return;
        const query = searchQuery.trim();
        if (!query) {
            soundcloud.clearSearchResults();
            return;
        }
        const timer = setTimeout(() => {
            void soundcloud.searchCatalog(query);
        }, 300);
        return () => clearTimeout(timer);
    }, [isSoundcloudMode, searchQuery, soundcloud.clearSearchResults, soundcloud.searchCatalog]);

    useEffect(() => {
        if (!isYouTubeMode) return;
        const query = searchQuery.trim();
        if (!query) {
            youtube.clearSearchResults();
            return;
        }
        const timer = setTimeout(() => {
            void youtube.searchCatalog(query);
        }, 300);
        return () => clearTimeout(timer);
    }, [isYouTubeMode, searchQuery, youtube.clearSearchResults, youtube.searchCatalog]);
}
