import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useRetroSfx from "@/hooks/useRetroSfx";
import { toast } from "@/hooks/use-toast";

const OPENVERSE_API_URL = "https://api.openverse.org/v1/audio/";
const OPENVERSE_PAGE_SIZE = 12;

type OpenverseSource = "all" | "jamendo" | "freesound" | "wikimedia_audio" | "ccmixter";

type OpenverseAudioResult = {
    id: string;
    title: string | null;
    url: string | null;
    creator: string | null;
    source: string;
    filetype: string | null;
    license: string | null;
    license_version: string | null;
    duration: number | null;
    foreign_landing_url: string | null;
};

type OpenverseAudioResponse = {
    results: OpenverseAudioResult[];
};

const OPENVERSE_SOURCES: Array<{ id: OpenverseSource; label: string }> = [
    { id: "all", label: "ALL" },
    { id: "jamendo", label: "JAMENDO" },
    { id: "freesound", label: "FREESOUND" },
    { id: "wikimedia_audio", label: "WIKIMEDIA" },
    { id: "ccmixter", label: "CCMIXTER" },
];

const ARCHIVE_SEARCH_URL = "https://archive.org/advancedsearch.php";
const ARCHIVE_METADATA_URL = "https://archive.org/metadata";
const ARCHIVE_DOWNLOAD_URL = "https://archive.org/download";
const ARCHIVE_AUDIO_FORMATS = ["VBR MP3", "128Kbps MP3", "64Kbps MP3", "MP3", "Ogg Vorbis", "Flac"];

type SearchPlatform = "openverse" | "archive";

type ArchiveSearchResult = {
    identifier: string;
    title?: string | string[];
    creator?: string | string[];
    year?: string | number;
};

type ArchiveMetadataFile = {
    name: string;
    format: string;
    length?: string;
    title?: string;
    track?: string;
};

type ArchiveMetadataResponse = {
    files?: ArchiveMetadataFile[];
};

const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatSource = (source: string) => source.replaceAll("_", " ").toUpperCase();

const formatLicense = (license: string | null, version: string | null) => {
    if (!license) return "LIC: UNKNOWN";
    if (!version) return `LIC: ${license.toUpperCase()}`;
    return `LIC: ${license.toUpperCase()} ${version}`;
};

const getStringValue = (value?: string | string[] | null): string | null => {
    if (!value) return null;
    if (Array.isArray(value)) return value[0] ?? null;
    return value;
};

const parseM3uFirstUrl = (text: string): string | null => {
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) return trimmed;
    }
    return null;
};

type M3uTrack = {
    url: string;
    title: string | null;
    duration: number | null;
};

const parseM3uTracks = (text: string): M3uTrack[] => {
    const lines = text.split(/\r?\n/);
    const tracks: M3uTrack[] = [];
    let pendingTitle: string | null = null;
    let pendingDuration: number | null = null;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith("#EXTINF:")) {
            const rest = trimmed.slice(8);
            const commaIdx = rest.indexOf(",");
            if (commaIdx !== -1) {
                const secs = parseFloat(rest.slice(0, commaIdx));
                pendingDuration = Number.isFinite(secs) ? secs : null;
                pendingTitle = rest.slice(commaIdx + 1).trim() || null;
            }
        } else if (!trimmed.startsWith("#")) {
            tracks.push({ url: trimmed, title: pendingTitle, duration: pendingDuration });
            pendingTitle = null;
            pendingDuration = null;
        }
    }
    return tracks;
};

