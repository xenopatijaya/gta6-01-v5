// A tiny seeded random number generator (mulberry32) plus the small helpers the
// city builder and the traffic spawner share. Seeding keeps the city identical
// between runs with the same ?seed=, which is what the screenshots rely on.
export function createRandom(seed) {
  let state = (seed >>> 0) || 1;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    // Float in [min, max).
    range(min, max) { return min + next() * (max - min); },
    // Integer in [min, max] inclusive.
    int(min, max) { return Math.floor(min + next() * (max - min + 1)); },
    // Pick one element from an array.
    pick(list) { return list[Math.floor(next() * list.length)]; },
    // True with the given probability.
    chance(p) { return next() < p; },
    // A stable random angle.
    angle() { return next() * Math.PI * 2; },
  };
}

// Clamp a number into [min, max].
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

// Move a value towards a target by at most `step` per call; returns the new value.
export function approach(value, target, step) {
  if (value < target) return Math.min(target, value + step);
  if (value > target) return Math.max(target, value - step);
  return value;
}

// Shortest signed angular difference from `from` to `to`, in radians.
export function angleDiff(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Euclidean distance on the ground plane (ignores y).
export function dist2d(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

// Format an integer amount of dollars with a thousands separator.
export function money(amount) {
  return '$' + Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
