import { useEffect, useMemo, useState, type RefObject } from "react";
import {
    Check, Clipboard, Crown, Link2, Loader2, LogOut, Pause, Play, Plus,
    Search, SkipBack, SkipForward, Trash2, Users, Wifi, WifiOff,
    Volume2, VolumeX, Library, ChevronLeft, Radio,
} from "lucide-react";
import mixyVideo from "@/assets/idol-mixy-body.mp4";
import mixyPoster from "@/assets/idol-mixy.png";
import type { MixyRoomController } from "@/hooks/useMixyRoom";
import {
    extrapolateMixyPosition,
    type MixyLibraryPlaylist,
    type MixyProvider,
    type MixySearchCandidate,
    type MixySource,
} from "@/lib/mixy";

interface MixyScreenProps {
    mixy: MixyRoomController;
    candidates: MixySearchCandidate[];
    searchLoading: boolean;
    onSearch: (query: string) => Promise<void>;
    activeSource: MixySource | null;
    syncOffsetMs: number | null;
    syncMessage: string;
    spotifyConnected: boolean;
    youtubeConnected: boolean;
    soundcloudConnected: boolean;
    onConnectSpotify: () => void;
    onConnectYoutube: () => void;
    onConnectSoundcloud: () => void;
    youtubePlayerHostRef: (node: HTMLDivElement | null) => void;
    soundcloudIframeRef: RefObject<HTMLIFrameElement>;
    soundcloudIframeSrc: string;
    onActivateAudio: (forcePlay?: boolean) => boolean;
    volume: number;
    onVolumeChange: (value: number) => void;
    playlists: MixyLibraryPlaylist[];
    onLoadPlaylist: (playlist: MixyLibraryPlaylist) => Promise<MixySearchCandidate[]>;
    onAddCandidate: (candidate: MixySearchCandidate) => Promise<void>;
}

const PROVIDER_META: Record<MixyProvider, { label: string; color: string }> = {
    spotify: { label: "SPOTY", color: "#45e068" },
    youtube: { label: "TUBY", color: "#ff365c" },
    soundcloud: { label: "CLOUDY", color: "#ff8a34" },
    local: { label: "LOCAL", color: "#a9b6ca" },
};

