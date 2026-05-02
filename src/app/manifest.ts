import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '가계부',
    short_name: '가계부',
    description: '간단하게 쓰는 나의 가계부',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#B1CBCD',
    theme_color: '#B1CBCD',
    lang: 'ko',
    icons: [
      {
        src: '/icon',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable.png',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