const FileaScreen = () => {
    const sfx = useRetroSfx();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const localObjectUrlRef = useRef<string | null>(null);
    const autoPlayOnLoadRef = useRef(false);
    const preloadRef = useRef<HTMLAudioElement | null>(null);
    const seekBarRef = useRef<HTMLDivElement>(null);
    const isDraggingSeekRef = useRef(false);
    const [file, setFile] = useState<File | null>(null);
    const [url, setUrl] = useState<string | null>(null);
    const [trackLabel, setTrackLabel] = useState("Sin archivo cargado");
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [volume, setVolume] = useState(0.75);
    const [searchInput, setSearchInput] = useState("retro game");
    const [searchQuery, setSearchQuery] = useState("retro game");
    const [searchVersion, setSearchVersion] = useState(0);
    const [searchSource, setSearchSource] = useState<OpenverseSource>("all");
    const [searchResults, setSearchResults] = useState<OpenverseAudioResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [searchPlatform, setSearchPlatform] = useState<SearchPlatform>("openverse");
    const [archiveResults, setArchiveResults] = useState<ArchiveSearchResult[]>([]);
    const [loadingArchiveId, setLoadingArchiveId] = useState<string | null>(null);
    const [m3uPlaylist, setM3uPlaylist] = useState<M3uTrack[]>([]);
    const [m3uItemTitle, setM3uItemTitle] = useState<string>("");
    const [m3uCurrentIndex, setM3uCurrentIndex] = useState<number | null>(null);

    const releaseLocalObjectUrl = useCallback(() => {
        const localUrl = localObjectUrlRef.current;
        if (!localUrl) return;
        URL.revokeObjectURL(localUrl);
        localObjectUrlRef.current = null;
    }, []);

    useEffect(() => {
        return () => releaseLocalObjectUrl();
    }, [releaseLocalObjectUrl]);

    useEffect(() => {
        const stop = () => { isDraggingSeekRef.current = false; };
        window.addEventListener("mouseup", stop);
        return () => window.removeEventListener("mouseup", stop);
    }, []);

    // Preload next playlist track in the background while current one plays
    useEffect(() => {
        // Cancel any previous preload
        if (preloadRef.current) {
            preloadRef.current.src = "";
            preloadRef.current = null;
        }
        if (m3uCurrentIndex === null || m3uCurrentIndex >= m3uPlaylist.length - 1) return;
        const nextUrl = m3uPlaylist[m3uCurrentIndex + 1]?.url;
        if (!nextUrl) return;

        const audio = new Audio();
        audio.crossOrigin = "anonymous";
        audio.preload = "auto";
        audio.src = nextUrl;
        preloadRef.current = audio;

        return () => {
            audio.src = "";
            preloadRef.current = null;
        };
    }, [m3uCurrentIndex, m3uPlaylist]);

    const runOpenverseSearch = useCallback(async (query: string, source: OpenverseSource, signal: AbortSignal) => {
        const params = new URLSearchParams({
            q: query,
            page_size: String(OPENVERSE_PAGE_SIZE),
        });
        if (source !== "all") {
            params.set("source", source);
        }

        const response = await fetch(`${OPENVERSE_API_URL}?${params.toString()}`, { signal });
        if (!response.ok) {
            throw new Error(`Openverse error ${response.status}`);
        }

        const payload = (await response.json()) as OpenverseAudioResponse;
        return payload.results.filter((item) => Boolean(item.url));
    }, []);

    const runArchiveSearch = useCallback(async (query: string, signal: AbortSignal) => {
        const url = `${ARCHIVE_SEARCH_URL}?q=${encodeURIComponent(query + " AND mediatype:audio")}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=year&rows=${OPENVERSE_PAGE_SIZE}&output=json&sort[]=downloads+desc`;
        const response = await fetch(url, { signal });
        if (!response.ok) throw new Error(`Internet Archive error ${response.status}`);
        const data = (await response.json()) as { response: { docs: ArchiveSearchResult[] } };
        return data.response.docs;
    }, []);

    useEffect(() => {
        if (searchPlatform !== "openverse") return;
        const query = searchQuery.trim();
        if (!query) {
            setSearchResults([]);
            setSearchError("Escribe algo para buscar audio.");
            return;
        }

        const controller = new AbortController();
        setIsSearching(true);
        setSearchError(null);

        void runOpenverseSearch(query, searchSource, controller.signal)
            .then((results) => {
                if (controller.signal.aborted) return;
                setSearchResults(results);
                if (!results.length) {
                    setSearchError("No hubo resultados para esa busqueda.");
                }
            })
            .catch((error) => {
                if (controller.signal.aborted) return;
                console.error(error);
                setSearchResults([]);
                setSearchError("No se pudo consultar Openverse en este momento.");
            })
            .finally(() => {
                if (controller.signal.aborted) return;
                setIsSearching(false);
            });

        return () => controller.abort();
    }, [runOpenverseSearch, searchQuery, searchSource, searchVersion, searchPlatform]);

    useEffect(() => {
        if (searchPlatform !== "archive") return;
        const query = searchQuery.trim();
        if (!query) {
            setArchiveResults([]);
            setSearchError("Escribe algo para buscar audio.");
            return;
        }

        const controller = new AbortController();
        setIsSearching(true);
        setSearchError(null);

        void runArchiveSearch(query, controller.signal)
            .then((results) => {
                if (controller.signal.aborted) return;
                setArchiveResults(results);
                if (!results.length) {
                    setSearchError("No hubo resultados para esa busqueda.");
                }
            })
            .catch((error) => {
                if (controller.signal.aborted) return;
                console.error(error);
                setArchiveResults([]);
                setSearchError("No se pudo consultar Internet Archive en este momento.");
            })
            .finally(() => {
                if (controller.signal.aborted) return;
                setIsSearching(false);
            });

        return () => controller.abort();
    }, [runArchiveSearch, searchQuery, searchVersion, searchPlatform]);

    const progress = useMemo(() => {
        if (duration <= 0) return 0;
        return (currentTime / duration) * 100;
    }, [currentTime, duration]);

    const onFilePick = (picked: File | null) => {
        if (!picked) return;
        releaseLocalObjectUrl();
        const nextUrl = URL.createObjectURL(picked);
        localObjectUrlRef.current = nextUrl;
        autoPlayOnLoadRef.current = false;
        setFile(picked);
        setUrl(nextUrl);
        setTrackLabel(picked.name);
        setCurrentTime(0);
        setDuration(0);
        setBuffered(0);
        setIsPlaying(false);
        sfx("ultimate");
    };

    const onSearchSubmit = () => {
        const query = searchInput.trim();
        if (!query) {
            setSearchResults([]);
            setSearchError("Escribe algo para buscar audio.");
            sfx("fail");
            return;
        }
        sfx("confirm");
        if (query === searchQuery) {
            setSearchVersion((value) => value + 1);
            return;
        }
        setSearchQuery(query);
    };

    const onResultLoad = (result: OpenverseAudioResult) => {
        if (!result.url) return;
        releaseLocalObjectUrl();
        autoPlayOnLoadRef.current = true;
        setFile(null);
        setUrl(result.url);
        setTrackLabel(result.title || "Openverse track");
        setCurrentTime(0);
        setDuration(0);
        setBuffered(0);
        setIsPlaying(false);
        sfx("powerup");
    };

    const onArchiveLoad = async (item: ArchiveSearchResult) => {
        setLoadingArchiveId(item.identifier);
        sfx("confirm");
        try {
            const resp = await fetch(`${ARCHIVE_METADATA_URL}/${item.identifier}`);
            if (!resp.ok) throw new Error("metadata fetch failed");
            const meta = (await resp.json()) as ArchiveMetadataResponse;
            const files = meta.files ?? [];
            const itemTitle = getStringValue(item.title) ?? "Internet Archive";

            // 1. Prefer M3U — parse and show full track list
            const m3uFile = files.find((f) => f.format.includes("M3U") || f.name.toLowerCase().endsWith(".m3u"));
            if (m3uFile) {
                const m3uUrl = `${ARCHIVE_DOWNLOAD_URL}/${item.identifier}/${encodeURIComponent(m3uFile.name)}`;
                const m3uResp = await fetch(m3uUrl);
                if (m3uResp.ok) {
                    const tracks = parseM3uTracks(await m3uResp.text());
                    if (tracks.length > 0) {
                        setM3uItemTitle(itemTitle);
                        setM3uPlaylist(tracks);
                        sfx("powerup");
                        return;
                    }
                }
            }

            // 2. No M3U — collect direct audio files and build playlist from metadata
            const audioFiles = files
                .filter((f) => ARCHIVE_AUDIO_FORMATS.includes(f.format))
                .sort((a, b) => {
                    const aNum = a.track ? parseInt(a.track.split("/")[0], 10) : 9999;
                    const bNum = b.track ? parseInt(b.track.split("/")[0], 10) : 9999;
                    return aNum - bNum;
                });

            if (audioFiles.length === 0) {
                sfx("fail");
                toast({ variant: "destructive", title: "Sin audio", description: "No se encontró un archivo compatible en este item." });
                return;
            }

            if (audioFiles.length === 1) {
                // Single file — play directly
                const f = audioFiles[0];
                releaseLocalObjectUrl();
                autoPlayOnLoadRef.current = true;
                setFile(null);
                setUrl(`${ARCHIVE_DOWNLOAD_URL}/${item.identifier}/${encodeURIComponent(f.name)}`);
                setTrackLabel(f.title ?? itemTitle);
                setCurrentTime(0);
                setDuration(0);
                setBuffered(0);
                setIsPlaying(false);
                sfx("powerup");
                return;
            }

            // Multiple files — show playlist
            const tracks: M3uTrack[] = audioFiles.map((f) => ({
                url: `${ARCHIVE_DOWNLOAD_URL}/${item.identifier}/${encodeURIComponent(f.name)}`,
                title: f.title ?? f.name.split("/").pop()?.replace(/\.[^.]+$/, "") ?? null,
                duration: f.length ? parseFloat(f.length) : null,
            }));
            setM3uItemTitle(itemTitle);
            setM3uPlaylist(tracks);
            sfx("powerup");
        } catch {
            sfx("fail");
            toast({ variant: "destructive", title: "Error", description: "No se pudo cargar el track de Internet Archive." });
        } finally {
            setLoadingArchiveId(null);
        }
    };

    const onM3uTrackLoad = (track: M3uTrack, index: number) => {
        releaseLocalObjectUrl();
        autoPlayOnLoadRef.current = true;
        setFile(null);
        setUrl(track.url);
        setTrackLabel(track.title ?? m3uItemTitle);
        setCurrentTime(0);
        setDuration(0);
        setBuffered(0);
        setIsPlaying(false);
        setM3uCurrentIndex(index);
        sfx("powerup");
    };

    const onPlayPause = async () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (audio.paused) {
            try {
                await audio.play();
                setIsPlaying(true);
                sfx("confirm");
            } catch {
                setIsPlaying(false);
            }
            return;
        }
        audio.pause();
        setIsPlaying(false);
        sfx("cancel");
    };

    const onSeek = (value: number) => {
        const audio = audioRef.current;
        if (!audio || duration <= 0) return;
        audio.currentTime = (value / 100) * duration;
        setCurrentTime(audio.currentTime);
    };

    const onVolume = (value: number) => {
        const audio = audioRef.current;
        setVolume(value);
        if (audio) audio.volume = value;
    };

    return (
        <div className="px-4 py-5 sm:px-6 lg:px-8">
            <div className="pixel-box-elevated p-5 space-y-4">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="font-display text-[9px] text-primary">FILEA AUDIO PLAYER</p>
                        <p className="text-sm text-muted-foreground">Busca audio libre en Openverse, Internet Archive o carga archivos locales.</p>
                    </div>
                    <span className="font-display text-[7px] px-2 py-1 border-2 border-primary text-primary">OVERPOWERED</span>
                </div>

                <label className="pixel-box p-3 block cursor-pointer hover:border-primary/70">
                    <span className="font-display text-[8px] text-primary">SELECT AUDIO FILE</span>
                    <input
                        type="file"
                        accept="audio/*"
                        className="mt-2 block w-full text-sm text-foreground file:retro-btn-secondary file:!text-[7px] file:!px-2 file:!py-1 file:!mr-3"
                        onChange={(event) => onFilePick(event.target.files?.[0] ?? null)}
                    />
                </label>

                <div className="pixel-box p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <p className="font-display text-[8px] text-primary">ONLINE SEARCH</p>
                        <div className="flex gap-1">
                            {(["openverse", "archive"] as SearchPlatform[]).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => {
                                        sfx("select");
                                        setSearchPlatform(p);
                                        setSearchError(null);
                                        if (p !== "openverse") setSearchResults([]);
                                        if (p !== "archive") setArchiveResults([]);
                                    }}
                                    className={`retro-btn-secondary !text-[7px] !px-2 !py-1 ${searchPlatform === p ? "!border-primary !text-primary" : ""}`}
                                >
                                    {p === "openverse" ? "OPENVERSE" : "ARCHIVE.ORG"}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(event) => setSearchInput(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key !== "Enter") return;
                                event.preventDefault();
                                onSearchSubmit();
                            }}
                            placeholder="synthwave, chiptune, lofi..."
                            className="flex-1 px-2 py-2 border-2 border-border bg-secondary text-foreground text-sm"
                        />
                        <button onClick={onSearchSubmit} className="retro-btn-secondary !text-[7px] !px-2 !py-1" disabled={isSearching}>
                            {isSearching ? "BUSCANDO" : "SEARCH"}
                        </button>
                    </div>

                    {searchPlatform === "openverse" && (
                        <div className="flex flex-wrap gap-1">
                            {OPENVERSE_SOURCES.map((option) => {
                                const active = searchSource === option.id;
                                return (
                                    <button
                                        key={`openverse-${option.id}`}
                                        onClick={() => {
                                            sfx("select");
                                            setSearchSource(option.id);
                                        }}
                                        className={`retro-btn-secondary !text-[7px] !px-2 !py-1 ${
                                            active ? "!border-primary !text-primary !bg-secondary" : ""
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {searchError && <p className="text-xs text-muted-foreground">{searchError}</p>}

                    {searchPlatform === "openverse" && (
                        <div className="space-y-2 max-h-56 overflow-auto pr-1">
                            {searchResults.map((result) => (
                                <div key={result.id} className="pixel-box p-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-sm truncate">{result.title || "Untitled track"}</p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {(result.creator || "Unknown artist").trim()} · {formatSource(result.source)} ·{" "}
                                                {(result.filetype || "audio").toUpperCase()}
                                            </p>
                                        </div>
                                        <div className="shrink-0 text-xs text-muted-foreground">
                                            {result.duration ? formatTime(result.duration / 1000) : "--:--"}
                                        </div>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between gap-2">
                                        <p className="text-xs text-muted-foreground truncate">
                                            {formatLicense(result.license, result.license_version)}
                                        </p>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {result.foreign_landing_url && (
                                                <a
                                                    href={result.foreign_landing_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="retro-btn-secondary !text-[7px] !px-2 !py-1"
                                                    onClick={() => sfx("navigate")}
                                                >
                                                    SOURCE
                                                </a>
                                            )}
                                            <button
                                                onClick={() => onResultLoad(result)}
                                                className="retro-btn-secondary !text-[7px] !px-2 !py-1"
                                                disabled={!result.url}
                                            >
                                                LOAD
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {searchPlatform === "archive" && (
                        <div className="space-y-2 max-h-56 overflow-auto pr-1">
                            {archiveResults.map((item) => {
                                const title = getStringValue(item.title) ?? "Untitled";
                                const creator = getStringValue(item.creator) ?? "Unknown artist";
                                const year = item.year ? String(item.year) : null;
                                const isLoading = loadingArchiveId === item.identifier;
                                return (
                                    <div key={item.identifier} className="pixel-box p-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-sm truncate">{title}</p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {creator}{year ? ` · ${year}` : ""}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-2 flex items-center justify-between gap-2">
                                            <p className="text-xs text-muted-foreground truncate">{item.identifier}</p>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <a
                                                    href={`https://archive.org/details/${item.identifier}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="retro-btn-secondary !text-[7px] !px-2 !py-1"
                                                    onClick={() => sfx("navigate")}
                                                >
                                                    SOURCE
                                                </a>
                                                <button
                                                    onClick={() => void onArchiveLoad(item)}
                                                    className="retro-btn-secondary !text-[7px] !px-2 !py-1"
                                                    disabled={loadingArchiveId !== null}
                                                >
                                                    {isLoading ? "LOADING" : "LOAD"}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                </div>

                {m3uPlaylist.length > 0 && (
                    <div className="pixel-box p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <p className="font-display text-[8px] text-primary">PLAYLIST</p>
                                <p className="text-xs text-muted-foreground truncate">{m3uItemTitle}</p>
                            </div>
                            <button
                                onClick={() => { sfx("cancel"); setM3uPlaylist([]); setM3uCurrentIndex(null); }}
                                className="retro-btn-secondary !text-[7px] !px-2 !py-1 shrink-0"
                            >
                                CLOSE
                            </button>
                        </div>
                        <div className="space-y-1 max-h-56 overflow-auto pr-1">
                            {m3uPlaylist.map((track, idx) => {
                                const isActive = m3uCurrentIndex === idx;
                                return (
                                    <div
                                        key={idx}
                                        className={`pixel-box p-2 flex items-center justify-between gap-2 ${isActive ? "border-primary" : ""}`}
                                    >
                                        <div className="min-w-0">
                                            <p className={`text-sm truncate ${isActive ? "text-primary" : ""}`}>
                                                {track.title ?? `Track ${idx + 1}`}
                                            </p>
                                            {track.duration !== null && (
                                                <p className="text-xs text-muted-foreground">{formatTime(track.duration)}</p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => onM3uTrackLoad(track, idx)}
                                            className={`retro-btn-secondary !text-[7px] !px-2 !py-1 shrink-0 ${isActive ? "!border-primary !text-primary" : ""}`}
                                        >
                                            {isActive ? "▶ NOW" : "PLAY"}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="pixel-box p-4 space-y-3">
                    <p className="text-sm truncate">{file ? file.name : trackLabel}</p>

                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                        <div
                            ref={seekBarRef}
                            className={`relative h-3 border-2 border-border select-none ${url ? "cursor-pointer" : "opacity-40"}`}
                            onMouseDown={(e) => {
                                if (!url) return;
                                isDraggingSeekRef.current = true;
                                const rect = seekBarRef.current!.getBoundingClientRect();
                                onSeek(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
                            }}
                            onMouseMove={(e) => {
                                if (!isDraggingSeekRef.current || !url) return;
                                const rect = seekBarRef.current!.getBoundingClientRect();
                                onSeek(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
                            }}
                        >
                            {/* Buffered */}
                            <div
                                className="absolute inset-y-0 left-0 bg-muted-foreground/30"
                                style={{ width: `${buffered}%` }}
                            />
                            {/* Played */}
                            <div
                                className="absolute inset-y-0 left-0 bg-primary"
                                style={{ width: `${progress}%` }}
                            />
                            {/* Thumb */}
                            {url && (
                                <div
                                    className="absolute top-0 bottom-0 w-1 bg-primary-foreground border border-primary"
                                    style={{ left: `calc(${progress}% - 2px)` }}
                                />
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={onPlayPause} className="retro-btn-secondary !text-[8px] !px-3 !py-2" disabled={!url}>
                            {isPlaying ? "PAUSE" : "PLAY"}
                        </button>
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-1">VOL {Math.round(volume * 100)}%</p>
                            <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.01}
                                value={volume}
                                onChange={(event) => onVolume(Number(event.target.value))}
                            />
                        </div>
                    </div>
                </div>

                {url && (
                    <audio
                        ref={audioRef}
                        src={url}
                        crossOrigin="anonymous"
                        preload="metadata"
                        onLoadedMetadata={(event) => {
                            const audio = event.currentTarget;
                            setDuration(audio.duration || 0);
                            audio.volume = volume;
                            if (!autoPlayOnLoadRef.current) return;
                            autoPlayOnLoadRef.current = false;
                            void audio
                                .play()
                                .then(() => {
                                    setIsPlaying(true);
                                    sfx("confirm");
                                })
                                .catch(() => {
                                    setIsPlaying(false);
                                    toast({
                                        variant: "destructive",
                                        title: "No se pudo reproducir",
                                        description: "Ese enlace no permitio autoplay. Intenta con PLAY.",
                                    });
                                });
                        }}
                        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                        onProgress={(event) => {
                            const audio = event.currentTarget;
                            if (!audio.duration || !audio.buffered.length) return;
                            let end = 0;
                            for (let i = 0; i < audio.buffered.length; i++) {
                                if (audio.buffered.start(i) <= audio.currentTime) {
                                    end = Math.max(end, audio.buffered.end(i));
                                }
                            }
                            setBuffered((end / audio.duration) * 100);
                        }}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onError={() => {
                            setIsPlaying(false);
                            autoPlayOnLoadRef.current = false;
                            sfx("fail");
                            toast({
                                variant: "destructive",
                                title: "Audio no compatible",
                                description: "Ese archivo/enlace no se pudo reproducir en el navegador.",
                            });
                        }}
                        onEnded={() => {
                            sfx("cancel");
                            if (m3uCurrentIndex !== null && m3uCurrentIndex < m3uPlaylist.length - 1) {
                                const next = m3uPlaylist[m3uCurrentIndex + 1];
                                onM3uTrackLoad(next, m3uCurrentIndex + 1);
                            } else {
                                setIsPlaying(false);
                            }
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default FileaScreen;
