import {
    exchangeSoundcloudToken,
    SoundcloudTokenError,
    type SoundcloudTokenPayload,
} from "../../server/soundcloudToken.js";

interface TokenApiRequest {
    method?: string;
    body?: SoundcloudTokenPayload | string;
}

interface TokenApiResponse {
    status: (code: number) => TokenApiResponse;
    json: (body: unknown) => void;
    setHeader: (name: string, value: string) => void;
}

export default async function handler(request: TokenApiRequest, response: TokenApiResponse) {
    response.setHeader("Cache-Control", "no-store");

    if (request.method !== "POST") {
        response.setHeader("Allow", "POST");
        response.status(405).json({ error: "Method not allowed" });
        return;
    }

    try {
        const payload = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
        const token = await exchangeSoundcloudToken(payload || {}, process.env);
        response.status(200).json(token);
    } catch (error) {
        const status = error instanceof SoundcloudTokenError ? error.status : 500;
        const message = error instanceof Error ? error.message : "Token exchange failed";
        response.status(status).json({ error: message });
    }
}
