import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'ParticleMessage — Eine Linie. Deine Worte.',
  description: 'Schreibe eine persönliche Nachricht. Lass sie aus einer einzigen lebendigen Linie entstehen. Teile einen Link.',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#060708' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>{children}</body></html>;
}
