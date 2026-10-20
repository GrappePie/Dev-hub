export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const extractTokenErrorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "unknown_error";
};

/** Reads `error.message` / `error.reason` from a Web API error body without consuming the original response. */
export const extractSpotifyErrorMessage = async (response: Response) => {
    try {
        const raw = await response.clone().text();
        if (!raw) return "";
        const parsed = JSON.parse(raw) as { error?: { message?: string; reason?: string } };
        return parsed?.error?.message || parsed?.error?.reason || "";
    } catch {
        return "";
    }
};
