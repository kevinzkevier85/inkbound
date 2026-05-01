export const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
