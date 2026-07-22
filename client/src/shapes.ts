export type ShapeId = 'standing' | 'waving' | 'cheering' | 'kneeling' | 'reaching';

export const SHAPES: { id: ShapeId; label: string }[] = [
  { id: 'standing', label: '서있기' },
  { id: 'waving', label: '손흔들기' },
  { id: 'cheering', label: '만세' },
  { id: 'kneeling', label: '앉기' },
  { id: 'reaching', label: '뻗기' },
];

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
// So a left-side limb swings outward with a positive angle, a right-side
// limb swings outward with a negative angle.
const POSES: Record<ShapeId, Pose> = {
  standing: { leftArmDeg: 12, rightArmDeg: -12, leftLegDeg: 6, rightLegDeg: -6 },
  waving: { leftArmDeg: 12, rightArmDeg: -150, leftLegDeg: 6, rightLegDeg: -6 },
  cheering: { leftArmDeg: 170, rightArmDeg: -170, leftLegDeg: 6, rightLegDeg: -6 },
  kneeling: { leftArmDeg: 20, rightArmDeg: -20, leftLegDeg: 105, rightLegDeg: -105, legLengthScale: 0.65 },
  reaching: { leftArmDeg: 95, rightArmDeg: -25, leftLegDeg: 25, rightLegDeg: -25 },
};

/** Adds a rounded capsule/pill to the current path, pivoted at (px, py) and pointing "down" at angleDeg 0. */
function addLimb(ctx: CanvasRenderingContext2D, px: number, py: number, length: number, width: number, angleDeg: number) {
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate((angleDeg * Math.PI) / 180);
  const r = width / 2;
  ctx.roundRect(-r, 0, width, length, r);
  ctx.restore();
}

/**
 * Draws a minimalist white-clay mascot silhouette: round featureless head,
 * chunky rounded torso, thick stubby limbs in a given pose. Chibi-ish
 * proportions (big head, short chunky limbs) to read as a soft sculpted
 * clay figurine. Centered in a `size` x `size` box. Caller fills it as one
 * path.
 */
export function traceShapePath(ctx: CanvasRenderingContext2D, shape: ShapeId, size: number) {
  const c = size / 2;
  const pose = POSES[shape];

  ctx.beginPath();

  // Legs (drawn first so the torso's rounded edge overlaps their tops)
  const hipY = size * 0.58;
  const legLength = size * 0.24 * (pose.legLengthScale ?? 1);
  const legWidth = size * 0.17;
  addLimb(ctx, c - size * 0.11, hipY, legLength, legWidth, pose.leftLegDeg);
  addLimb(ctx, c + size * 0.11, hipY, legLength, legWidth, pose.rightLegDeg);

  // Arms - short and chunky
  const shoulderY = size * 0.36;
  const armLength = size * 0.22;
  const armWidth = size * 0.15;
  addLimb(ctx, c - size * 0.16, shoulderY, armLength, armWidth, pose.leftArmDeg);
  addLimb(ctx, c + size * 0.16, shoulderY, armLength, armWidth, pose.rightArmDeg);

  // Torso - squat and highly rounded
  const torsoW = size * 0.36;
  const torsoH = size * 0.28;
  ctx.roundRect(c - torsoW / 2, size * 0.32, torsoW, torsoH, size * 0.16);

  // Head (large, round, featureless)
  ctx.moveTo(c + size * 0.2, size * 0.21);
  ctx.arc(c, size * 0.21, size * 0.2, 0, Math.PI * 2);
}

export function renderShapeIcon(shape: ShapeId, size = 64, color = '#f5f4f1'): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  traceShapePath(ctx, shape, size);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = Math.max(1, size * 0.02);
  ctx.strokeStyle = '#d8d5cf';
  ctx.stroke();
  return canvas.toDataURL();
}
