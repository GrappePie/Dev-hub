import { useEffect, useRef } from "react";

/** Off-DOM audio element used to play track previews (`preview_url`) outside the Web Playback SDK. */
export const useSpotifyPreviewAudio = () => {
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        previewAudioRef.current = new Audio();
        return () => {
            if (!previewAudioRef.current) return;
            previewAudioRef.current.pause();
            previewAudioRef.current.src = "";
        };
    }, []);

    return previewAudioRef;
};
