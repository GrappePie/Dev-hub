import { afterEach, describe, expect, it, vi } from "vitest";
import {
    extrapolateConnectPosition,
    formatConnectCode,
    normalizeConnectCode,
    publishConnectSession,
    sendConnectCommand,
    type ConnectPlaybackSnapshot,
    type ConnectSessionState,
} from "@/lib/youtubeConnect";

const snapshot: ConnectPlaybackSnapshot = {
    track: null,
    queue: [],
    queueIndex: -1,
    positionMs: 0,
    durationMs: 0,
    isPlaying: false,
    shuffleMode: "off",
    repeatMode: 0,
    volume: 0.7,
};

afterEach(() => vi.restoreAllMocks());

describe("YouTube Dev Hub Connect", () => {
    it("normaliza y presenta códigos de emparejamiento", () => {
        expect(normalizeConnectCode("abcd-efgh 2345-6789-extra")).toBe("ABCDEFGH23456789");
        expect(formatConnectCode("ABCDEFGH23456789")).toBe("ABCD-EFGH-2345-6789");
    });

    it("extrapola la posición únicamente durante reproducción", () => {
        const state = {
            positionMs: 15_000,
            durationMs: 20_000,
            isPlaying: true,
            updatedAt: 1_000,
        } as ConnectSessionState;
        expect(extrapolateConnectPosition(state, 4_000)).toBe(18_000);
        expect(extrapolateConnectPosition({ ...state, isPlaying: false }, 4_000)).toBe(15_000);
        expect(extrapolateConnectPosition(state, 20_000)).toBe(20_000);
    });

    it("envía comandos sin transferir el dispositivo activo", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
            ...snapshot,
            version: 2,
            activeDeviceId: "android-device",
            activeDeviceName: "Android",
            updatedAt: 1,
        }), { status: 202, headers: { "Content-Type": "application/json" } }));

        await sendConnectCommand("ABCDEFGH23456789", "windows-device", "PC Windows", { type: "next" });

        const request = fetchMock.mock.calls[0];
        expect(request[0]).toBe("/api/connect");
        expect(JSON.parse(String(request[1]?.body))).toMatchObject({
            action: "command",
            deviceId: "windows-device",
            command: { type: "next" },
        });
    });

    it("confirma el comando procesado al publicar el nuevo estado", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
            ...snapshot,
            version: 3,
            activeDeviceId: "android-device",
            activeDeviceName: "Android",
            updatedAt: 2,
        }), { status: 200, headers: { "Content-Type": "application/json" } }));

        await publishConnectSession("ABCDEFGH23456789", "android-device", "Android", snapshot, "command-123");

        expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
            action: "publish",
            ackCommandId: "command-123",
            snapshot: { volume: 0.7 },
        });
    });
});
