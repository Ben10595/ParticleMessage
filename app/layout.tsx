import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'ParticleMessage — Worte werden Punkte',
  description: 'Schreibe eine persönliche Nachricht. Lass sie aus tausenden Punkten entstehen. Teile einen Link.',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#06080b' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>{children}</body></html>;
}
