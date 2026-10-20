import { useEffect } from "react";
import type { CatalogSearch } from "@/types/player";

export const SEARCH_DEBOUNCE_MS = 300;

/** Runs a debounced catalog search on one provider while it is the active one. */
export function useDebouncedCatalogSearch(provider: CatalogSearch, enabled: boolean, searchQuery: string) {
    const { searchCatalog, clearSearchResults } = provider;

    useEffect(() => {
        if (!enabled) return;
        const query = searchQuery.trim();
        if (!query) {
            clearSearchResults();
            return;
        }
        const timer = setTimeout(() => {
            void searchCatalog(query);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [enabled, searchQuery, clearSearchResults, searchCatalog]);
}

interface UsePlatformSearchParams {
    searchQuery: string;
    isLoggedIn: boolean;
    isSoundcloudMode: boolean;
    isYouTubeMode: boolean;
    spotify: CatalogSearch;
    soundcloud: CatalogSearch;
    youtube: CatalogSearch;
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
    useDebouncedCatalogSearch(spotify, isLoggedIn, searchQuery);
    useDebouncedCatalogSearch(soundcloud, isSoundcloudMode, searchQuery);
    useDebouncedCatalogSearch(youtube, isYouTubeMode, searchQuery);
}
