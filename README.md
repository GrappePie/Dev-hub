# Dev Hub

Reproductor musical retro con estética pixel-art que reúne varias fuentes de audio en una sola interfaz. Eliges un "personaje" al estilo arcade y cada uno se conecta a una plataforma distinta:

| Personaje  | Plataforma                   | Qué permite                                                                                          |
|------------|------------------------------|------------------------------------------------------------------------------------------------------|
| **SPOTY**  | Spotify                      | Reproducción con Web Playback SDK, biblioteca, dispositivos y smart shuffle (requiere Premium).      |
| **TUBY**   | YouTube                      | Búsqueda, playlists del usuario y modo video / PiP.                                                  |
| **CLOUDY** | SoundCloud                   | Widget de SoundCloud, biblioteca (playlists, tracks, likes) y comentarios.                           |
| **FILEA**  | Archivos locales / Openverse | Audio local y búsqueda de audio Creative Commons (Jamendo, Freesound, Wikimedia, ccMixter).          |

Incluye visualizador de audio, fondos animados que reaccionan al ritmo (BPM) y efectos de sonido retro.

## Stack

- React 18 + TypeScript + Vite 5 (SWC)
- TanStack Router (rutas basadas en archivos en `src/routes`) y TanStack Query
- Tailwind CSS + componentes shadcn/ui (Radix UI)
- Vitest + Testing Library

## Puesta en marcha

Requisitos: Node.js 20 o superior.

```bash
npm ci
cp .env.example .env    # PowerShell: Copy-Item .env.example .env
npm run dev
```

La app se sirve en <http://127.0.0.1:5500>. El host y el puerto son fijos porque Spotify no acepta `localhost` como redirect URI y las URIs registradas deben coincidir exactamente.

### Variables de entorno

