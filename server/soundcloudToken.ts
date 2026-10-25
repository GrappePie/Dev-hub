const SOUNDCLOUD_TOKEN_URL = "https://secure.soundcloud.com/oauth/token";

export interface SoundcloudTokenPayload {
    grant_type?: string;
    code?: string;
    code_verifier?: string;
    refresh_token?: string;
    redirect_uri?: string;
}

export interface SoundcloudServerEnv {
    SOUNDCLOUD_CLIENT_ID?: string;
    VITE_SOUNDCLOUD_CLIENT_ID?: string;
    SOUNDCLOUD_CLIENT_SECRET?: string;
    SOUNDCLOUD_REDIRECT_URI?: string;
}

export class SoundcloudTokenError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
    }
}

const requiredString = (value: unknown, field: string) => {
    if (typeof value !== "string" || !value.trim()) {
        throw new SoundcloudTokenError(`Missing ${field}`, 400);
    }
    return value.trim();
};

export const exchangeSoundcloudToken = async (
    payload: SoundcloudTokenPayload,
    env: SoundcloudServerEnv,
) => {
    const clientId = requiredString(
        env.SOUNDCLOUD_CLIENT_ID || env.VITE_SOUNDCLOUD_CLIENT_ID,
        "server SOUNDCLOUD_CLIENT_ID or VITE_SOUNDCLOUD_CLIENT_ID",
    );
    const clientSecret = requiredString(env.SOUNDCLOUD_CLIENT_SECRET, "server SOUNDCLOUD_CLIENT_SECRET");
    const grantType = requiredString(payload.grant_type, "grant_type");

    if (grantType !== "authorization_code" && grantType !== "refresh_token") {
        throw new SoundcloudTokenError("Unsupported grant_type", 400);
    }

    const configuredRedirectUri = env.SOUNDCLOUD_REDIRECT_URI?.trim();
    const requestedRedirectUri = payload.redirect_uri?.trim();
    if (configuredRedirectUri && requestedRedirectUri && configuredRedirectUri !== requestedRedirectUri) {
        throw new SoundcloudTokenError("redirect_uri does not match server configuration", 400);
    }

    const redirectUri = configuredRedirectUri || requestedRedirectUri;
    const tokenBody = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: grantType,
    });

    if (redirectUri) tokenBody.set("redirect_uri", redirectUri);
    if (grantType === "authorization_code") {
        tokenBody.set("code", requiredString(payload.code, "code"));
        tokenBody.set("code_verifier", requiredString(payload.code_verifier, "code_verifier"));
    } else {
        tokenBody.set("refresh_token", requiredString(payload.refresh_token, "refresh_token"));
    }

    const upstream = await fetch(SOUNDCLOUD_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenBody,
    });
    const body = await upstream.text();

    if (!upstream.ok) {
        throw new SoundcloudTokenError(`SoundCloud rejected the token request (${upstream.status}): ${body}`, upstream.status);
    }

    try {
        return JSON.parse(body) as unknown;
    } catch {
        throw new SoundcloudTokenError("SoundCloud returned an invalid token response", 502);
    }
};
