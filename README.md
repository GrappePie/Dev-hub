# Dev Hub

Dev Hub es un reproductor musical pixel-art que reúne Spotify, SoundCloud, YouTube y archivos locales en una sola interfaz. Incluye búsqueda, bibliotecas y colas por plataforma, comentarios, visualizador de audio y detección de BPM en tiempo real.

## Desarrollo local

Requisitos: Node.js 20 o posterior y npm.

```bash
npm install
cp .env.example .env
npm run dev
```

La aplicación abre en `http://127.0.0.1:5500`. Configura en cada proveedor esa misma URL como callback durante el desarrollo.

## Variables de entorno

Las variables `VITE_*` se incorporan al JavaScript público. Solo deben contener identificadores o claves diseñadas para usarse desde el navegador.

```dotenv
VITE_SPOTIFY_CLIENT_ID=
VITE_SPOTIFY_REDIRECT_URI=http://127.0.0.1:5500/
VITE_SOUNDCLOUD_CLIENT_ID=
VITE_SOUNDCLOUD_REDIRECT_URI=http://127.0.0.1:5500/
VITE_YOUTUBE_API_KEY=
VITE_GOOGLE_CLIENT_ID=

# Opcional: permite usar otro cliente en el servidor.
# SOUNDCLOUD_CLIENT_ID=
SOUNDCLOUD_CLIENT_SECRET=
SOUNDCLOUD_REDIRECT_URI=http://127.0.0.1:5500/
```

`SOUNDCLOUD_CLIENT_SECRET` es exclusivamente de servidor. El navegador envía el código OAuth a `/api/soundcloud/token`; el middleware de Vite atiende esa ruta en desarrollo y `api/soundcloud/token.ts` la expone como función serverless en producción. El backend reutiliza `VITE_SOUNDCLOUD_CLIENT_ID`, ya que el client ID es público; `SOUNDCLOUD_CLIENT_ID` solo es necesario si quieres sobrescribirlo.

La aplicación completa no debe desplegarse en GitHub Pages: Pages solo publica archivos estáticos y no puede ejecutar `/api/soundcloud/token`. Usa un hosting con funciones serverless (por ejemplo Vercel) o configura un backend externo antes de habilitar el despliegue de producción.

Antes de publicar:

- Rota el secreto de SoundCloud si estuvo presente en algún build público.
- Restringe `VITE_YOUTUBE_API_KEY` a los dominios de producción y desarrollo autorizados, y limita su uso a YouTube Data API v3.
- Configura `SOUNDCLOUD_REDIRECT_URI` con el mismo valor exacto registrado en SoundCloud.
- Añade las variables server-only a la configuración del proveedor de despliegue; no las expongas con prefijo `VITE_`.

## Comandos

```bash
npm run dev       # servidor Vite con endpoint OAuth local
npm run test      # pruebas unitarias
npm run lint      # ESLint
npm run build     # build de producción
npm run preview   # previsualiza el frontend; OAuth requiere una función /api activa
```

## Arquitectura

- React 18 + TypeScript + Vite
- TanStack Router y TanStack Query
- Tailwind CSS + Radix UI
- APIs Web Playback/OAuth de Spotify, SoundCloud Widget/API y YouTube IFrame/Data API

Las rutas viven en `src/routes`; `src/routeTree.gen.ts` se genera automáticamente mediante el plugin de TanStack Router.
