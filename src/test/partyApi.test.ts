// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import connectHandler from "../../api/connect";
import mixyHandler from "../../api/mixy";
import type { MixyRoomResponse } from "@/lib/mixy";
import type { ConnectSessionState } from "@/lib/youtubeConnect";

// Only storage is substituted: requests run through the production API handlers.
const { records } = vi.hoisted(() => ({ records: new Map<string, unknown>() }));
vi.mock("@upstash/redis", () => ({ Redis: class {
    async get(key: string) { return structuredClone(records.get(key) ?? null); }
    async set(key: string, value: unknown, options?: { nx?: boolean }) {
        if (options?.nx && records.has(key)) return null;
        records.set(key, structuredClone(value));
        return "OK";
    }
    async eval(_script: string, keys: string[], args: string[]) {
        if (records.get(keys[0]) !== args[0]) return 0;
        records.delete(keys[0]);
        return 1;
    }
} }));

const response = () => {
    const result = { code: 200, body: undefined as unknown, headers: {} as Record<string, string>,
        status(code: number) { this.code = code; return this; },
        json(body: unknown) { this.body = body; },
        setHeader(name: string, value: string) { this.headers[name] = value; },
    };
    return result;
};
const code = "ABCDEFGHJKLMNPQR";
const host = "host-device-12345";
const guest = "guest-device-12345";

describe("Mixy and Connect API integration", () => {
    beforeEach(() => {
        records.clear();
        vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://storage.example.test");
        vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test");
    });
    afterEach(() => vi.unstubAllEnvs());

    it("creates a Mixy room, joins a second device and preserves a paused queue", async () => {
        const post = async (body: object) => {
            const res = response();
            await mixyHandler({ method: "POST", body: { code, deviceId: host, ...body } }, res);
            expect(res.code).toBeLessThan(300);
            return (res.body as MixyRoomResponse).room;
        };
        const created = await post({ action: "create", providers: ["youtube"] });
        expect(created.playback.isPlaying).toBe(false);
        const joined = await post({ action: "join", deviceId: guest, ready: true });
        expect(joined.participants).toHaveLength(2);
        const queued = await post({ action: "add-track", track: {
            id: "track", title: "Song", preferredProvider: "youtube", durationMs: 120000,
            sources: { youtube: { provider: "youtube", id: "abc12345678", uri: "https://www.youtube.com/watch?v=abc12345678", title: "Song", durationMs: 120000 } },
        } });
        expect(queued.queue).toHaveLength(1);
        expect(queued.playback.isPlaying).toBe(false);
        expect((await post({ action: "control", control: { type: "play" } })).playback.isPlaying).toBe(true);
        expect((await post({ action: "control", control: { type: "pause" } })).playback.isPlaying).toBe(false);
        const read = response();
        await mixyHandler({ method: "GET", query: { code } }, read);
        expect(read.code).toBe(200);
        expect((read.body as MixyRoomResponse).room.queue).toHaveLength(1);
        expect(read.headers["Cache-Control"]).toContain("no-store");
    });

    it("hands a Connect queue from one device to another without losing the snapshot", async () => {
        const track = { id: "yt-abc12345678", videoId: "abc12345678", uri: "https://www.youtube.com/watch?v=abc12345678", title: "Song", artist: "Band", image: "", durationMs: 120000, duration: "2:00" };
        const created = response();
        await connectHandler({ method: "POST", body: { action: "create", code, deviceId: host, snapshot: {
            track, queue: [track], queueIndex: 0, positionMs: 10000, durationMs: 120000, isPlaying: false, volume: 0.6,
        } } }, created);
        expect(created.code).toBe(201);
        const claimed = response();
        await connectHandler({ method: "POST", body: { action: "claim", code, deviceId: guest, deviceName: "Guest" } }, claimed);
        expect(claimed.code).toBe(200);
        expect(claimed.body).toMatchObject({ activeDeviceId: guest, positionMs: 10000, isPlaying: false, queue: [track] });
        const read = response();
        await connectHandler({ method: "GET", query: { code } }, read);
        expect((read.body as ConnectSessionState).activeDeviceId).toBe(guest);
    });
});
