import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Deadlock — Atelier de builds',
  description:
    'Choisissez un héros, définissez votre style et préparez votre prochaine partie. Un guide de builds éditorial, indépendant et en français.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
