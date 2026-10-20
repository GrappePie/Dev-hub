import { afterEach, describe, expect, it, vi } from "vitest";
import { browserStorage, createStoredVolume, createTokenStore, type KeyValueStorage } from "./storage";

const createMemoryStorage = (initial: Record<string, string> = {}) => {
    const data = new Map(Object.entries(initial));
    const storage: KeyValueStorage = {
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => {
            data.set(key, value);
        },
        removeItem: (key) => {
            data.delete(key);
        },
    };
    return { data, storage };
};

const KEYS = { accessToken: "at", expiresAt: "exp", refreshToken: "rt", alsoClear: ["state"] };

describe("createTokenStore", () => {
    it("reads missing tokens as empty", () => {
        const { storage } = createMemoryStorage();
        expect(createTokenStore(KEYS, storage).read()).toEqual({ accessToken: null, refreshToken: null, expiresAt: 0 });
    });

    it("keeps, replaces or removes the refresh token depending on the value passed", () => {
        const { data, storage } = createMemoryStorage({ rt: "old" });
        const store = createTokenStore(KEYS, storage);

        store.save({ accessToken: "a1", expiresAt: 100 });
        expect(store.read()).toEqual({ accessToken: "a1", refreshToken: "old", expiresAt: 100 });

        store.save({ accessToken: "a2", expiresAt: 200, refreshToken: "new" });
        expect(store.read().refreshToken).toBe("new");

        store.save({ accessToken: "a3", expiresAt: 300, refreshToken: null });
        expect(data.has("rt")).toBe(false);
    });

    it("never writes a refresh token for providers without a refresh key", () => {
        const { data, storage } = createMemoryStorage();
        createTokenStore({ accessToken: "at", expiresAt: "exp" }, storage).save({ accessToken: "a", expiresAt: 1, refreshToken: "r" });
        expect([...data.keys()]).toEqual(["at", "exp"]);
    });

    it("clears the tokens together with the extra keys only", () => {
        const { data, storage } = createMemoryStorage({ at: "a", exp: "1", rt: "r", state: "s", other: "keep" });
        createTokenStore(KEYS, storage).clear();
        expect([...data.keys()]).toEqual(["other"]);
    });
});

describe("createStoredVolume", () => {
    it("falls back on missing or invalid values and clamps to 0-1", () => {
        const { storage } = createMemoryStorage();
        const volume = createStoredVolume("vol", 0.5, storage);
        expect(volume.read()).toBe(0.5);

        storage.setItem("vol", "abc");
        expect(volume.read()).toBe(0.5);

        volume.write(0);
        expect(volume.read()).toBe(0);

        volume.write(3);
        expect(volume.read()).toBe(1);
    });
});

describe("browserStorage", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("degrades to a no-op when localStorage throws", () => {
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new DOMException("full", "QuotaExceededError");
        });
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new DOMException("denied", "SecurityError");
        });

        expect(() => browserStorage.setItem("k", "v")).not.toThrow();
        expect(browserStorage.getItem("k")).toBeNull();
    });
});
