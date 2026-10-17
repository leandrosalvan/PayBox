import { useEffect, useState } from 'react'
import { defaultCurrency, defaultLocale } from '@/lib/locales'
import type { SupportedCurrency, SupportedLocale } from '@/lib/locales'

export interface Preferences {
  locale: SupportedLocale
  currency: SupportedCurrency
}

let cached: Preferences | null = null
let inflight: Promise<void> | null = null
const listeners = new Set<(prefs: Preferences) => void>()

function load() {
  inflight ??= fetch('/api/user/profile')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data?.locale && data?.currency) setPreferences({ locale: data.locale, currency: data.currency })
    })
    .catch(() => {})
    .finally(() => {
      inflight = null
    })
}

export function setPreferences(prefs: Preferences) {
  cached = prefs
  listeners.forEach((listener) => listener(prefs))
}

export function usePreferences(): Preferences {
  const [prefs, setPrefs] = useState<Preferences>(cached ?? { locale: defaultLocale, currency: defaultCurrency })

  useEffect(() => {
    listeners.add(setPrefs)
    if (cached) setPrefs(cached)
    else load()
    return () => {
      listeners.delete(setPrefs)
    }
  }, [])

  return prefs
}
