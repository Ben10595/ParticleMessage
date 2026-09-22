import type { Target } from './types';

/** Match equal spatial partitions rather than screen rows, which flip at row boundaries.
 * Each target is assigned once. Work happens only when the shape changes. */
export function matchTargets(slots: number[], targets: Target[], x: Float32Array, y: Float32Array) {
  function partition(ids: number[], points: Target[]): { ids: number[]; points: Target[] } {
    if (ids.length < 2) return { ids, points };
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for (const i of ids) { minX=Math.min(minX,x[i]);maxX=Math.max(maxX,x[i]);minY=Math.min(minY,y[i]);maxY=Math.max(maxY,y[i]); }
    for (const p of points) { minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y); }
    const horizontal=maxX-minX>=maxY-minY;
    ids.sort((a,b)=>horizontal ? x[a]-x[b]||y[a]-y[b]||a-b : y[a]-y[b]||x[a]-x[b]||a-b);
    points.sort((a,b)=>horizontal ? a.x-b.x||a.y-b.y : a.y-b.y||a.x-b.x);
    const mid=Math.floor(ids.length/2);
    const left=partition(ids.slice(0,mid),points.slice(0,mid));
    const right=partition(ids.slice(mid),points.slice(mid));
    return { ids:left.ids.concat(right.ids),points:left.points.concat(right.points) };
  }
  return partition(slots,targets);
}
