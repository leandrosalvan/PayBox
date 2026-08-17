import { describe, expect, it } from 'vitest'
import { shouldDeleteLegacyPwaCache } from './cache-policy'

describe('legacy PWA cache policy', () => {
  it.each([
    'workbox-precache-v2-https://paybox.example/',
    'apis',
    'next-data',
    'pages',
    'others',
  ])('removes cache %s', (cacheName) => {
    expect(shouldDeleteLegacyPwaCache(cacheName)).toBe(true)
  })

  it.each([
    'serwist-precache-v2-https://paybox.example/',
    'unrelated-application-cache',
  ])('preserves cache %s', (cacheName) => {
    expect(shouldDeleteLegacyPwaCache(cacheName)).toBe(false)
  })
})
