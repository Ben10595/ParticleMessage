/** Shared choreography keeps scene waits aligned with the actual, unhurried motion. */
export const MOTION_TIMING = {
  interface: 1700, text: 1900, shape: 2200, image: 2000,
  gift: 1300, portal: 1900, dissolve: 1500, returnToField: 1900, retire: 2400,
} as const;

/** Seconds-based response: identical settling time at every display refresh rate. */
export function response(elapsed: number, rate: number) {
  return -Math.expm1(-Math.max(0, elapsed) * rate / 1000);
}

/** Zero velocity and acceleration at both ends, including reversible hold reveals. */
export function easeInOut(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Bounded excursion with soft departure and arrival; peak displacement is 0.5. */
export function revealArc(progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  return 32 * (t * (1 - t)) ** 3;
}
