import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '가계부',
    short_name: '가계부',
    description: '간단하게 쓰는 나의 가계부',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F2F4F6',
    theme_color: '#00B956',
    lang: 'ko',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Full-bleed with the mark inside the safe zone, so any launcher mask fits.
      { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
