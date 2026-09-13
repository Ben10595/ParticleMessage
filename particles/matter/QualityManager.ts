/** Hysteresis prevents quality oscillation. Density changes affect subsequent samplings. */
export class QualityManager {
  level = 1;
  private elapsed = 0; private frames = 0; private slowWindows = 0; private fastWindows = 0;
  fps = 60;
  sample(dt: number) {
    this.elapsed += dt; this.frames++;
    if (this.elapsed < 2200) return false;
    this.fps = Math.round(this.frames * 1000 / this.elapsed);
    this.slowWindows = this.fps < 43 ? this.slowWindows + 1 : 0;
    this.fastWindows = this.fps > 57 ? this.fastWindows + 1 : 0;
    const old = this.level;
    if (this.slowWindows >= 2) { this.level = Math.max(.45, this.level - .2); this.slowWindows = 0; }
    if (this.fastWindows >= 5) { this.level = Math.min(1, this.level + .1); this.fastWindows = 0; }
    this.frames = this.elapsed = 0; return old !== this.level;
  }
}
