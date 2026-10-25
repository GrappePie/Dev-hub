// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { exchangeSoundcloudToken } from "../../server/soundcloudToken";

const env = { SOUNDCLOUD_CLIENT_ID: "public", SOUNDCLOUD_CLIENT_SECRET: "server-only-test", SOUNDCLOUD_REDIRECT_URI: "https://example.test/" };

describe("SoundCloud OAuth server boundary", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("exchanges the authorization code with PKCE and server credentials", async () => {
        const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: "token" })));
        vi.stubGlobal("fetch", upstream);
        await expect(exchangeSoundcloudToken({ grant_type: "authorization_code", code: "code", code_verifier: "verifier", redirect_uri: env.SOUNDCLOUD_REDIRECT_URI }, env)).resolves.toEqual({ access_token: "token" });
        const body = upstream.mock.calls[0][1].body as URLSearchParams;
        expect(body.get("client_secret")).toBe("server-only-test");
        expect(body.get("code_verifier")).toBe("verifier");
    });

    it("rejects missing PKCE and a mismatched redirect before contacting SoundCloud", async () => {
        const upstream = vi.fn();
        vi.stubGlobal("fetch", upstream);
        await expect(exchangeSoundcloudToken({ grant_type: "authorization_code", code: "code" }, env)).rejects.toThrow("code_verifier");
        await expect(exchangeSoundcloudToken({ grant_type: "refresh_token", refresh_token: "refresh", redirect_uri: "https://other.test/" }, env)).rejects.toThrow("redirect_uri");
        expect(upstream).not.toHaveBeenCalled();
    });
});
