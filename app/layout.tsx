import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'ParticleMessage — Kleine Worte. Großes Gefühl.',
  description: 'Schreibe eine persönliche Nachricht. Lass sie aus tausenden lebendigen Partikeln entstehen. Teile einen Link.',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#080a0d' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>{children}</body></html>;
}
