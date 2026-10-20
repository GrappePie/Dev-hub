import { useCallback, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { sleep } from "@/lib/spotify/http";
import { mapDevices } from "@/lib/spotify/mappers";
import type { DeviceItem, SpotifyApiRequest, SpotifyDevice, SpotifyDeviceCommand } from "@/lib/spotify/types";

interface UseSpotifyDevicesParams {
    api: SpotifyApiRequest;
}

/** Spotify Connect devices: listing, target device resolution, "device not found" recovery and playback transfer. */
export const useSpotifyDevices = ({ api }: UseSpotifyDevicesParams) => {
    const deviceIdRef = useRef<string | null>(null);
    const sdkDeviceIdRef = useRef<string | null>(null);

    const [devices, setDevices] = useState<DeviceItem[]>([]);
    const [activeDeviceName, setActiveDeviceName] = useState("Dispositivo");

    const fetchDevices = useCallback(async () => {
        const response = await api("/me/player/devices", {}, { silent: true });
        if (!response.ok) return [] as DeviceItem[];
        const data = (await response.json()) as { devices?: SpotifyDevice[] };
        const mapped = mapDevices(data.devices || []);
        setDevices(mapped);
        const selected =
            mapped.find((device) => device.isActive && !device.isRestricted) ||
            mapped.find((device) => device.id === sdkDeviceIdRef.current && !device.isRestricted) ||
            mapped.find((device) => !device.isRestricted);
        if (selected) {
            deviceIdRef.current = selected.id;
            setActiveDeviceName(selected.name);
        }
        return mapped;
    }, [api]);

    const resolveDeviceIdForPlayback = useCallback(async (_opts: { forceRefresh?: boolean } = {}) => {
        const available = await fetchDevices();
        const selected =
            available.find((device) => device.id === deviceIdRef.current && !device.isRestricted) ||
            available.find((device) => device.isActive && !device.isRestricted) ||
            available.find((device) => device.id === sdkDeviceIdRef.current && !device.isRestricted) ||
            available.find((device) => !device.isRestricted);
        if (!selected?.id) {
            if (sdkDeviceIdRef.current) {
                const transferRes = await api(
                    "/me/player",
                    {
                        method: "PUT",
                        body: JSON.stringify({ device_ids: [sdkDeviceIdRef.current], play: false }),
                    },
                    { silent: true }
                );
                if (transferRes.ok) {
                    deviceIdRef.current = sdkDeviceIdRef.current;
                    setActiveDeviceName("Este navegador");
                    return sdkDeviceIdRef.current;
                }
            }
            toast({
                title: "Sin dispositivo activo",
                description: "Abre Spotify en este navegador o en otro dispositivo y vuelve a intentar.",
            });
            return null;
        }
        deviceIdRef.current = selected.id;
        setActiveDeviceName(selected.name);
        return selected.id;
    }, [api, fetchDevices]);

    const isDeviceNotFoundResponse = useCallback(async (response: Response) => {
        if (response.status !== 404) return false;
        try {
            const data = (await response.clone().json()) as { error?: { message?: string; reason?: string } };
            const value = `${data?.error?.message || ""} ${data?.error?.reason || ""}`.toLowerCase();
            return value.includes("device not found");
        } catch {
            return false;
        }
    }, []);

    const executeWithDeviceRecovery = useCallback(
        async (runner: SpotifyDeviceCommand) => {
            const deviceId = await resolveDeviceIdForPlayback();
            if (!deviceId) return null;

            let response = await runner(deviceId);
            if (response.ok) return response;
            if (!(await isDeviceNotFoundResponse(response))) return response;

            deviceIdRef.current = null;
            const recoveredDeviceId = await resolveDeviceIdForPlayback({ forceRefresh: true });
            if (!recoveredDeviceId) return response;

            await api(
                "/me/player",
                {
                    method: "PUT",
                    body: JSON.stringify({ device_ids: [recoveredDeviceId], play: false }),
                },
                { silent: true }
            );
            await sleep(250);
            response = await runner(recoveredDeviceId);
            if (response.ok) return response;

            if ((await isDeviceNotFoundResponse(response)) && sdkDeviceIdRef.current && sdkDeviceIdRef.current !== recoveredDeviceId) {
                await api(
                    "/me/player",
                    {
                        method: "PUT",
                        body: JSON.stringify({ device_ids: [sdkDeviceIdRef.current], play: false }),
                    },
                    { silent: true }
                );
                await sleep(250);
                response = await runner(sdkDeviceIdRef.current);
            }
            return response;
        },
        [api, isDeviceNotFoundResponse, resolveDeviceIdForPlayback]
    );

    const transferPlayback = useCallback(
        async (deviceId: string, opts: { notify?: boolean } = {}) => {
            const { notify = true } = opts;
            if (!deviceId) return false;

            for (let attempt = 0; attempt < 4; attempt++) {
                const available = await fetchDevices();
                const exists = available.some((device) => device.id === deviceId && !device.isRestricted);
                if (!exists) {
                    await sleep(300);
                    continue;
                }

                const response = await api(
                    "/me/player",
                    {
                        method: "PUT",
                        body: JSON.stringify({ device_ids: [deviceId], play: false }),
                    },
                    { silent: true }
                );

                if (!response.ok) {
                    if (response.status === 404) {
                        await sleep(300);
                        continue;
                    }
                    return false;
                }

                deviceIdRef.current = deviceId;
                await fetchDevices();
                if (notify) {
                    const target = available.find((device) => device.id === deviceId);
                    toast({
                        title: "Dispositivo actualizado",
                        description: `Reproduccion movida a ${target?.name || "dispositivo seleccionado"}.`,
                    });
                }
                return true;
            }

            return false;
        },
        [api, fetchDevices]
    );

    /** Registers the Web Playback SDK device ("ready" event) as the current playback target. */
    const selectSdkDevice = useCallback((deviceId: string) => {
        sdkDeviceIdRef.current = deviceId;
        deviceIdRef.current = deviceId;
        setActiveDeviceName("Este navegador");
    }, []);

    const resetDeviceSelection = useCallback(() => {
        deviceIdRef.current = null;
        sdkDeviceIdRef.current = null;
    }, []);

    const clearDevices = useCallback(() => {
        setDevices([]);
    }, []);

    return {
        devices,
        activeDeviceName,
        fetchDevices,
        executeWithDeviceRecovery,
        transferPlayback,
        selectSdkDevice,
        resetDeviceSelection,
        clearDevices,
    };
};
