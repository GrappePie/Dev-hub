import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    createMixyCode,
    formatMixyCode,
    mutateMixyRoom,
    normalizeMixyCode,
    readMixyRoom,
    type MixyControl,
    type MixyProvider,
    type MixyRoom,
    type MixySource,
    type MixyTrack,
} from "@/lib/mixy";

const MIXY_CODE_STORAGE = "dev_hub_mixy_code";
const MIXY_DEVICE_STORAGE = "dev_hub_mixy_device_id";
const MIXY_NAME_STORAGE = "dev_hub_mixy_name";

const getDeviceId = () => {
    const existing = localStorage.getItem(MIXY_DEVICE_STORAGE);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(MIXY_DEVICE_STORAGE, id);
    return id;
};

const detectDeviceName = () => {
    const userAgent = navigator.userAgent;
    if (/iPhone/i.test(userAgent)) return "iPhone";
    if (/iPad/i.test(userAgent)) return "iPad";
    if (/Android/i.test(userAgent)) return /Mobile/i.test(userAgent) ? "Android" : "Tablet Android";
    if (/Windows/i.test(userAgent)) return "PC Windows";
    if (/Macintosh/i.test(userAgent)) return "Mac";
    if (/Linux/i.test(userAgent)) return "PC Linux";
    return "Navegador";
};

interface UseMixyRoomOptions {
    providers: MixyProvider[];
    activeProvider: MixyProvider | null;
    syncOffsetMs: number | null;
}

