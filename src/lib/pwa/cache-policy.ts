const LEGACY_RUNTIME_CACHE_NAMES = new Set([
  'google-fonts-webfonts',
  'google-fonts-stylesheets',
  'static-font-assets',
  'static-image-assets',
  'next-static-js-assets',
  'next-image',
  'static-audio-assets',
  'static-video-assets',
  'static-js-assets',
  'static-style-assets',
  'next-data',
  'static-data-assets',
  'apis',
  'pages-rsc-prefetch',
  'pages-rsc',
  'pages',
  'others',
  'cross-origin',
])

export function shouldDeleteLegacyPwaCache(cacheName: string) {
  return cacheName.startsWith('workbox-') || LEGACY_RUNTIME_CACHE_NAMES.has(cacheName)
}
