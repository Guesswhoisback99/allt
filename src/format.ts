import type { Param } from './types';

export type Status = 'low' | 'high' | 'ok';

export function status(v: number, p: Param): Status {
  if (p.lo !== null && v < p.lo) return 'low';
  if (v > p.hi) return 'high';
  return 'ok';
}

export function fmtVal(v: number): string {
  return (+v.toFixed(2)).toString().replace('.', ',');
}

export function fmtDatePL(iso: string): string {
  const parts = iso.split('-');
  const [y, m, d] = parts;
  return `${d}.${m}.${y}`;
}
