const withSerwist = require('@serwist/next').default({
  swSrc: 'src/sw.ts',
  swDest: 'public/sw.js',
  register: true,
  disable: process.env.NODE_ENV === 'development',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // O endereço antigo do Render redireciona para a Vercel, para que todos usem o mesmo site e o mesmo banco.
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'paybox-8j56.onrender.com' }],
        destination: 'https://paybox-pearl.vercel.app/:path*',
        permanent: false,
      },
    ]
  },
}

module.exports = withSerwist(nextConfig)
