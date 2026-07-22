import { rasterizeMascot, type ShapeId } from './shapes';
import type { HitRegion } from './types';

export type EditorMode = 'move' | 'paint' | 'erase' | 'eyedrop';

const MASK_SIZE = 220;
const DEFAULT_FILL = '#f5f4f1';
const HISTORY_LIMIT = 15;

interface CharacterInstance {
  id: string;
  shape: ShapeId;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  paint: HTMLCanvasElement;
  history: ImageData[];
  future: ImageData[];
}

function makePaintCanvas(shape: ShapeId): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = MASK_SIZE;
  c.height = MASK_SIZE;
  const ctx = c.getContext('2d')!;
  rasterizeMascot(ctx, shape, MASK_SIZE);
  return c;
}

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `ch-${idCounter}-${Date.now()}`;
}

export interface SelectionInfo {
  id: string | null;
  canUndo: boolean;
  canRedo: boolean;
}

export class CanvasEditor {
  private ctx: CanvasRenderingContext2D;
  private characters: CharacterInstance[] = [];
  private selectedId: string | null = null;
  private mode: EditorMode = 'move';
  private brushColor = '#8a6d3b';
  private brushSize = 26;
  private brushOpacity = 1;

  private drag: null | { kind: 'move' | 'transform'; charId: string; offX: number; offY: number } = null;
  private isPainting = false;
  private lastPaintPoint: { x: number; y: number } | null = null;
  private strokeSnapshotSaved = false;

  onSelectionChange: (info: SelectionInfo) => void = () => {};
  onChange: () => void = () => {};

  private canvas: HTMLCanvasElement;
  private background: HTMLImageElement;
  width: number;
  height: number;

  constructor(canvas: HTMLCanvasElement, background: HTMLImageElement, width: number, height: number) {
    this.canvas = canvas;
    this.background = background;
    this.width = width;
    this.height = height;
    canvas.width = width;
    canvas.height = height;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    this.redraw();
  }

  get characterCount() {
    return this.characters.length;
  }

  setMode(mode: EditorMode) {
    this.mode = mode;
  }

  setBrush(opts: { color?: string; size?: number; opacity?: number }) {
    if (opts.color !== undefined) this.brushColor = opts.color;
    if (opts.size !== undefined) this.brushSize = opts.size;
    if (opts.opacity !== undefined) this.brushOpacity = opts.opacity;
  }

  addCharacter(shape: ShapeId) {
    const inst: CharacterInstance = {
      id: nextId(),
      shape,
      x: this.width / 2,
      y: this.height / 2,
      scale: Math.min(this.width, this.height) / (MASK_SIZE * 2.6),
      rotation: 0,
      paint: makePaintCanvas(shape),
      history: [],
      future: [],
    };
    this.characters.push(inst);
    this.select(inst.id);
    this.redraw();
    this.onChange();
  }

  deleteSelected() {
    if (!this.selectedId) return;
    this.characters = this.characters.filter((c) => c.id !== this.selectedId);
    this.select(null);
    this.redraw();
    this.onChange();
  }

  private select(id: string | null) {
    this.selectedId = id;
    const c = this.characters.find((ch) => ch.id === id);
    this.onSelectionChange({
      id,
      canUndo: !!c && c.history.length > 0,
      canRedo: !!c && c.future.length > 0,
    });
  }

  private toLocalPos(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * this.width;
    const y = ((clientY - rect.top) / rect.height) * this.height;
    return { x, y };
  }

  private findCharacterAt(x: number, y: number): CharacterInstance | null {
    for (let i = this.characters.length - 1; i >= 0; i--) {
      const c = this.characters[i];
      const dx = x - c.x;
      const dy = y - c.y;
      const cos = Math.cos(-c.rotation);
      const sin = Math.sin(-c.rotation);
      const lx = (dx * cos - dy * sin) / c.scale;
      const ly = (dx * sin + dy * cos) / c.scale;
      if (Math.abs(lx) <= MASK_SIZE / 2 && Math.abs(ly) <= MASK_SIZE / 2) return c;
    }
    return null;
  }

