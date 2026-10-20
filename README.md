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
├── pages/           # Pantalla principal (Index)
├── components/      # Pantallas, reproductor y UI
│   ├── backgrounds/ # Escenas animadas en canvas (arcade, hop, starfield)
│   └── ui/          # Componentes shadcn/ui
├── hooks/           # Integraciones con Spotify, YouTube y SoundCloud, análisis de audio y SFX
├── lib/             # Lógica pura (shuffle, smart shuffle, temas) y utilidades
└── types/           # Tipos globales de los SDKs externos
```

Los tests viven junto al código (`*.test.ts` / `*.test.tsx`); la configuración común está en `src/test/setup.ts`.

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
