import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Brawl Club Manager',
  description: 'Gestion interne des clubs Brawl Stars',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