  private handleWorld(c: CharacterInstance) {
    const half = MASK_SIZE / 2;
    const h = { x: half, y: -half };
    const cos = Math.cos(c.rotation);
    const sin = Math.sin(c.rotation);
    return {
      x: c.x + (h.x * cos - h.y * sin) * c.scale,
      y: c.y + (h.x * sin + h.y * cos) * c.scale,
    };
  }

  handlePointerDown = (e: { clientX: number; clientY: number }) => {
    const { x, y } = this.toLocalPos(e.clientX, e.clientY);

    if (this.mode === 'eyedrop') {
      const color = this.sampleColorAt(x, y);
      if (color) this.brushColor = color;
      this.onChange();
      return;
    }

    if (this.mode === 'move') {
      const selected = this.characters.find((c) => c.id === this.selectedId);
      if (selected) {
        const handle = this.handleWorld(selected);
        if (Math.hypot(x - handle.x, y - handle.y) < 22) {
          this.drag = { kind: 'transform', charId: selected.id, offX: 0, offY: 0 };
          return;
        }
      }
      const hit = this.findCharacterAt(x, y);
      if (hit) {
        this.select(hit.id);
        this.drag = { kind: 'move', charId: hit.id, offX: x - hit.x, offY: y - hit.y };
      } else {
        this.select(null);
      }
      this.redraw();
      return;
    }

    // paint / erase modes
    const target = this.characters.find((c) => c.id === this.selectedId);
    if (!target) return;
    this.isPainting = true;
    this.strokeSnapshotSaved = false;
    this.paintAt(target, x, y, true);
  };

  handlePointerMove = (e: { clientX: number; clientY: number }) => {
    const { x, y } = this.toLocalPos(e.clientX, e.clientY);

    if (this.drag) {
      const c = this.characters.find((ch) => ch.id === this.drag!.charId);
      if (!c) return;
      if (this.drag.kind === 'move') {
        c.x = x - this.drag.offX;
        c.y = y - this.drag.offY;
      } else {
        const vx = x - c.x;
        const vy = y - c.y;
        const half = MASK_SIZE / 2;
        const l0 = Math.hypot(half, half);
        const dist = Math.hypot(vx, vy);
        c.scale = Math.min(3, Math.max(0.35, dist / l0));
        c.rotation = Math.atan2(vy, vx) - Math.atan2(-half, half);
      }
      this.redraw();
      return;
    }

    if (this.isPainting) {
      const target = this.characters.find((c) => c.id === this.selectedId);
      if (target) this.paintAt(target, x, y, false);
    }
  };

  handlePointerUp = () => {
    this.drag = null;
    this.isPainting = false;
    this.lastPaintPoint = null;
  };

  private paintAt(c: CharacterInstance, x: number, y: number, isStart: boolean) {
    const cos = Math.cos(-c.rotation);
    const sin = Math.sin(-c.rotation);
    const dx = x - c.x;
    const dy = y - c.y;
    const lx = (dx * cos - dy * sin) / c.scale + MASK_SIZE / 2;
    const ly = (dx * sin + dy * cos) / c.scale + MASK_SIZE / 2;

    if (!this.strokeSnapshotSaved) {
      this.pushHistory(c);
      this.strokeSnapshotSaved = true;
    }

    const pctx = c.paint.getContext('2d')!;
    pctx.save();
    pctx.globalCompositeOperation = 'source-atop';
    pctx.globalAlpha = this.mode === 'erase' ? 1 : this.brushOpacity;
    pctx.fillStyle = this.mode === 'erase' ? DEFAULT_FILL : this.brushColor;
    pctx.strokeStyle = pctx.fillStyle;
    pctx.lineWidth = this.brushSize / c.scale;
    pctx.lineCap = 'round';
    pctx.lineJoin = 'round';

    if (isStart || !this.lastPaintPoint) {
      pctx.beginPath();
      pctx.arc(lx, ly, this.brushSize / 2 / c.scale, 0, Math.PI * 2);
      pctx.fill();
    } else {
      pctx.beginPath();
      pctx.moveTo(this.lastPaintPoint.x, this.lastPaintPoint.y);
      pctx.lineTo(lx, ly);
      pctx.stroke();
    }
    pctx.restore();
    this.lastPaintPoint = { x: lx, y: ly };
    this.redraw();
  }

