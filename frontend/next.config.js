/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\.cloudfront\.net\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'hls-cache',
        expiration: { maxAgeSeconds: 60 * 60 * 24 },
      },
    },
    {
      urlPattern: /\/api\/anime\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: { maxAgeSeconds: 60 * 5 },
        networkTimeoutSeconds: 10,
      },
    },
  ],
});

const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      's4.anilist.co',
      'img.animepahe.ru',
      'cdn.myanimelist.net',
      'your-s3-bucket.s3.amazonaws.com',
      'your-cloudfront-domain.cloudfront.net',
    ],
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

module.exports = withPWA(nextConfig);
