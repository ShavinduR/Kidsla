// Collects Content-Security-Policy violation reports (audit M4).
// While the CSP is in "Report-Only" mode nothing is blocked; browsers just POST here when something
// would have been. Read them in Vercel → your project → Logs (search "csp-violation").
// When a week of normal traffic shows no unexpected reports, switch the header to enforcing.
import { readRaw } from './_lib/http.js'

let windowStart = 0
let logged = 0

export default async function handler(req, res) {
  res.statusCode = 204
  if (req.method !== 'POST') return res.end()
  const raw = await readRaw(req, 16_000) // reports are small; ignore anything bigger
  if (!raw) return res.end()

  // Don't let a flood of reports flood the logs: max 100 lines/minute per instance.
  const now = Date.now()
  if (now - windowStart > 60_000) {
    windowStart = now
    logged = 0
  }
  if (++logged > 100) return res.end()

  try {
    const body = JSON.parse(raw.toString('utf8'))
    // Old format: { "csp-report": {...} }. New Reporting API: [{ type: "csp-violation", body: {...} }]
    const reports = Array.isArray(body) ? body.map((r) => r.body ?? {}) : [body['csp-report'] ?? {}]
    for (const r of reports.slice(0, 5)) {
      const directive = r.effectiveDirective ?? r['effective-directive'] ?? r['violated-directive']
      const blocked = r.blockedURL ?? r['blocked-uri']
      const page = r.documentURL ?? r['document-uri']
      console.warn('[csp-violation]', JSON.stringify({ directive, blocked, page }).slice(0, 500))
    }
  } catch {
    /* malformed report: ignore */
  }
  res.end()
}
