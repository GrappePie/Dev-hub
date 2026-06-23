import { useCallback, useEffect, useRef, useState } from "react";
import { getInterceptedAnalyser } from "@/lib/audioInterceptor";

export type AudioPlatform = "spotify" | "soundcloud" | "youtube" | null;

export const useAudioAnalyser = (platform: AudioPlatform) => {
    const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
    const ctxRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [captureActive, setCaptureActive] = useState(false);
    const captureActiveRef = useRef(false); // ref so polling closure sees latest value
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);

    // Keep captureActiveRef in sync
    useEffect(() => { captureActiveRef.current = captureActive; }, [captureActive]);

    // Spotify / SoundCloud: poll for intercepted analyser.
    // Stop clearing the analyser when captureActive — getDisplayMedia capture takes precedence.
    useEffect(() => {
        if (platform !== "spotify" && platform !== "soundcloud") {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            if (platform === null && !captureActiveRef.current) {
                analyserRef.current = null;
                setAnalyser(null);
            }
            return;
        }

        pollRef.current = setInterval(() => {
            // If getDisplayMedia capture is active, let it own the analyser — don't poll
            if (captureActiveRef.current) return;

            const a = getInterceptedAnalyser();
            if (a && a !== analyserRef.current) {
                analyserRef.current = a;
                setAnalyser(a);
            } else if (!a && analyserRef.current) {
                analyserRef.current = null;
                setAnalyser(null);
            }
        }, 300);

        return () => {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        };
    }, [platform]);

    // Clean up YouTube capture when switching platforms
    useEffect(() => {
        if (platform !== "youtube") {
            streamRef.current?.getTracks().forEach((t) => t.stop());
            if (ctxRef.current && ctxRef.current.state !== "closed") void ctxRef.current.close();
            ctxRef.current = null;
            streamRef.current = null;
            if (captureActiveRef.current) { setCaptureActive(false); captureActiveRef.current = false; }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [platform]);

    const requestYouTubeCapture = useCallback(async () => {
        if (captureActiveRef.current) return;
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                audio: true,
                video: { width: 1, height: 1, frameRate: 1 } as MediaTrackConstraints,
            });
            stream.getVideoTracks().forEach((t) => t.stop());
            const audioTracks = stream.getAudioTracks();
            if (!audioTracks.length) { stream.getTracks().forEach((t) => t.stop()); return; }

            const ctx = new AudioContext();
            (ctx as AudioContext & { __devhubOwned?: boolean }).__devhubOwned = true;
            const source = ctx.createMediaStreamSource(stream);
            const node = ctx.createAnalyser();
            node.fftSize = 1024;
            node.smoothingTimeConstant = 0.85;
            source.connect(node);

            ctxRef.current = ctx;
            streamRef.current = stream;
            analyserRef.current = node;
            setAnalyser(node);
            setCaptureActive(true);
            captureActiveRef.current = true;

            audioTracks[0].addEventListener("ended", () => {
                analyserRef.current = null;
                setAnalyser(null);
                setCaptureActive(false);
                captureActiveRef.current = false;
            });
        } catch {
            // User cancelled or permission denied
        }
    }, []);

    return { analyser, ytCaptureActive: captureActive, requestYouTubeCapture };
};
