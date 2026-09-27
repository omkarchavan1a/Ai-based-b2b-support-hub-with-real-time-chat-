import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI B2B Support Hub',
  description: 'Multi-tenant AI-powered B2B support hub with real-time chat',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