const formatMs = (value: number) => {
    const seconds = Math.max(0, Math.floor(value / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

const ProviderBadge = ({ provider }: { provider: MixyProvider }) => (
    <span
        className="inline-flex border px-1.5 py-1 font-display text-[6px]"
        style={{ borderColor: PROVIDER_META[provider].color, color: PROVIDER_META[provider].color }}
    >
        {PROVIDER_META[provider].label}
    </span>
);

const MixyScreen = ({
    mixy, candidates, searchLoading, onSearch, activeSource, syncOffsetMs, syncMessage,
    spotifyConnected, youtubeConnected, soundcloudConnected,
    onConnectSpotify, onConnectYoutube, onConnectSoundcloud,
    youtubePlayerHostRef, soundcloudIframeRef, soundcloudIframeSrc,
    onActivateAudio,
    volume, onVolumeChange,
    playlists, onLoadPlaylist, onAddCandidate,
}: MixyScreenProps) => {
    const [query, setQuery] = useState("");
    const [clock, setClock] = useState(Date.now());
    const [activePlaylist, setActivePlaylist] = useState<MixyLibraryPlaylist | null>(null);
    const [playlistTracks, setPlaylistTracks] = useState<MixySearchCandidate[]>([]);
    const [playlistLoading, setPlaylistLoading] = useState(false);
    const [addingCandidateId, setAddingCandidateId] = useState("");

    useEffect(() => {
        if (!mixy.room?.playback.isPlaying) return;
        const timer = window.setInterval(() => setClock(Date.now()), 500);
        return () => window.clearInterval(timer);
    }, [mixy.room?.playback.isPlaying]);

    const positionMs = mixy.room
        ? extrapolateMixyPosition(mixy.room.playback, clock + mixy.serverOffsetMs)
        : 0;
    const durationMs = mixy.room?.playback.durationMs || mixy.activeTrack?.durationMs || 0;
    const progress = durationMs ? Math.min(100, (positionMs / durationMs) * 100) : 0;
    const groupedCandidates = useMemo(() => {
        const seen = new Set<string>();
        return candidates.filter((candidate) => {
            const key = `${candidate.provider}:${candidate.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [candidates]);

    const submitSearch = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!query.trim()) return;
        await onSearch(query.trim());
    };

    const addCandidate = async (candidate: MixySearchCandidate) => {
        const key = `${candidate.provider}:${candidate.id}`;
        setAddingCandidateId(key);
        try {
            await onAddCandidate(candidate);
        } finally {
            setAddingCandidateId("");
        }
    };

    const openPlaylist = async (playlist: MixyLibraryPlaylist) => {
        setActivePlaylist(playlist);
        setPlaylistTracks([]);
        setPlaylistLoading(true);
        try {
            setPlaylistTracks(await onLoadPlaylist(playlist));
        } finally {
            setPlaylistLoading(false);
        }
    };

    if (!mixy.room) {
        return (
            <section className="mx-auto grid min-h-[620px] w-full max-w-6xl gap-5 p-4 lg:grid-cols-[0.85fr_1.15fr] lg:p-8" aria-labelledby="mixy-title">
                <div className="pixel-box relative flex min-h-[420px] items-center justify-center overflow-hidden p-4">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.2),transparent_62%)]" />
                    <video src={mixyVideo} poster={mixyPoster} autoPlay muted loop playsInline className="relative aspect-square w-full max-w-[440px] object-contain" style={{ imageRendering: "pixelated" }} />
                </div>
                <div className="pixel-box flex flex-col justify-center p-5 sm:p-8">
                    <p className="font-display text-[7px] tracking-[0.25em] text-primary">PLAYER 05 // PARTY LINK</p>
                    <h2 id="mixy-title" className="mt-3 font-display text-2xl sm:text-4xl">MIXY</h2>
                    <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
                        Una cola compartida. Cada dispositivo reproduce la mejor version disponible desde sus propias cuentas, sincronizada por Mixy.
                    </p>
                    <label className="mt-7 font-display text-[7px] text-muted-foreground" htmlFor="mixy-name">TU NOMBRE</label>
                    <input id="mixy-name" value={mixy.participantName} onChange={(event) => mixy.setParticipantName(event.target.value)} className="mt-2 border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary" placeholder="PC Windows" />
                    <button type="button" onClick={() => void mixy.createRoom()} disabled={mixy.busy} className="mt-4 flex items-center justify-center gap-2 border border-primary bg-primary px-4 py-3 font-display text-[8px] text-primary-foreground disabled:opacity-50">
                        {mixy.busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} CREAR NUEVA SALA
                    </button>
                    <div className="my-5 flex items-center gap-3 text-[10px] text-muted-foreground"><span className="h-px flex-1 bg-border" />O UNIRSE<span className="h-px flex-1 bg-border" /></div>
                    <label className="font-display text-[7px] text-muted-foreground" htmlFor="mixy-code">CODIGO DE 16 CARACTERES</label>
                    <div className="mt-2 flex gap-2">
                        <input id="mixy-code" value={mixy.joinCode} onChange={(event) => mixy.setJoinCode(event.target.value)} className="min-w-0 flex-1 border border-border bg-background px-3 py-3 font-mono text-sm uppercase tracking-wider outline-none focus:border-primary" placeholder="ABCD-EFGH-JKLM-NPQR" />
                        <button type="button" onClick={() => void mixy.joinRoom()} disabled={mixy.busy} className="border border-primary px-4 font-display text-[8px] text-primary disabled:opacity-50">ENTRAR</button>
                    </div>
                    {mixy.error && <p role="alert" className="mt-4 border border-destructive/60 bg-destructive/10 p-3 text-xs text-destructive">{mixy.error}</p>}
                </div>
            </section>
        );
    }

    return (
        <section className="mx-auto min-h-[650px] w-full max-w-[1500px] p-3 sm:p-5" aria-labelledby="mixy-room-title">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-primary/60 bg-background/90 p-3">
                <div>
                    <p className="font-display text-[6px] text-muted-foreground">MIXY PARTY LINK</p>
                    <h2 id="mixy-room-title" className="mt-1 font-display text-sm text-primary">{mixy.formattedCode}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void mixy.copyCode()} className="flex items-center gap-2 border border-border px-3 py-2 font-display text-[7px]"><Clipboard size={13} /> COPIAR</button>
                    <button type="button" onClick={() => {
                        if (!mixy.ready) onActivateAudio();
                        mixy.setReady(!mixy.ready);
                    }} className={`flex items-center gap-2 border px-3 py-2 font-display text-[7px] ${mixy.ready ? "border-emerald-400 text-emerald-400" : "border-primary text-primary"}`}>
                        {mixy.ready ? <Check size={13} /> : <Wifi size={13} />} {mixy.ready ? "AUDIO READY" : "ACTIVAR AUDIO"}
                    </button>
                    <button type="button" onClick={() => void mixy.control({ type: "set-autoplay", enabled: mixy.room?.autoplay === false })} className={`flex items-center gap-2 border px-3 py-2 font-display text-[7px] ${mixy.room.autoplay === false ? "border-border text-muted-foreground" : "border-cyan-400 text-cyan-400"}`}>
                        <Radio size={13} /> AUTO DJ {mixy.room.autoplay === false ? "OFF" : "ON"}
                    </button>
                    <button type="button" onClick={mixy.disconnect} className="flex items-center gap-2 border border-destructive/70 px-3 py-2 font-display text-[7px] text-destructive"><LogOut size={13} /> SALIR</button>
                </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[290px_minmax(0,1fr)_320px]">
                <aside className="space-y-4">
                    <div className="pixel-box overflow-hidden p-3">
                        <video src={mixyVideo} poster={mixyPoster} autoPlay muted loop playsInline className="mx-auto aspect-square w-full max-w-[240px] object-contain" style={{ imageRendering: "pixelated" }} />
                        <p className="mt-2 text-center font-display text-[7px] text-primary">{syncMessage}</p>
                        <p className="mt-2 text-center font-mono text-[10px] text-muted-foreground">
                            {syncOffsetMs === null ? "SYNC --" : `OFFSET ${syncOffsetMs > 0 ? "+" : ""}${syncOffsetMs}ms`}
                        </p>
                    </div>
                    <div className="pixel-box p-3">
                        <h3 className="flex items-center gap-2 font-display text-[8px]"><Link2 size={14} /> TUS FUENTES</h3>
                        {([
                            ["spotify", spotifyConnected, onConnectSpotify],
                            ["youtube", youtubeConnected, onConnectYoutube],
                            ["soundcloud", soundcloudConnected, onConnectSoundcloud],
                        ] as const).map(([provider, connected, connect]) => (
                            <button key={provider} type="button" onClick={connected ? undefined : connect} disabled={connected} className="mt-2 flex w-full items-center justify-between border border-border p-2 text-left disabled:cursor-default">
                                <ProviderBadge provider={provider} />
                                <span className={`font-display text-[6px] ${connected ? "text-emerald-400" : "text-muted-foreground"}`}>{connected ? "ONLINE" : "CONECTAR"}</span>
                            </button>
                        ))}
                        <div className="mt-2 flex w-full items-center justify-between border border-dashed border-border p-2 opacity-60"><ProviderBadge provider="local" /><span className="font-display text-[6px]">CLOUD SOON</span></div>
                    </div>
                    <div className="pixel-box p-3">
                        <p className="mb-2 font-display text-[7px] text-muted-foreground">YOUTUBE ENGINE // 200PX</p>
                        <div ref={youtubePlayerHostRef} className="mx-auto h-[200px] w-[200px] overflow-hidden border border-border bg-black" />
                    </div>
                    <div className="pixel-box p-3">
                        <h3 className="flex items-center gap-2 font-display text-[8px]"><Users size={14} /> PARTY ({mixy.room.participants.length})</h3>
                        <div className="mt-3 space-y-2">
                            {mixy.room.participants.map((participant) => (
                                <div key={participant.id} className="border border-border p-2">
                                    <div className="flex items-center justify-between gap-2 text-xs"><span className="truncate">{participant.name}</span><span className="flex items-center gap-1">{participant.isHost && <Crown size={12} className="text-amber-400" />}{participant.ready ? <Wifi size={12} className="text-emerald-400" /> : <WifiOff size={12} className="text-muted-foreground" />}</span></div>
                                    <div className="mt-2 flex flex-wrap gap-1">{participant.providers.map((provider) => <ProviderBadge key={provider} provider={provider} />)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

                <main className="min-w-0 space-y-4">
                    <div className="pixel-box p-4">
                        <div className="grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
                            <div className="aspect-square min-h-[200px] min-w-[200px] overflow-hidden border border-border bg-black">
                                {activeSource?.provider === "soundcloud" ? (
                                    <iframe ref={soundcloudIframeRef} key={soundcloudIframeSrc} title="SoundCloud player de Mixy" src={soundcloudIframeSrc} allow="autoplay" className="h-[200px] w-[200px] border-0" />
                                ) : mixy.activeTrack?.image ? (
                                    <img src={mixy.activeTrack.image} alt="" className="h-full w-full object-cover" />
                                ) : <div className="flex h-full items-center justify-center font-display text-4xl text-primary">M</div>}
                            </div>
                            <div className="flex min-w-0 flex-col justify-center">
                                <p className="font-display text-[7px] text-primary">NOW MIXING {activeSource && <ProviderBadge provider={activeSource.provider} />}</p>
                                <h3 className="mt-3 truncate text-xl font-bold">{mixy.activeTrack?.title || "La cola esta vacia"}</h3>
                                <p className="mt-1 truncate text-sm text-muted-foreground">{mixy.activeTrack?.artist || "Busca una cancion para comenzar"}</p>
                                <div className="mt-5 flex items-center justify-center gap-3 sm:justify-start">
                                    <button type="button" onClick={() => void mixy.control({ type: "previous" })} className="border border-border p-2" aria-label="Anterior"><SkipBack size={17} /></button>
                                    <button type="button" onClick={() => {
                                        if (!mixy.room!.playback.isPlaying) onActivateAudio(true);
                                        void mixy.control({ type: mixy.room!.playback.isPlaying ? "pause" : "play" });
                                    }} disabled={!mixy.activeTrack} className="border border-primary bg-primary p-3 text-primary-foreground disabled:opacity-40" aria-label={mixy.room.playback.isPlaying ? "Pausar" : "Reproducir"}>{mixy.room.playback.isPlaying ? <Pause size={20} /> : <Play size={20} />}</button>
                                    <button type="button" onClick={() => void mixy.control({ type: "next" })} className="border border-border p-2" aria-label="Siguiente"><SkipForward size={17} /></button>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 grid grid-cols-[42px_1fr_42px] items-center gap-2 font-mono text-[10px] text-muted-foreground">
                            <span>{formatMs(positionMs)}</span>
                            <input type="range" min={0} max={100} step={0.1} value={progress} onChange={(event) => void mixy.control({ type: "seek", positionMs: (Number(event.target.value) / 100) * durationMs })} disabled={!durationMs} aria-label="Posicion compartida" className="accent-primary" />
                            <span className="text-right">{formatMs(durationMs)}</span>
                        </div>
                        <div className="mt-3 flex items-center gap-3 border-t border-border pt-3">
                            {volume <= 0.01 ? <VolumeX size={16} className="text-destructive" /> : <Volume2 size={16} className="text-primary" />}
                            <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(event) => onVolumeChange(Number(event.target.value))} aria-label="Volumen local de Mixy" className="min-w-0 flex-1 accent-primary" />
                            <span className="w-9 text-right font-mono text-[10px]">{Math.round(volume * 100)}%</span>
                        </div>
                    </div>

                    <div className="pixel-box p-4">
                        <div className="flex items-center justify-between gap-3">
                            <h3 className="flex items-center gap-2 font-display text-[8px]"><Library size={15} /> TU BIBLIOTECA ONLINE</h3>
                            {activePlaylist && <button type="button" onClick={() => { setActivePlaylist(null); setPlaylistTracks([]); }} className="flex items-center gap-1 border border-border px-2 py-1 font-display text-[6px]"><ChevronLeft size={12} /> PLAYLISTS</button>}
                        </div>
                        {!activePlaylist ? (
                            <div className="mt-3 grid max-h-[300px] gap-2 overflow-y-auto sm:grid-cols-2">
                                {playlists.map((playlist) => (
                                    <button key={`${playlist.provider}:${playlist.id}`} type="button" onClick={() => void openPlaylist(playlist)} className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 border border-border p-2 text-left hover:border-primary">
                                        {playlist.image ? <img src={playlist.image} alt="" className="h-12 w-12 object-cover" /> : <div className="flex h-12 w-12 items-center justify-center bg-muted"><Library size={18} /></div>}
                                        <span className="min-w-0"><span className="block truncate text-sm font-semibold">{playlist.title}</span><span className="block truncate text-[10px] text-muted-foreground">{playlist.subtitle} · {playlist.trackCount} tracks</span></span>
                                        <ProviderBadge provider={playlist.provider} />
                                    </button>
                                ))}
                                {!playlists.length && <p className="col-span-full border border-dashed border-border p-5 text-center text-xs text-muted-foreground">Conecta una fuente para ver aquí sus playlists.</p>}
                            </div>
                        ) : (
                            <div className="mt-3">
                                <div className="mb-3 flex items-center gap-3 border border-primary/40 p-2">
                                    {activePlaylist.image ? <img src={activePlaylist.image} alt="" className="h-12 w-12 object-cover" /> : <div className="h-12 w-12 bg-muted" />}
                                    <div className="min-w-0"><p className="truncate text-sm font-bold">{activePlaylist.title}</p><p className="truncate text-[10px] text-muted-foreground">{activePlaylist.subtitle}</p></div>
                                </div>
                                <div className="max-h-[330px] space-y-2 overflow-y-auto pr-1">
                                    {playlistLoading && <p className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground"><Loader2 size={15} className="animate-spin" /> CARGANDO CANCIONES...</p>}
                                    {playlistTracks.map((track) => {
                                        const key = `${track.provider}:${track.id}`;
                                        return <div key={key} className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 border border-border p-2">
                                            {track.image ? <img src={track.image} alt="" className="h-10 w-10 object-cover" /> : <div className="h-10 w-10 bg-muted" />}
                                            <div className="min-w-0"><p className="truncate text-xs font-semibold">{track.title}</p><p className="truncate text-[10px] text-muted-foreground">{track.artist}</p></div>
                                            <button type="button" onClick={() => void addCandidate(track)} disabled={addingCandidateId === key} className="border border-primary p-2 text-primary disabled:opacity-50" aria-label={`Agregar ${track.title}`}>{addingCandidateId === key ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}</button>
                                        </div>;
                                    })}
                                    {!playlistLoading && !playlistTracks.length && <p className="py-6 text-center text-xs text-muted-foreground">No se encontraron canciones reproducibles.</p>}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="pixel-box p-4">
                        <h3 className="font-display text-[8px]">BUSCAR EN TODAS LAS FUENTES</h3>
                        <form onSubmit={submitSearch} className="mt-3 flex gap-2">
                            <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary" placeholder="Cancion, artista o album..." />
                            <button type="submit" disabled={searchLoading} className="border border-primary px-4 text-primary" aria-label="Buscar">{searchLoading ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}</button>
                        </form>
                        <div className="mt-3 max-h-[350px] space-y-2 overflow-y-auto pr-1">
                            {groupedCandidates.map((candidate) => (
                                <div key={`${candidate.provider}:${candidate.id}`} className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 border border-border p-2">
                                    {candidate.image ? <img src={candidate.image} alt="" className="h-11 w-11 object-cover" /> : <div className="h-11 w-11 bg-muted" />}
                                    <div className="min-w-0"><p className="truncate text-sm font-semibold">{candidate.title}</p><p className="truncate text-xs text-muted-foreground">{candidate.artist}</p><div className="mt-1"><ProviderBadge provider={candidate.provider} /></div></div>
                                    <button type="button" onClick={() => void addCandidate(candidate)} disabled={addingCandidateId === `${candidate.provider}:${candidate.id}`} className="border border-primary p-2 text-primary disabled:opacity-50" aria-label={`Agregar ${candidate.title}`}>{addingCandidateId === `${candidate.provider}:${candidate.id}` ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}</button>
                                </div>
                            ))}
                            {!searchLoading && query && !groupedCandidates.length && <p className="py-6 text-center text-xs text-muted-foreground">Sin resultados disponibles.</p>}
                        </div>
                    </div>
                </main>

                <aside className="pixel-box h-fit p-4">
                    <h3 className="font-display text-[8px]">COLA FEDERADA // {mixy.room.queue.length}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Cada canción conserva alternativas para que todos puedan escucharla.</p>
                    <div className="mt-4 max-h-[680px] space-y-2 overflow-y-auto pr-1">
                        {mixy.room.queue.map((track, index) => (
                            <div key={track.id} className={`border p-2 ${index === mixy.room!.playback.queueIndex ? "border-primary bg-primary/5" : "border-border"}`}>
                                <button type="button" onClick={() => void mixy.control({ type: "play-index", queueIndex: index })} className="grid w-full grid-cols-[42px_minmax(0,1fr)] items-center gap-2 text-left">
                                    {track.image ? <img src={track.image} alt="" className="h-10 w-10 object-cover" /> : <div className="h-10 w-10 bg-muted" />}
                                    <span className="min-w-0"><span className="block truncate text-xs font-semibold">{track.title}</span><span className="block truncate text-[10px] text-muted-foreground">{track.artist} · {track.addedByName}</span></span>
                                </button>
                                <div className="mt-2 flex items-center justify-between gap-2"><span className="flex flex-wrap gap-1">{Object.keys(track.sources).map((provider) => <ProviderBadge key={provider} provider={provider as MixyProvider} />)}</span>{mixy.isHost && <button type="button" onClick={() => void mixy.removeTrack(track.id)} className="text-destructive" aria-label={`Quitar ${track.title}`}><Trash2 size={14} /></button>}</div>
                            </div>
                        ))}
                        {!mixy.room.queue.length && <p className="border border-dashed border-border p-5 text-center text-xs text-muted-foreground">La pista de baile espera su primera cancion.</p>}
                    </div>
                </aside>
            </div>
            {mixy.error && <p role="alert" className="mt-4 border border-destructive/60 bg-destructive/10 p-3 text-xs text-destructive">{mixy.error}</p>}
        </section>
    );
};

export default MixyScreen;
