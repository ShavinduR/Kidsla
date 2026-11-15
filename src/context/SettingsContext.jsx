import { createContext, useContext, useEffect, useState } from 'react'
import { DEFAULT_SETTINGS } from '../data/site'

// Shop settings (delivery fees, payment methods…) from /api/settings, edited in /admin → Settings.
// Starts with the defaults so the shop works instantly; the server always re-prices orders anyway.
const SettingsContext = createContext({ ...DEFAULT_SETTINGS, payments: { ...DEFAULT_SETTINGS.payments, online: false } })

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS, payments: { ...DEFAULT_SETTINGS.payments, online: false } }))
  useEffect(() => {
    let cancelled = false
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => !cancelled && s?.deliveryFees && setSettings(s))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSettings = () => useContext(SettingsContext)
