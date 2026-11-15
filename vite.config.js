import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Serves the /api functions locally (`npm run dev` / `npm run preview`) exactly like Vercel does.
function localApi(env) {
  const mount = (server) => {
    Object.assign(process.env, env)
    for (const name of ['login', 'logout', 'session']) {
      server.middlewares.use(`/api/${name}`, async (req, res) => {
        try {
          // Absolute path: Vite runs this config from a temp folder, so relative imports break.
          const file = pathToFileURL(path.resolve(process.cwd(), 'api', `${name}.js`)).href
          const { default: handler } = await import(`${file}?t=${Date.now()}`)
          await handler(req, res)
        } catch (err) {
          console.error(`[api/${name}]`, err)
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'Local API error' }))
        }
      })
    }
  }
  return { name: 'kidsla-local-api', configureServer: mount, configurePreviewServer: mount }
}

export default defineConfig(({ mode }) => ({
  // '' prefix → also loads non-VITE_ secrets from .env.local for the local API only (never bundled).
  plugins: [react(), tailwindcss(), localApi(loadEnv(mode, process.cwd(), ''))],
}))
