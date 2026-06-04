import { defineConfig, type Connect, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import { relay } from './api/_relay'

// Dev-only adapter that mounts the same relay used by the Vercel Edge function
// at /api/proxy, so `npm run dev` can exercise API connectors (Sentry, …)
// end-to-end without `vercel dev`. Production uses api/proxy.ts instead.
function devProxyPlugin(): PluginOption {
  return {
    name: 'devcompass-dev-proxy',
    configureServer(server) {
      const handler: Connect.NextHandleFunction = async (req, res) => {
        try {
          // Mounted at /api/proxy, so req.url is the remainder (e.g. "/?url=…").
          const target = new URL(req.url ?? '', 'http://localhost').searchParams.get('url')
          if (!target) { res.statusCode = 400; res.end('missing ?url='); return }

          let body: Buffer | undefined
          if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks: Buffer[] = []
            for await (const chunk of req) chunks.push(chunk as Buffer)
            body = Buffer.concat(chunks)
          }

          const result = await relay({ method: req.method ?? 'GET', targetUrl: target, headers: req.headers, body })
          res.statusCode = result.status
          for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v)
          res.end(Buffer.from(result.body))
        } catch (e) {
          res.statusCode = 502
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }))
        }
      }
      server.middlewares.use('/api/proxy', handler)
    },
  }
}

// `base` honors VITE_BASE so the GitHub Pages workflow can inject the
// repo subpath (e.g. "/devcompass/") at build time. Locally and on
// custom domains it stays "/", which is what `npm run dev` needs.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), devProxyPlugin()],
  server: { port: 8099, open: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react-icons')) return 'icons'
          if (id.includes('framer-motion')) return 'motion'
          if (id.includes('@tanstack') || id.includes('dexie') || id.includes('zustand')) return 'data'
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) return 'react'
          return 'vendor'
        }
      }
    }
  }
})
