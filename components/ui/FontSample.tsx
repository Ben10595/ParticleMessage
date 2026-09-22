import type { MessageFont } from '@/types/message';
/** The selector and glyph sampler share the same browser font stacks. */
export default function FontSample({ font }: { font: MessageFont }) {
  return <span className="font-sample" data-message-font={font} aria-hidden="true" />;
}
