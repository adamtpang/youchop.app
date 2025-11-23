import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'YouChop - AI YouTube Chapters',
  description: 'Chop any YouTube video into AI-powered chapters. Instant navigation, perfect timestamps.',
  keywords: 'YouTube, chapters, AI, video, timestamps, chapterize, youchop',
  openGraph: {
    title: 'YouChop - AI YouTube Chapters',
    description: 'Chop any YouTube video into AI-powered chapters. Instant navigation, perfect timestamps.',
    url: 'https://youchop.app',
    siteName: 'YouChop',
    images: [
      {
        url: 'https://youchop.app/og-image.png',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'YouChop - AI YouTube Chapters',
    description: 'Chop any YouTube video into AI-powered chapters. Instant navigation, perfect timestamps.',
    images: ['https://youchop.app/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