export const useMixyRoom = ({ providers, activeProvider, syncOffsetMs }: UseMixyRoomOptions) => {
    const deviceId = useMemo(getDeviceId, []);
    const defaultName = useMemo(() => localStorage.getItem(MIXY_NAME_STORAGE) || detectDeviceName(), []);
    const [participantName, setParticipantNameState] = useState(defaultName);
    const [code, setCode] = useState("");
    const [joinCode, setJoinCodeState] = useState("");
    const [room, setRoom] = useState<MixyRoom | null>(null);
    const [ready, setReadyState] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [serverOffsetMs, setServerOffsetMs] = useState(0);
    const requestRunningRef = useRef(false);
    const lastHeartbeatRef = useRef(0);
    const codeRef = useRef("");
    const roomRef = useRef<MixyRoom | null>(null);
    const statusRef = useRef({ providers, activeProvider, syncOffsetMs, ready });

    useEffect(() => {
        roomRef.current = room;
    }, [room]);

    useEffect(() => {
        statusRef.current = { providers, activeProvider, syncOffsetMs, ready };
    }, [activeProvider, providers, ready, syncOffsetMs]);

    const rememberRoom = useCallback((nextCode: string, nextRoom: MixyRoom | null) => {
        const normalized = normalizeMixyCode(nextCode);
        codeRef.current = normalized;
        roomRef.current = nextRoom;
        setCode(normalized);
        setRoom(nextRoom);
        if (normalized) localStorage.setItem(MIXY_CODE_STORAGE, normalized);
        else localStorage.removeItem(MIXY_CODE_STORAGE);
    }, []);

    const applyResponse = useCallback((response: { room: MixyRoom; serverNow: number }, startedAt = Date.now()) => {
        const finishedAt = Date.now();
        setServerOffsetMs(response.serverNow - (startedAt + finishedAt) / 2);
        roomRef.current = response.room;
        setRoom(response.room);
        setError("");
        return response.room;
    }, []);

    const setParticipantName = useCallback((value: string) => {
        const next = value.slice(0, 40);
        setParticipantNameState(next);
        localStorage.setItem(MIXY_NAME_STORAGE, next);
    }, []);

    const setJoinCode = useCallback((value: string) => {
        setJoinCodeState(formatMixyCode(value));
    }, []);

    const createRoom = useCallback(async () => {
        if (!participantName.trim()) {
            setError("Escribe tu nombre antes de crear la sala.");
            return;
        }
        setBusy(true);
        setError("");
        try {
            for (let attempt = 0; attempt < 4; attempt += 1) {
                const nextCode = createMixyCode();
                try {
                    const startedAt = Date.now();
                    const response = await mutateMixyRoom("create", nextCode, deviceId, participantName, { providers, ready });
                    applyResponse(response, startedAt);
                    rememberRoom(nextCode, response.room);
                    setJoinCodeState(formatMixyCode(nextCode));
                    return;
                } catch (requestError) {
                    if (requestError instanceof Error && requestError.message.includes("ocupado")) continue;
                    throw requestError;
                }
            }
            throw new Error("No se pudo reservar un codigo Mixy.");
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "No se pudo crear la sala.");
        } finally {
            setBusy(false);
        }
    }, [applyResponse, deviceId, participantName, providers, ready, rememberRoom]);

    const joinRoom = useCallback(async () => {
        const normalized = normalizeMixyCode(joinCode);
        if (normalized.length !== 16 || !participantName.trim()) {
            setError("Escribe tu nombre y el codigo completo.");
            return;
        }
        setBusy(true);
        setError("");
        try {
            const startedAt = Date.now();
            const response = await mutateMixyRoom("join", normalized, deviceId, participantName, { providers, ready });
            applyResponse(response, startedAt);
            rememberRoom(normalized, response.room);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "No se pudo entrar a la sala.");
        } finally {
            setBusy(false);
        }
    }, [applyResponse, deviceId, joinCode, participantName, providers, ready, rememberRoom]);

    const disconnect = useCallback(() => {
        const activeCode = codeRef.current;
        if (activeCode) {
            void mutateMixyRoom("leave", activeCode, deviceId, participantName).catch(() => undefined);
        }
        rememberRoom("", null);
        setJoinCodeState("");
        setReadyState(false);
        setError("");
    }, [deviceId, participantName, rememberRoom]);

    const mutate = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
        if (!codeRef.current) return null;
        try {
            const status = statusRef.current;
            const startedAt = Date.now();
            const response = await mutateMixyRoom(action, codeRef.current, deviceId, participantName, {
                providers: status.providers,
                ready: status.ready,
                activeProvider: status.activeProvider,
                syncOffsetMs: status.syncOffsetMs,
                ...payload,
            });
            return applyResponse(response, startedAt);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Mixy no pudo completar la operacion.");
            return null;
        }
    }, [applyResponse, deviceId, participantName]);

    const setReady = useCallback((value: boolean) => {
        setReadyState(value);
        statusRef.current = { ...statusRef.current, ready: value };
        void mutate("heartbeat", { ready: value });
    }, [mutate]);

    const addTrack = useCallback((track: MixyTrack) => mutate("add-track", { track }), [mutate]);
    const removeTrack = useCallback((trackId: string) => mutate("remove-track", { trackId }), [mutate]);
    const control = useCallback((command: MixyControl) => mutate("control", { control: command }), [mutate]);
    const copyCode = useCallback(async () => {
        if (!codeRef.current) return;
        await navigator.clipboard.writeText(formatMixyCode(codeRef.current));
    }, []);

    useEffect(() => {
        const storedCode = normalizeMixyCode(localStorage.getItem(MIXY_CODE_STORAGE) || "");
        if (storedCode.length !== 16) return;
        let cancelled = false;
        const startedAt = Date.now();
        void readMixyRoom(storedCode)
            .then((response) => {
                if (cancelled) return;
                applyResponse(response, startedAt);
                rememberRoom(storedCode, response.room);
                setJoinCodeState(formatMixyCode(storedCode));
                const participant = response.room.participants.find((entry) => entry.id === deviceId);
                setReadyState(participant?.ready === true);
            })
            .catch(() => {
                if (!cancelled) rememberRoom("", null);
            });
        return () => { cancelled = true; };
    }, [applyResponse, deviceId, rememberRoom]);

    useEffect(() => {
        if (!code) return;
        let cancelled = false;
        const synchronize = async () => {
            if (requestRunningRef.current) return;
            requestRunningRef.current = true;
            const startedAt = Date.now();
            try {
                if (Date.now() - lastHeartbeatRef.current >= 5_000) {
                    lastHeartbeatRef.current = Date.now();
                    await mutate("heartbeat");
                } else {
                    const response = await readMixyRoom(codeRef.current);
                    if (!cancelled) applyResponse(response, startedAt);
                }
            } catch (requestError) {
                if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Se perdio la conexion con Mixy.");
            } finally {
                requestRunningRef.current = false;
            }
        };
        void synchronize();
        const interval = window.setInterval(() => void synchronize(), 750);
        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [applyResponse, code, mutate]);

    const participant = room?.participants.find((entry) => entry.id === deviceId) || null;
    const activeTrack = room && room.playback.queueIndex >= 0 ? room.queue[room.playback.queueIndex] || null : null;

    return {
        code,
        formattedCode: formatMixyCode(code),
        joinCode,
        setJoinCode,
        room,
        participant,
        participantName,
        setParticipantName,
        deviceId,
        ready,
        isHost: participant?.isHost === true,
        activeTrack,
        serverOffsetMs,
        busy,
        error,
        createRoom,
        joinRoom,
        disconnect,
        copyCode,
        setReady,
        addTrack,
        removeTrack,
        control,
    };
};

export type MixyRoomController = ReturnType<typeof useMixyRoom>;

export default useMixyRoom;
