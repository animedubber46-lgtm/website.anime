import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import Navbar from '@/components/layout/Navbar';

export const metadata: Metadata = {
  title: { default: 'AnimeX — Premium Anime Streaming', template: '%s | AnimeX' },
  description: 'Watch anime online in HD. Stream the latest episodes with subtitles.',
  keywords: ['anime', 'streaming', 'watch anime online', 'HD anime'],
  manifest: '/manifest.json',
  themeColor: '#070710',
  openGraph: {
    type: 'website',
    siteName: 'AnimeX',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-animex-bg text-animex-text font-body antialiased">
        <Providers>
          <Navbar />
          <main className="min-h-screen">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
