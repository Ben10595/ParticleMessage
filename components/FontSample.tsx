import { layoutLineText } from '@/lines/lineFont';
import type { MessageFont } from '@/types/message';

// Menu samples use the very same paths as the animated message.
export default function FontSample({ font }: { font: MessageFont }) {
  const layout = layoutLineText('Aa', { x: 2, y: 0, width: 52, height: 32 }, 21, 'center', font);
  return <svg className="font-sample" viewBox="0 0 56 32" aria-hidden="true" focusable="false">
    {layout.glyphs.flatMap(g => g.paths.map((path, index) => <polyline key={`${g.index}-${index}`} points={path.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />))}
  </svg>;
}
