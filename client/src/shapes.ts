export type ShapeId = 'blob' | 'star' | 'heart' | 'diamond' | 'cat';

export const SHAPES: { id: ShapeId; label: string }[] = [
  { id: 'blob', label: '블롭' },
  { id: 'cat', label: '고양이' },
  { id: 'star', label: '별' },
  { id: 'heart', label: '하트' },
  { id: 'diamond', label: '다이아' },
];

/** Draws a closed silhouette path centered in a `size` x `size` box. Caller fills/clips it. */
export function traceShapePath(ctx: CanvasRenderingContext2D, shape: ShapeId, size: number) {
  const c = size / 2;
  ctx.beginPath();
  switch (shape) {
    case 'blob': {
      ctx.arc(c, c, size * 0.42, 0, Math.PI * 2);
      break;
    }
    case 'star': {
      const spikes = 5;
      const outer = size * 0.46;
      const inner = size * 0.19;
      let rot = (Math.PI / 2) * 3;
      const step = Math.PI / spikes;
      ctx.moveTo(c, c - outer);
      for (let i = 0; i < spikes; i++) {
        ctx.lineTo(c + Math.cos(rot) * outer, c + Math.sin(rot) * outer);
        rot += step;
        ctx.lineTo(c + Math.cos(rot) * inner, c + Math.sin(rot) * inner);
        rot += step;
      }
      ctx.closePath();
      break;
    }
    case 'heart': {
      const s = size * 0.032;
      ctx.moveTo(c, c + 12 * s);
      ctx.bezierCurveTo(c - 15 * s, c - 4 * s, c - 13 * s, c - 14 * s, c, c - 6 * s);
      ctx.bezierCurveTo(c + 13 * s, c - 14 * s, c + 15 * s, c - 4 * s, c, c + 12 * s);
      break;
    }
    case 'diamond': {
      const r = size * 0.44;
      ctx.moveTo(c, c - r);
      ctx.lineTo(c + r * 0.75, c);
      ctx.lineTo(c, c + r);
      ctx.lineTo(c - r * 0.75, c);
      ctx.closePath();
      break;
    }
    case 'cat': {
      const r = size * 0.32;
      ctx.arc(c, c + size * 0.06, r, 0, Math.PI * 2);
      ctx.moveTo(c - r * 0.8, c - size * 0.16);
      ctx.lineTo(c - r * 1.35, c - size * 0.42);
      ctx.lineTo(c - r * 0.15, c - size * 0.2);
      ctx.closePath();
      ctx.moveTo(c + r * 0.8, c - size * 0.16);
      ctx.lineTo(c + r * 1.35, c - size * 0.42);
      ctx.lineTo(c + r * 0.15, c - size * 0.2);
      ctx.closePath();
      break;
    }
  }
}

export function renderShapeIcon(shape: ShapeId, size = 64, color = '#9ca3af'): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  traceShapePath(ctx, shape, size);
  ctx.fillStyle = color;
  ctx.fill();
  return canvas.toDataURL();
}