| Variable                        | Uso                                                                                                                   |
|---------------------------------|-----------------------------------------------------------------------------------------------------------------------|
| `VITE_SPOTIFY_CLIENT_ID`        | Client ID de tu app en el [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).                     |
| `VITE_SPOTIFY_REDIRECT_URI`     | Opcional. Por defecto usa la URL actual (`localhost` se normaliza a `127.0.0.1`). Debe estar registrada en Spotify.   |
| `VITE_SOUNDCLOUD_CLIENT_ID`     | Client ID de tu app de SoundCloud.                                                                                    |
| `VITE_SOUNDCLOUD_CLIENT_SECRET` | Client secret de SoundCloud. Ver [Seguridad](#seguridad).                                                             |
| `VITE_SOUNDCLOUD_REDIRECT_URI`  | Opcional. Por defecto usa la URL actual.                                                                              |
| `VITE_YOUTUBE_API_KEY`          | API key de YouTube Data API v3.                                                                                       |
| `VITE_GOOGLE_CLIENT_ID`         | OAuth Client ID de Google para leer las playlists del usuario (scope `youtube.readonly`).                             |

## Scripts

| Comando              | Descripción                                   |
|----------------------|-----------------------------------------------|
| `npm run dev`        | Servidor de desarrollo con HMR.               |
| `npm run build`      | Build de producción en `dist/`.               |
| `npm run build:dev`  | Build en modo desarrollo.                     |
| `npm run preview`    | Sirve el build localmente.                    |
| `npm run lint`       | ESLint.                                       |
| `npm run typecheck`  | Verificación de tipos con TypeScript.         |
| `npm test`           | Tests con Vitest (una sola ejecución).        |
| `npm run test:watch` | Tests en modo watch.                          |

## Estructura

```text
src/
├── routes/          # Rutas de TanStack Router (routeTree.gen.ts se genera automáticamente)
├── pages/           # Pantalla principal (Index): orquesta modos, paneles y fondos
├── components/      # Pantallas, reproductor y UI
│   ├── panels/      # Paneles de búsqueda, biblioteca y dispositivos de cada plataforma
│   ├── backgrounds/ # Escenas animadas en canvas (arcade, hop, starfield)
│   └── ui/          # Componentes shadcn/ui
├── hooks/           # Un hook por plataforma, análisis de audio y SFX
│   └── spotify/     # Sub-hooks que componen useSpotifyPlayer
├── lib/             # Lógica sin React, testeable de forma aislada
│   ├── spotify/     # Config, tipos, mappers y persistencia de cada plataforma
│   ├── soundcloud/
│   ├── youtube/
│   ├── sdk/         # Carga única de los SDKs externos
│   ├── audio/       # AudioContext compartido
│   └── session/     # Reducer de la sesión de la pantalla principal
└── types/           # Tipos compartidos del reproductor y de los SDKs externos
```

Los tests viven junto al código (`*.test.ts` / `*.test.tsx`); la configuración común está en `src/test/setup.ts`.

## Arquitectura

Cada plataforma reparte sus responsabilidades en las mismas capas:

| Capa                 | Ubicación                                | Responsabilidad                                                                 |
|----------------------|------------------------------------------|---------------------------------------------------------------------------------|
| Configuración        | `src/lib/<plataforma>/config.ts`         | Endpoints, scopes, claves de almacenamiento y variables de entorno.             |
| Tipos                | `src/lib/<plataforma>/types.ts`          | Forma de las respuestas de cada API.                                            |
| Mappers              | `src/lib/<plataforma>/mappers.ts`        | Funciones puras que convierten respuestas de la API en tracks y elementos de UI. |
| Persistencia / OAuth | `src/lib/<plataforma>/{auth,storage}.ts` | Tokens, estado OAuth y volumen guardados en el navegador.                        |
| Hook                 | `src/hooks/use<Plataforma>Player.ts`     | Estado de React, efectos y orquestación; expone la API que consume `Index`.     |

### Principios SOLID

- **Responsabilidad única (SRP):** los hooks solo coordinan estado de React y la lógica pura vive en `src/lib`. `useSpotifyPlayer` se compone de sub-hooks especializados (`src/hooks/spotify/`), `Index` delega en paneles (`src/components/panels/`) y las transiciones de pantalla están en un reducer puro (`src/lib/session/sessionReducer.ts`).
- **Abierto/cerrado (OCP):** el selector de fondos se genera desde `BACKGROUND_VARIANT_OPTIONS` (`src/lib/platformTheme.ts`); añadir una variante no requiere modificar el componente.
- **Sustitución de Liskov (LSP):** Spotify, YouTube y SoundCloud cumplen el mismo contrato `CatalogSearch`, así que `useDebouncedCatalogSearch` funciona con cualquiera de ellos.
- **Segregación de interfaces (ISP):** la búsqueda solo depende de `CatalogSearch` (`src/types/player.ts`) y cada panel recibe un `Pick<>` con los campos que usa, no el hook completo.
- **Inversión de dependencias (DIP):** los hooks no acceden a `localStorage` directamente; dependen de la interfaz `KeyValueStorage` (`src/lib/storage.ts`). El adaptador `browserStorage` la implementa sobre `localStorage`, y las factorías `createTokenStore` y `createStoredVolume` la reciben como parámetro, lo que permite inyectar un almacenamiento en memoria en los tests.

### Singletons

Los recursos que deben existir una sola vez por página son instancias a nivel de módulo (el sistema de módulos ES garantiza una única instancia sin clases `getInstance()`):

- **Carga de SDKs** (`src/lib/sdk/loadScript.ts`): una promesa compartida por script. Spotify Web Playback SDK, YouTube IFrame API, Google Identity y SoundCloud Widget se cargan una sola vez aunque varios hooks los pidan; si la carga falla, la siguiente llamada reintenta.
- **AudioContext** (`src/lib/audio/sharedAudioContext.ts`): todo el análisis de audio comparte un contexto creado bajo demanda, porque los navegadores limitan cuántos se pueden abrir.
- **Almacenes de tokens:** una instancia por plataforma (`src/lib/<plataforma>/{auth,storage}.ts`) con sus propias claves.

## Despliegue

`.github/workflows/deploy.yml` se ejecuta en cada push a `main`: instala dependencias, ejecuta lint, typecheck y tests, genera el build y lo publica en GitHub Pages.

1. En **Settings → Pages**, elige **GitHub Actions** como fuente.
2. En **Settings → Secrets and variables → Actions**, crea secrets con los mismos nombres que las variables de entorno.
3. Registra la URL publicada como redirect URI en Spotify, SoundCloud y Google.

> Si el sitio se publica bajo una subruta (por ejemplo `https://<usuario>.github.io/<repo>/`), configura `base` en `vite.config.ts` y `basepath` en el router (`src/main.tsx`); si no, los assets responderán 404.

## Seguridad

Todas las variables `VITE_*` se incrustan en el JavaScript público del build. Es aceptable para client IDs y API keys restringidas, pero **no para secretos**:

- `VITE_SOUNDCLOUD_CLIENT_SECRET` queda visible para cualquiera que abra el sitio. Lo recomendable es mover el intercambio de tokens de SoundCloud (`/oauth/token`) a un backend o función serverless y eliminar esta variable del cliente.
- Restringe `VITE_YOUTUBE_API_KEY` por *HTTP referrer* y por API en Google Cloud Console.
