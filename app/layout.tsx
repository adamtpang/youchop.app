import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Chaptr - AI YouTube Chapters',
  description: 'Automatically chapterize YouTube videos with AI. Earn credits by sharing chapters!',
  keywords: 'YouTube, chapters, AI, video, timestamps, chapterize',
  openGraph: {
    title: 'Chaptr - AI YouTube Chapters',
    description: 'Automatically chapterize YouTube videos with AI. Earn credits by sharing chapters!',
    url: 'https://chaptr.app',
    siteName: 'Chaptr',
    images: [
      {
        url: 'https://chaptr.app/og-image.png',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Chaptr - AI YouTube Chapters',
    description: 'Automatically chapterize YouTube videos with AI. Earn credits by sharing chapters!',
    images: ['https://chaptr.app/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
