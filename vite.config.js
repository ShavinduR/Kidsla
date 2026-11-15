import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Serves /api/* locally (`npm run dev` / `npm run preview`) the same way Vercel does:
// /api/admin/orders → api/admin/orders.js
function localApi(env) {
  const mount = (server) => {
    Object.assign(process.env, env)
    server.middlewares.use(async (req, res, next) => {
      const { pathname } = new URL(req.url, 'http://localhost')
      if (!pathname.startsWith('/api/')) return next()
      const rel = pathname.slice(5)
      const file = path.resolve(process.cwd(), 'api', `${rel}.js`)
      if (!/^[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(rel) || !fs.existsSync(file)) {
        res.statusCode = 404
        return res.end(JSON.stringify({ error: 'Not found' }))
      }
      try {
        // Absolute file URL: Vite runs this config from a temp folder, so relative imports break.
        const { default: handler } = await import(`${pathToFileURL(file).href}?t=${Date.now()}`)
        await handler(req, res)
      } catch (err) {
        console.error(`[api/${rel}]`, err)
        res.statusCode = 500
        res.end(JSON.stringify({ error: 'Local API error' }))
      }
    })
  }
  return { name: 'kidsla-local-api', configureServer: mount, configurePreviewServer: mount }
}

export default defineConfig(({ mode }) => ({
  // '' prefix → also loads server-only secrets from .env.local for the local API (never bundled).
  plugins: [react(), tailwindcss(), localApi(loadEnv(mode, process.cwd(), ''))],
}))
