import { afterEach, describe, expect, it, vi } from "vitest";

describe("SoundCloud server token exchange", () => {
    afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

    it("sends PKCE to the same-origin server without a client secret", async () => {
        vi.stubEnv("VITE_SOUNDCLOUD_CLIENT_ID", "public-id");
        vi.resetModules();
        const { requestSoundcloudToken: request } = await import("./auth");
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: "test" })));
        vi.stubGlobal("fetch", fetchMock);
        await request({ grant_type: "authorization_code", code: "code", code_verifier: "verifier" });
        expect(fetchMock.mock.calls[0][0]).toBe("/api/soundcloud/token");
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body).toMatchObject({ code: "code", code_verifier: "verifier" });
        expect(body).not.toHaveProperty("client_secret");
    });
});
