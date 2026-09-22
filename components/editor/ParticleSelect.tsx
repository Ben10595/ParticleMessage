'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { useLinePresence } from '../hooks/useLinePresence';

interface Option { value: string; label: string; disabled?: boolean; preview?: ReactNode }
interface Props { label: string; value: string; options: Option[]; disabled?: boolean; onChange: (value: string) => void }

// A select-only combobox: focus stays on the trigger; options are announced via
// aria-activedescendant. The popup keeps its contour mounted through the closing animation.
export default function ParticleSelect({ label, value, options, disabled, onChange }: Props) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const search = useRef({ text: '', at: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [above, setAbove] = useState(false);
  const selected = options.findIndex(option => option.value === value);
  const expanded = open && !disabled;
  const present = useLinePresence(expanded);
  function show() {
    const rect = trigger.current?.getBoundingClientRect();
    setAbove(Boolean(rect && innerHeight - rect.bottom < 270 && rect.top > innerHeight - rect.bottom));
    setActive(selected >= 0 && !options[selected].disabled ? selected : options.findIndex(option => !option.disabled));
    setOpen(true);
  }
  function choose(index: number) {
    if (!options[index] || options[index].disabled) return;
    onChange(options[index].value); setOpen(false); trigger.current?.focus({ preventScroll: true });
  }
  useEffect(() => {
    if (!expanded) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const resize = () => setOpen(false);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', resize);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', resize); };
  }, [expanded]);
  useEffect(() => {
    if (expanded) popup.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [expanded, active]);
  function keydown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Tab') { setOpen(false); return; }
    if (event.key === 'Escape') { if (expanded) { event.preventDefault(); event.stopPropagation(); setOpen(false); } return; }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      if (!expanded) { show(); return; }
      if (event.key === 'Enter' || event.key === ' ') { choose(active); return; }
      const step = event.key === 'ArrowUp' || event.key === 'End' ? -1 : 1;
      let index = event.key === 'Home' ? -1 : event.key === 'End' ? options.length : active;
      do { index += step; } while (options[index]?.disabled);
      if (options[index]) setActive(index);
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      search.current = { text: (now - search.current.at < 650 ? search.current.text : '') + event.key.toLocaleLowerCase('de'), at: now };
      const index = options.findIndex(option => !option.disabled && option.label.toLocaleLowerCase('de').startsWith(search.current.text));
      if (index >= 0) { if (!expanded) show(); setActive(index); }
    }
  }
  return <div ref={root} className="particle-select" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} type="button" role="combobox" aria-label={label} aria-expanded={expanded} aria-haspopup="listbox" aria-controls={`${id}-list`} aria-activedescendant={expanded ? `${id}-${active}` : undefined} disabled={disabled} data-particle="control" data-text={options[selected]?.label ?? value} className="select-trigger" onClick={() => expanded ? setOpen(false) : show()} onKeyDown={keydown}>
      <span className="select-value">{options[selected]?.label ?? value}{options[selected]?.preview}</span><span className="dot-chevron" aria-hidden="true" />
    </button>
    {present && <div aria-hidden={!expanded || undefined} inert={!expanded} ref={popup} id={`${id}-list`} role="listbox" aria-label={label} className={`select-options ${above ? 'opens-above' : ''} ${!expanded ? 'is-closing' : ''}`} data-particle-overlay="true">
      {options.map((option, index) => <div key={option.value} id={`${id}-${index}`} role="option" aria-selected={option.value === value} aria-disabled={option.disabled || undefined} data-index={index} className={`select-option ${index === active ? 'is-active' : ''}`} onPointerMove={() => { if (!option.disabled) setActive(index); }} onPointerDown={event => event.preventDefault()} onClick={() => choose(index)}>
        <span className="select-value"><span className="dot-label">{option.label}</span>{option.preview}</span><span className="selection-dot" aria-hidden="true" />
      </div>)}
    </div>}
  </div>;
}
