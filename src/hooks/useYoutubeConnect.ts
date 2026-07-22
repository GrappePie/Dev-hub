import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import {
    claimConnectSession,
    createConnectCode,
    createConnectSession,
    extrapolateConnectPosition,
    formatConnectCode,
    normalizeConnectCode,
    publishConnectSession,
    readConnectSession,
    sendConnectCommand,
    type ConnectApiError,
    type ConnectPlaybackSnapshot,
    type ConnectRemoteCommand,
    type ConnectRemoteCommandInput,
    type ConnectSessionState,
} from "@/lib/youtubeConnect";

const CONNECT_CODE_STORAGE = "dev_hub_connect_code";
const CONNECT_DEVICE_ID_STORAGE = "dev_hub_connect_device_id";

const makeDeviceId = () => {
    const existing = localStorage.getItem(CONNECT_DEVICE_ID_STORAGE);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(CONNECT_DEVICE_ID_STORAGE, id);
    return id;
};

const detectDeviceName = () => {
    const ua = navigator.userAgent;
    if (/iPhone/i.test(ua)) return "iPhone";
    if (/iPad/i.test(ua)) return "iPad";
    if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? "Android" : "Tablet Android";
    if (/Windows/i.test(ua)) return "PC Windows";
    if (/Macintosh/i.test(ua)) return "Mac";
    if (/Linux/i.test(ua)) return "PC Linux";
    return "Navegador";
};

const getErrorPayload = (error: unknown) => {
    if (!error || typeof error !== "object") return null;
    return (error as { payload?: ConnectApiError }).payload || null;
};

interface UseYoutubeConnectOptions {
    snapshot: ConnectPlaybackSnapshot;
    onRemotePause: () => void;
    onTakeover: (state: ConnectSessionState, positionMs: number) => void;
    onRemoteState: (state: ConnectSessionState, positionMs: number) => void;
    onRemoteCommand: (command: ConnectRemoteCommand) => void | Promise<void>;
}