  private pushHistory(c: CharacterInstance) {
    const ctx = c.paint.getContext('2d')!;
    const snap = ctx.getImageData(0, 0, MASK_SIZE, MASK_SIZE);
    c.history.push(snap);
    if (c.history.length > HISTORY_LIMIT) c.history.shift();
    c.future = [];
  }

  undo() {
    const c = this.characters.find((ch) => ch.id === this.selectedId);
    if (!c || c.history.length === 0) return;
    const ctx = c.paint.getContext('2d')!;
    const current = ctx.getImageData(0, 0, MASK_SIZE, MASK_SIZE);
    c.future.push(current);
    const prev = c.history.pop()!;
    ctx.putImageData(prev, 0, 0);
    this.select(c.id);
    this.redraw();
  }

  redo() {
    const c = this.characters.find((ch) => ch.id === this.selectedId);
    if (!c || c.future.length === 0) return;
    const ctx = c.paint.getContext('2d')!;
    const current = ctx.getImageData(0, 0, MASK_SIZE, MASK_SIZE);
    c.history.push(current);
    const next = c.future.pop()!;
    ctx.putImageData(next, 0, 0);
    this.select(c.id);
    this.redraw();
  }

  sampleColorAt(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    const data = this.ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    return `#${[data[0], data[1], data[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }

  redraw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.drawImage(this.background, 0, 0, this.width, this.height);

    for (const c of this.characters) {
      // Soft grounding shadow beneath the figure, sells the sculpted-toy volume.
      ctx.save();
      ctx.filter = 'blur(4px)';
      ctx.fillStyle = 'rgba(15,15,15,0.22)';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y + (MASK_SIZE / 2) * c.scale * 0.86, MASK_SIZE * 0.24 * c.scale, MASK_SIZE * 0.08 * c.scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rotation);
      ctx.scale(c.scale, c.scale);
      ctx.drawImage(c.paint, -MASK_SIZE / 2, -MASK_SIZE / 2);
      ctx.restore();

      if (c.id === this.selectedId && this.mode === 'move') {
        ctx.save();
        ctx.strokeStyle = '#ff5a7a';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rotation);
        const half = (MASK_SIZE / 2) * c.scale;
        ctx.strokeRect(-half, -half, half * 2, half * 2);
        ctx.restore();

        const handle = this.handleWorld(c);
        ctx.save();
        ctx.fillStyle = '#ff5a7a';
        ctx.beginPath();
        ctx.arc(handle.x, handle.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  exportComposite(): { dataUrl: string; hitRegions: HitRegion[]; characterCount: number } {
    const wasSelected = this.selectedId;
    this.select(null);
    this.redraw();
    const dataUrl = this.canvas.toDataURL('image/jpeg', 0.86);

    const hitRegions: HitRegion[] = this.characters.map((c) => {
      const r = ((MASK_SIZE / 2) * c.scale * 0.88) / this.width;
      const ry = ((MASK_SIZE / 2) * c.scale * 0.88) / this.height;
      return { x: c.x / this.width, y: c.y / this.height, rx: r, ry };
    });

    if (wasSelected) this.select(wasSelected);
    this.redraw();
    return { dataUrl, hitRegions, characterCount: this.characters.length };
  }
}
