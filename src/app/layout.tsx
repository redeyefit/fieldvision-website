import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'FieldVision AI | Get Home 30 Minutes Earlier',
  description:
    "Photos, video, or voice — FieldVision fuses it all into one professional daily report in 30 seconds. Built by a GC for superintendents.",
  keywords:
    'construction daily report, AI daily report, superintendent software, field reporting, construction app, daily log',
  openGraph: {
    title: 'FieldVision AI | Get Home 30 Minutes Earlier',
    description:
      'Photos, video, or voice — FieldVision fuses it all into one professional daily report in 30 seconds. Built by a GC for superintendents.',
    type: 'website',
    url: 'https://getfieldvision.ai',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FieldVision AI | Get Home 30 Minutes Earlier',
    description:
      'Photos, video, or voice — FieldVision fuses it all into one professional daily report in 30 seconds.',
  },
  icons: {
    icon: '/logo_backup.png',
    apple: '/logo_backup.png',
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
