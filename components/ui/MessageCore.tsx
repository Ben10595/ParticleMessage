'use client';

import { useRef, type PointerEvent } from 'react';

export type MessageCoreMode = 'resting' | 'open' | 'listening' | 'charging' | 'dispatching' | 'sent' | 'locked' | 'error';

interface MessageCoreProps {
  activity?: number;
  label: string;
  mode: MessageCoreMode;
}

export default function MessageCore({ activity = 0, label, mode }: MessageCoreProps) {
  const root = useRef<HTMLDivElement>(null);

  function followPointer(event: PointerEvent<HTMLDivElement>) {
    const element = root.current;
    if (!element || mode === 'charging' || mode === 'dispatching') return;
    const bounds = element.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    element.style.setProperty('--core-pointer-x', x.toFixed(3));
    element.style.setProperty('--core-pointer-y', y.toFixed(3));
  }

  function resetPointer() {
    root.current?.style.setProperty('--core-pointer-x', '0');
    root.current?.style.setProperty('--core-pointer-y', '0');
  }

  return (
    <div
      ref={root}
      className="message-core"
      data-core-mode={mode}
      onPointerMove={followPointer}
      onPointerLeave={resetPointer}
      role="img"
      aria-label={label}
    >
      <div className="core-aura" aria-hidden="true" />
      <div className="core-orbit core-orbit-outer" aria-hidden="true"><i /><i /><i /></div>
      <div className="core-orbit core-orbit-inner" aria-hidden="true"><i /><i /></div>
      <svg className="core-object" viewBox="0 0 320 320" aria-hidden="true">
        <defs>
          <linearGradient id="core-stroke-a" x1="28" y1="30" x2="292" y2="290" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F7FBFF" />
            <stop offset="0.34" stopColor="#7DE7FF" />
            <stop offset="0.72" stopColor="#4A86FF" />
            <stop offset="1" stopColor="#A98DFF" />
          </linearGradient>
          <linearGradient id="core-stroke-b" x1="286" y1="40" x2="52" y2="284" gradientUnits="userSpaceOnUse">
            <stop stopColor="#89F0FF" />
            <stop offset="0.52" stopColor="#EEF7FF" />
            <stop offset="1" stopColor="#7177FF" />
          </linearGradient>
          <radialGradient id="core-fill" cx="0" cy="0" r="1" gradientTransform="translate(137 117) rotate(53) scale(150 143)" gradientUnits="userSpaceOnUse">
            <stop stopColor="#E9FCFF" stopOpacity="0.48" />
            <stop offset="0.2" stopColor="#66DDFC" stopOpacity="0.24" />
            <stop offset="0.56" stopColor="#3159C9" stopOpacity="0.11" />
            <stop offset="1" stopColor="#050816" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="core-nucleus" cx="0" cy="0" r="1" gradientTransform="translate(157 151) rotate(90) scale(65)" gradientUnits="userSpaceOnUse">
            <stop stopColor="#E9FDFF" stopOpacity="0.94" />
            <stop offset="0.12" stopColor="#96F0FF" stopOpacity="0.65" />
            <stop offset="0.42" stopColor="#58CFFF" stopOpacity="0.2" />
            <stop offset="1" stopColor="#528DFF" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="core-facet" x1="116" y1="121" x2="201" y2="211" gradientUnits="userSpaceOnUse">
            <stop stopColor="#EAFBFF" stopOpacity="0.82" />
            <stop offset="0.5" stopColor="#83E5FF" stopOpacity="0.43" />
            <stop offset="1" stopColor="#9B8EFF" stopOpacity="0.64" />
          </linearGradient>
          <linearGradient id="core-depth" x1="117" y1="130" x2="204" y2="188" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0C2444" stopOpacity="0.14" />
            <stop offset="0.52" stopColor="#48D3F3" stopOpacity="0.24" />
            <stop offset="1" stopColor="#A18CFF" stopOpacity="0.09" />
          </linearGradient>
          <filter id="core-glow" x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="core-soft-light" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
        </defs>
        <circle className="core-glass" cx="160" cy="160" r="116" />
        <ellipse className="core-latitude core-latitude-a" cx="160" cy="160" rx="107" ry="42" />
        <ellipse className="core-latitude core-latitude-b" cx="160" cy="160" rx="107" ry="42" />
        <path className="core-meridian core-meridian-a" d="M160 44C218 82 238 120 238 160C238 200 218 238 160 276" />
        <path className="core-meridian core-meridian-b" d="M160 44C102 82 82 120 82 160C82 200 102 238 160 276" />
        <path className="core-membrane" d="M160 43C207 43 267 93 269 152C271 211 220 271 158 274C96 277 45 225 48 158C51 91 113 43 160 43Z" fill="url(#core-fill)" />
        <path className="core-ribbon core-ribbon-a" d="M66 174C90 115 133 81 187 76C222 73 251 89 259 116" />
        <path className="core-ribbon core-ribbon-b" d="M256 153C247 190 216 211 177 221C141 230 104 246 89 273" />
        <path className="core-ribbon core-ribbon-c" d="M91 91C66 124 61 165 76 199C91 234 126 257 163 258C198 259 229 240 247 211" />
        <path className="core-ribbon core-ribbon-d" d="M216 70C194 102 191 122 208 145C226 169 229 190 214 215" />
        <path className="core-shadow-facet" d="M110 127L159 101L211 128L209 181L160 211L110 182Z" />
        <path className="core-facet-back" d="M110 127L160 157L211 128L209 181L160 211L110 182Z" />
        <path className="core-facet" d="M110 127L160 157L211 128L160 99Z" />
        <path className="core-facet-side" d="M110 127L160 157L160 211L110 182Z" />
        <path className="core-facet-side core-facet-side-right" d="M160 157L211 128L209 181L160 211Z" />
        <path className="core-envelope" d="M121 137L160 161L200 137M121 137V175L160 198L200 175V137" />
        <path className="core-envelope-fold" d="M121 175L145 157M200 175L176 157" />
        <circle className="core-nucleus-glow" cx="160" cy="160" r="43" fill="url(#core-nucleus)" />
        <circle className="core-nucleus" cx="160" cy="160" r="3.2" />
        <circle className="core-nucleus-ring" cx="160" cy="160" r="13" />
        <path className="core-loop" d="M94 160C94 124 123 95 160 95C197 95 226 124 226 160C226 196 197 225 160 225C123 225 94 196 94 160Z" />
        <path className="core-signal" d="M139 160L153 174L183 143" />
      </svg>
      <span className="core-light core-light-a" aria-hidden="true" />
      <span className="core-light core-light-b" aria-hidden="true" />
      <span className="core-light core-light-c" aria-hidden="true" />
      <span key={activity} className="core-activity" aria-hidden="true" />
      <span className="core-status" aria-hidden="true">
        <i />
        {mode === 'charging' ? 'Wird verschlüsselt' : mode === 'dispatching' ? 'Wird gesendet' : mode === 'sent' ? 'Erfolgreich gesendet' : 'Core bereit'}
      </span>
    </div>
  );
}
