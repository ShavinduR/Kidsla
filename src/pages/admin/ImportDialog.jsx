import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Dialog, btn } from './ui'
import { importInventory } from '../../services/adminApi'

// Step 1 (already done by the caller): dry run → this report. Step 2: Apply → same file, for real.
export default function ImportDialog({ file, report, onClose, onApplied }) {
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const { changes, errors, updates, rows } = report

  const apply = async () => {
    setApplying(true)
    setError('')
    const res = await importInventory(file, { dryRun: false })
    setApplying(false)
    if (!res.ok) return setError(res.error ?? 'Import failed. Nothing was changed.')
    onApplied(res)
  }

  return (
    <Dialog
      title="Review import"
      subtitle={`${file.name} · ${rows} row${rows === 1 ? '' : 's'} read`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={`${btn.secondary} flex-1`}>Cancel</button>
          <button onClick={apply} disabled={!updates.length || applying} className={`${btn.primary} flex-1`}>
            {applying ? 'Saving…' : `Apply ${updates.length || ''} update${updates.length === 1 ? '' : 's'}`}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {errors.length > 0 && (
          <div className="rounded-2xl bg-rose/10 p-4 ring-1 ring-rose/30">
            <p className="flex items-center gap-2 font-semibold text-rose">
              <TriangleAlert className="h-4 w-4" /> {errors.length} problem{errors.length > 1 ? 's' : ''}: these rows will be skipped
            </p>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm text-ink">{errors.map((e) => <li key={e}>• {e}</li>)}</ul>
          </div>
        )}
        <div>
          <p className="font-semibold">{changes.length} product{changes.length === 1 ? '' : 's'} will change</p>
          {changes.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">No differences from what’s in the database.</p>
          ) : (
            <ul className="mt-3 divide-y divide-sand rounded-2xl bg-white ring-1 ring-sand">
              {changes.map((c) => (
                <li key={c.id} className="p-4">
                  <p className="font-medium">{c.title} <span className="font-mono text-xs text-ink-soft">{c.id}</span></p>
                  <ul className="mt-1 text-sm text-ink-soft">{c.diff.map((d) => <li key={d}>{d}</li>)}</ul>
                </li>
              ))}
            </ul>
          )}
        </div>
        {error && <p role="alert" className="text-sm font-medium text-rose">{error}</p>}
      </div>
    </Dialog>
  )
}
