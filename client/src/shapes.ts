export type ShapeId = 'standing' | 'waving' | 'cheering' | 'kneeling' | 'reaching';

export const SHAPES: { id: ShapeId; label: string }[] = [
  { id: 'standing', label: '서있기' },
  { id: 'waving', label: '손흔들기' },
  { id: 'cheering', label: '만세' },
  { id: 'kneeling', label: '앉기' },
  { id: 'reaching', label: '뻗기' },
];

interface Ball {
  x: number;
  y: number;
  r: number;
}

interface Pose {
  leftArmDeg: number;
  rightArmDeg: number;
  leftLegDeg: number;
  rightLegDeg: number;
  legLengthScale?: number;
}

// Rotation convention (angleDeg=0 points straight down from the pivot):
// positive angles swing toward the left (0=down -> 90=left -> 180=up),
// negative angles swing toward the right (0=down -> -90=right -> -180=up).
const POSES: Record<ShapeId, Pose> = {
  standing: { leftArmDeg: 12, rightArmDeg: -12, leftLegDeg: 6, rightLegDeg: -6 },
  waving: { leftArmDeg: 12, rightArmDeg: -150, leftLegDeg: 6, rightLegDeg: -6 },
  cheering: { leftArmDeg: 170, rightArmDeg: -170, leftLegDeg: 6, rightLegDeg: -6 },
  kneeling: { leftArmDeg: 20, rightArmDeg: -20, leftLegDeg: 105, rightLegDeg: -105, legLengthScale: 0.65 },
  reaching: { leftArmDeg: 95, rightArmDeg: -25, leftLegDeg: 25, rightLegDeg: -25 },
};

/** A short chain of overlapping balls from a pivot along `angleDeg`, tapering from rStart to rEnd. */
function limbBalls(px: number, py: number, length: number, angleDeg: number, rStart: number, rEnd: number): Ball[] {
  const rad = (angleDeg * Math.PI) / 180;
  const endX = px - length * Math.sin(rad);
  const endY = py + length * Math.cos(rad);
  const segments = 2;
  const balls: Ball[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    balls.push({ x: px + (endX - px) * t, y: py + (endY - py) * t, r: rStart + (rEnd - rStart) * t });
  }
  return balls;
}

/**
 * A minimalist matte-white clay mascot built entirely from overlapping
 * metaball spheres (no rigid rectangles) so limbs, torso, and head fuse
 * into one seamless sculpted silhouette with soft organic curves - a
 * perfectly round featureless head, thick cylindrical limbs, no rigid
 * joints or seams. Ball coordinates are in a `size` x `size` box.
 */
function buildBalls(shape: ShapeId, size: number): Ball[] {
  const c = size / 2;
  const pose = POSES[shape];
  const balls: Ball[] = [];

  const hipY = size * 0.6;
  const legLength = size * 0.27 * (pose.legLengthScale ?? 1);
  balls.push(...limbBalls(c - size * 0.13, hipY, legLength, pose.leftLegDeg, size * 0.115, size * 0.095));
  balls.push(...limbBalls(c + size * 0.13, hipY, legLength, pose.rightLegDeg, size * 0.115, size * 0.095));

  const shoulderY = size * 0.36;
  const armLength = size * 0.25;
  balls.push(...limbBalls(c - size * 0.21, shoulderY, armLength, pose.leftArmDeg, size * 0.1, size * 0.085));
  balls.push(...limbBalls(c + size * 0.21, shoulderY, armLength, pose.rightArmDeg, size * 0.1, size * 0.085));

  // Torso: three stacked spheres so it tapers into a smooth rounded barrel.
  balls.push({ x: c, y: size * 0.36, r: size * 0.125 });
  balls.push({ x: c, y: size * 0.445, r: size * 0.145 });
  balls.push({ x: c, y: size * 0.53, r: size * 0.12 });

  // Head: perfectly round, no facial features, fused directly to the torso.
  balls.push({ x: c, y: size * 0.19, r: size * 0.165 });

  return balls;
}

function smoothstep(edge0: number, edge1: number, v: number) {
  const t = Math.min(1, Math.max(0, (v - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

const CLAY_STOPS: [number, string][] = [
  [0, '#ffffff'],
  [0.55, '#f5f4f1'],
  [1, '#dedad2'],
];

/**
 * Rasterizes the metaball mascot silhouette directly into `ctx`, matte
 * white with a soft single-light-source gradient baked in. This is a
 * pixel-level fill (not a vector path) so overlapping limbs/torso/head
 * blend into one seamless blobby shape instead of stacked rigid pieces.
 */
export function rasterizeMascot(ctx: CanvasRenderingContext2D, shape: ShapeId, size: number) {
  const balls = buildBalls(shape, size);

  const gradCanvas = document.createElement('canvas');
  gradCanvas.width = size;
  gradCanvas.height = size;
  const gctx = gradCanvas.getContext('2d')!;
  const gradient = gctx.createRadialGradient(size * 0.38, size * 0.2, size * 0.04, size * 0.5, size * 0.55, size * 0.62);
  for (const [stop, color] of CLAY_STOPS) gradient.addColorStop(stop, color);
  gctx.fillStyle = gradient;
  gctx.fillRect(0, 0, size, size);
  const gradData = gctx.getImageData(0, 0, size, size).data;

  const out = ctx.createImageData(size, size);
  // Finite-support field (zero beyond 1.2x each ball's radius) so balls
  // only fuse with genuinely nearby/overlapping balls - enough to round off
  // joints seamlessly without swallowing whole limbs into the torso.
  const threshold = 0.5;
  const band = 0.1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      for (const b of balls) {
        const dx = x - b.x;
        const dy = y - b.y;
        const d2 = dx * dx + dy * dy;
        const influence = b.r * 1.2;
        const inf2 = influence * influence;
        if (d2 < inf2) sum += 1 - d2 / inf2;
      }
      const idx = (y * size + x) * 4;
      const alpha = sum >= threshold - band ? smoothstep(threshold - band, threshold, sum) : 0;
      out.data[idx] = gradData[idx];
      out.data[idx + 1] = gradData[idx + 1];
      out.data[idx + 2] = gradData[idx + 2];
      out.data[idx + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(out, 0, 0);
}

export function renderShapeIcon(shape: ShapeId, size = 64): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  rasterizeMascot(ctx, shape, size);
  return canvas.toDataURL();
}
