import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';
import CursorGlow from '@/components/CursorGlow';
import InstallPrompt from '@/components/InstallPrompt';
import { AuthProvider } from '@/contexts/AuthContext';

export const viewport: Viewport = {
  themeColor: '#000000',
};

export const metadata: Metadata = {
  title: 'FieldVision AI | Get Home 30 Minutes Earlier',
  description:
    "Photos, video, or voice — FieldVision fuses it all into one professional daily report in 30 seconds. Built by a construction project manager for superintendents.",
  keywords:
    'construction daily report, AI daily report, superintendent software, field reporting, construction app, daily log',
  applicationName: 'FieldVision AI',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FieldVision',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'FieldVision AI | Get Home 30 Minutes Earlier',
    description:
      'Photos, video, or voice — FieldVision fuses it all into one professional daily report in 30 seconds. Built by a construction project manager for superintendents.',
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
    icon: '/icon-192x192.png',
    apple: '/icon-192x192.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="overflow-x-hidden">
      <body className="antialiased overflow-x-hidden">
        <AuthProvider>
          <CursorGlow />
          {children}
          <InstallPrompt />
        </AuthProvider>
      </body>
    </html>
  );
}