export const useYoutubeConnect = ({ snapshot, onRemotePause, onTakeover, onRemoteState, onRemoteCommand }: UseYoutubeConnectOptions) => {
    const deviceId = useMemo(makeDeviceId, []);
    const deviceName = useMemo(detectDeviceName, []);
    const snapshotRef = useRef(snapshot);
    const sessionRef = useRef<ConnectSessionState | null>(null);
    const codeRef = useRef("");
    const requestRunningRef = useRef(false);
    const wasActiveRef = useRef(false);
    const suspendPublishUntilRef = useRef(0);
    const processedCommandRef = useRef("");
    const pendingCommandAckRef = useRef("");

    const [code, setCode] = useState("");
    const [joinCode, setJoinCode] = useState("");
    const [session, setSession] = useState<ConnectSessionState | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        snapshotRef.current = snapshot;
    }, [snapshot]);

    const rememberSession = useCallback((nextCode: string, nextSession: ConnectSessionState | null) => {
        const normalized = normalizeConnectCode(nextCode);
        codeRef.current = normalized;
        sessionRef.current = nextSession;
        setCode(normalized);
        setSession(nextSession);
        if (normalized) localStorage.setItem(CONNECT_CODE_STORAGE, normalized);
        else localStorage.removeItem(CONNECT_CODE_STORAGE);
    }, []);

    const handleRemoteOwner = useCallback((next: ConnectSessionState) => {
        const lostControl = wasActiveRef.current && next.activeDeviceId !== deviceId;
        wasActiveRef.current = next.activeDeviceId === deviceId;
        sessionRef.current = next;
        setSession(next);
        if (lostControl) {
            onRemotePause();
            toast({
                title: `Reproducción transferida a ${next.activeDeviceName}`,
                description: "Este dispositivo quedó como control remoto.",
            });
        }
        if (next.activeDeviceId !== deviceId) {
            onRemoteState(next, extrapolateConnectPosition(next));
            return;
        }
        if (next.command && next.command.id !== processedCommandRef.current) {
            processedCommandRef.current = next.command.id;
            void Promise.resolve(onRemoteCommand(next.command))
                .then(() => {
                    pendingCommandAckRef.current = next.command?.id || "";
                })
                .catch(() => {
                    processedCommandRef.current = "";
                    setError("No se pudo ejecutar un comando remoto.");
                });
        }
    }, [deviceId, onRemoteCommand, onRemotePause, onRemoteState]);

    const createSession = useCallback(async () => {
        setBusy(true);
        setError("");
        try {
            for (let attempt = 0; attempt < 3; attempt += 1) {
                const nextCode = createConnectCode();
                try {
                    const next = await createConnectSession(nextCode, deviceId, deviceName, snapshotRef.current);
                    wasActiveRef.current = true;
                    rememberSession(nextCode, next);
                    setJoinCode(formatConnectCode(nextCode));
                    toast({ title: "Dev Hub Connect activo", description: "Introduce el código en tu otro dispositivo." });
                    return;
                } catch (requestError) {
                    const payload = getErrorPayload(requestError);
                    if (payload?.error === "Ese código ya está en uso.") continue;
                    throw requestError;
                }
            }
            throw new Error("No se pudo reservar un código único.");
        } catch (requestError) {
            const message = getErrorPayload(requestError)?.error || (requestError instanceof Error ? requestError.message : "No se pudo crear la sesión.");
            setError(message);
        } finally {
            setBusy(false);
        }
    }, [deviceId, deviceName, rememberSession]);

    const joinSession = useCallback(async () => {
        const normalized = normalizeConnectCode(joinCode);
        if (normalized.length !== 16) {
            setError("Introduce el código completo de 16 caracteres.");
            return;
        }
        setBusy(true);
        setError("");
        try {
            const next = await readConnectSession(normalized);
            wasActiveRef.current = next.activeDeviceId === deviceId;
            rememberSession(normalized, next);
            if (next.activeDeviceId === deviceId && next.track) {
                suspendPublishUntilRef.current = Date.now() + 1_800;
                onTakeover(next, extrapolateConnectPosition(next));
            } else if (next.activeDeviceId !== deviceId) {
                onRemotePause();
            }
        } catch (requestError) {
            setError(getErrorPayload(requestError)?.error || "No se encontró esa sesión.");
        } finally {
            setBusy(false);
        }
    }, [deviceId, joinCode, onRemotePause, onTakeover, rememberSession]);

    const takeOver = useCallback(async () => {
        if (!codeRef.current) return;
        setBusy(true);
        setError("");
        try {
            const next = await claimConnectSession(codeRef.current, deviceId, deviceName);
            const positionMs = extrapolateConnectPosition(next);
            suspendPublishUntilRef.current = Date.now() + 1_800;
            wasActiveRef.current = true;
            rememberSession(codeRef.current, next);
            onTakeover(next, positionMs);
            toast({ title: "Reproduciendo aquí", description: `Continuando desde ${Math.floor(positionMs / 1000)} segundos.` });
        } catch (requestError) {
            setError(getErrorPayload(requestError)?.error || "No se pudo transferir la reproducción.");
        } finally {
            setBusy(false);
        }
    }, [deviceId, deviceName, onTakeover, rememberSession]);

    const disconnect = useCallback(() => {
        wasActiveRef.current = false;
        rememberSession("", null);
        setJoinCode("");
        setError("");
    }, [rememberSession]);

    const copyCode = useCallback(async () => {
        if (!codeRef.current) return;
        await navigator.clipboard.writeText(formatConnectCode(codeRef.current));
        toast({ title: "Código copiado", description: "Pégalo en Dev Hub desde el otro dispositivo." });
    }, []);

    const sendCommand = useCallback(async (command: ConnectRemoteCommandInput) => {
        if (!codeRef.current || sessionRef.current?.activeDeviceId === deviceId) return;
        setError("");
        try {
            const next = await sendConnectCommand(codeRef.current, deviceId, deviceName, command);
            handleRemoteOwner(next);
        } catch (requestError) {
            setError(getErrorPayload(requestError)?.error || "No se pudo enviar el comando remoto.");
        }
    }, [deviceId, deviceName, handleRemoteOwner]);

    useEffect(() => {
        const storedCode = normalizeConnectCode(localStorage.getItem(CONNECT_CODE_STORAGE) || "");
        if (storedCode.length !== 16) return;
        let cancelled = false;
        void readConnectSession(storedCode)
            .then((next) => {
                if (cancelled) return;
                wasActiveRef.current = next.activeDeviceId === deviceId;
                rememberSession(storedCode, next);
                setJoinCode(formatConnectCode(storedCode));
                if (next.activeDeviceId === deviceId && next.track) {
                    suspendPublishUntilRef.current = Date.now() + 1_800;
                    onTakeover(next, extrapolateConnectPosition(next));
                } else if (next.activeDeviceId !== deviceId) {
                    onRemotePause();
                }
            })
            .catch(() => {
                if (!cancelled) rememberSession("", null);
            });
        return () => {
            cancelled = true;
        };
    }, [deviceId, onRemotePause, onTakeover, rememberSession]);

    useEffect(() => {
        if (!code || !sessionRef.current) return;

        const synchronize = async () => {
            if (requestRunningRef.current) return;
            requestRunningRef.current = true;
            try {
                const current = sessionRef.current;
                if (current?.activeDeviceId === deviceId && Date.now() >= suspendPublishUntilRef.current) {
                    const ackCommandId = pendingCommandAckRef.current;
                    const next = await publishConnectSession(codeRef.current, deviceId, deviceName, snapshotRef.current, ackCommandId);
                    if (ackCommandId && next.command?.id !== ackCommandId) pendingCommandAckRef.current = "";
                    handleRemoteOwner(next);
                } else {
                    const next = await readConnectSession(codeRef.current);
                    handleRemoteOwner(next);
                }
                setError("");
            } catch (requestError) {
                const payload = getErrorPayload(requestError);
                if (payload?.state) {
                    handleRemoteOwner(payload.state);
                } else if (payload?.error) {
                    setError(payload.error);
                }
            } finally {
                requestRunningRef.current = false;
            }
        };

        void synchronize();
        const interval = window.setInterval(() => void synchronize(), 2_000);
        return () => window.clearInterval(interval);
    }, [code, deviceId, deviceName, handleRemoteOwner]);

    return {
        code,
        formattedCode: formatConnectCode(code),
        joinCode,
        setJoinCode: (value: string) => setJoinCode(formatConnectCode(value)),
        session,
        deviceName,
        isConnected: Boolean(code && session),
        isActiveDevice: session?.activeDeviceId === deviceId,
        busy,
        error,
        createSession,
        joinSession,
        takeOver,
        disconnect,
        copyCode,
        sendCommand,
    };
};

export type YouTubeConnectController = ReturnType<typeof useYoutubeConnect>;

export default useYoutubeConnect;
