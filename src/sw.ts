import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { NetworkOnly, Serwist } from 'serwist'
import { shouldDeleteLegacyPwaCache } from './lib/pwa/cache-policy'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // Precached build assets stay available, but authenticated pages and APIs are never persisted.
  runtimeCaching: [
    {
      matcher: /.*/i,
      handler: new NetworkOnly(),
    },
  ],
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter(shouldDeleteLegacyPwaCache)
          .map((cacheName) => caches.delete(cacheName)),
      ),
    ),
  )
})

serwist.addEventListeners()
