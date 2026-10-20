import { clamp01 } from "@/lib/format";

/** Minimal key/value persistence contract so hooks don't depend on `localStorage` directly. */
export interface KeyValueStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

const resolveLocalStorage = (): Storage | null => {
    try {
        return typeof window === "undefined" ? null : window.localStorage;
    } catch {
        return null;
    }
};

/**
 * Shared `localStorage` adapter. Access is resolved lazily and failures
 * (privacy mode, quota exceeded, disabled storage) degrade to no-ops.
 */
export const browserStorage: KeyValueStorage = {
    getItem: (key) => {
        try {
            return resolveLocalStorage()?.getItem(key) ?? null;
        } catch {
            return null;
        }
    },
    setItem: (key, value) => {
        try {
            resolveLocalStorage()?.setItem(key, value);
        } catch {
            // Storage unavailable or full: persistence is best-effort.
        }
    },
    removeItem: (key) => {
        try {
            resolveLocalStorage()?.removeItem(key);
        } catch {
            // Storage unavailable: nothing to remove.
        }
    },
};

/** Persisted 0-1 volume level. Invalid or missing values fall back to `fallback`. */
export const createStoredVolume = (key: string, fallback = 0.5, storage: KeyValueStorage = browserStorage) => ({
    read: () => {
        const raw = storage.getItem(key);
        const parsed = raw ? Number(raw) : fallback;
        if (!Number.isFinite(parsed)) return fallback;
        return clamp01(parsed);
    },
    write: (value: number) => storage.setItem(key, String(value)),
});

export interface StoredTokens {
    accessToken: string | null;
    refreshToken: string | null;
    /** Epoch milliseconds; 0 when unknown. */
    expiresAt: number;
}

export interface TokenStoreKeys {
    accessToken: string;
    expiresAt: string;
    refreshToken?: string;
    /** Extra keys wiped together with the tokens (OAuth state, PKCE verifier, profile cache...). */
    alsoClear?: readonly string[];
}

export interface SaveTokensInput {
    accessToken: string;
    expiresAt: number;
    /** `undefined` keeps the stored refresh token, `null` removes it, a string replaces it. */
    refreshToken?: string | null;
}

export interface TokenStore {
    read(): StoredTokens;
    save(tokens: SaveTokensInput): void;
    clear(): void;
}

export const createTokenStore = (keys: TokenStoreKeys, storage: KeyValueStorage = browserStorage): TokenStore => ({
    read: () => ({
        accessToken: storage.getItem(keys.accessToken),
        refreshToken: keys.refreshToken ? storage.getItem(keys.refreshToken) : null,
        expiresAt: Number(storage.getItem(keys.expiresAt) || 0),
    }),
    save: ({ accessToken, expiresAt, refreshToken }) => {
        storage.setItem(keys.accessToken, accessToken);
        storage.setItem(keys.expiresAt, String(expiresAt));
        if (!keys.refreshToken || refreshToken === undefined) return;
        if (refreshToken) storage.setItem(keys.refreshToken, refreshToken);
        else storage.removeItem(keys.refreshToken);
    },
    clear: () => {
        const allKeys = [keys.accessToken, keys.expiresAt, keys.refreshToken, ...(keys.alsoClear ?? [])];
        allKeys.forEach((key) => {
            if (key) storage.removeItem(key);
        });
    },
});
