import type { TransitionEffect, MessageFont, WritingSettings } from '../../types/message';
export interface Box { x: number; y: number; width: number; height: number }
export interface Target { x: number; y: number; z?: number; radius?: number; alpha?: number; color?: [number, number, number]; glyph?: number; part?: number; uiElement?: number; delay?: number }
export interface GlyphBox extends Box { index: number; start: number; end: number }
export interface Sample { targets: Target[]; glyphs: GlyphBox[]; fontSize: number; lineCount: number }
export interface FormOptions { reserveSpace?: boolean; hold?: boolean; bounds?: () => DOMRect; writing?: WritingSettings; effect?: TransitionEffect; finale?: boolean; font?: MessageFont; size?: 'small' | 'medium' | 'large'; align?: 'left' | 'center' | 'right' }
export enum Behavior { FREE, FORMING, LOCKED, DISPERSE, EXPLODE, MAGNETIC, INTERACTIVE, FLOAT, PORTAL }
export const CAPACITY = 18000;
export const COLORS = { ivory: [0.95, 0.93, 0.85] as [number, number, number], gold: [0.82, 0.68, 0.44] as [number, number, number], violet: [0.66, 0.65, 0.83] as [number, number, number] };

export interface SecretBounds extends Box { secret: number }
