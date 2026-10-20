import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEARCH_DEBOUNCE_MS, useDebouncedCatalogSearch } from "./usePlatformSearch";

const createProvider = () => ({
    searchCatalog: vi.fn(() => Promise.resolve()),
    clearSearchResults: vi.fn(),
});

describe("useDebouncedCatalogSearch", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("searches the trimmed query once the debounce window elapses", () => {
        const provider = createProvider();
        renderHook(() => useDebouncedCatalogSearch(provider, true, "  daft punk  "));

        vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
        expect(provider.searchCatalog).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(provider.searchCatalog).toHaveBeenCalledTimes(1);
        expect(provider.searchCatalog).toHaveBeenCalledWith("daft punk");
    });

    it("only searches the latest query when typing inside the debounce window", () => {
        const provider = createProvider();
        const { rerender } = renderHook(({ query }) => useDebouncedCatalogSearch(provider, true, query), {
            initialProps: { query: "daft" },
        });

        vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
        rerender({ query: "daft punk" });
        vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);

        expect(provider.searchCatalog).toHaveBeenCalledTimes(1);
        expect(provider.searchCatalog).toHaveBeenCalledWith("daft punk");
    });

    it("clears results immediately for a blank query", () => {
        const provider = createProvider();
        renderHook(() => useDebouncedCatalogSearch(provider, true, "   "));

        expect(provider.clearSearchResults).toHaveBeenCalledTimes(1);
        vi.runAllTimers();
        expect(provider.searchCatalog).not.toHaveBeenCalled();
    });

    it("does nothing while the provider is not the active one", () => {
        const provider = createProvider();
        renderHook(() => useDebouncedCatalogSearch(provider, false, "daft punk"));

        vi.runAllTimers();
        expect(provider.searchCatalog).not.toHaveBeenCalled();
        expect(provider.clearSearchResults).not.toHaveBeenCalled();
    });
});
