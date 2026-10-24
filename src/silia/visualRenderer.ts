import zlib from 'node:zlib';
import { hexToRgb } from './schema.js';
import type { ColorSwatchSpec, CompositionDiagramSpec } from './types.js';

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type: string, data: Buffer): Buffer {
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

export class PixelCanvas {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;

  constructor(width: number, height: number, bg = { r: 22, g: 16, b: 36, a: 255 }) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4);
    this.fillRect(0, 0, width, height, bg);
  }

  setPixel(x: number, y: number, color: { r: number; g: number; b: number; a?: number }): void {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= this.width || iy >= this.height) return;
    const idx = (iy * this.width + ix) * 4;
    const alpha = (color.a ?? 255) / 255;
    if (alpha >= 0.999) {
      this.data[idx] = color.r;
      this.data[idx + 1] = color.g;
      this.data[idx + 2] = color.b;
      this.data[idx + 3] = 255;
    } else {
      const inv = 1 - alpha;
      this.data[idx] = Math.round(color.r * alpha + (this.data[idx] ?? 0) * inv);
      this.data[idx + 1] = Math.round(color.g * alpha + (this.data[idx + 1] ?? 0) * inv);
      this.data[idx + 2] = Math.round(color.b * alpha + (this.data[idx + 2] ?? 0) * inv);
      this.data[idx + 3] = 255;
    }
  }

  fillRect(
    x: number,
    y: number,
    w: number,
    h: number,
    color: { r: number; g: number; b: number; a?: number },
  ): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.ceil(x + w));
    const y1 = Math.min(this.height, Math.ceil(y + h));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        this.setPixel(px, py, color);
      }
    }
  }

  strokeRect(
    x: number,
    y: number,
    w: number,
    h: number,
    thickness: number,
    color: { r: number; g: number; b: number; a?: number },
  ): void {
    this.fillRect(x, y, w, thickness, color);
    this.fillRect(x, y + h - thickness, w, thickness, color);
    this.fillRect(x, y, thickness, h, color);
    this.fillRect(x + w - thickness, y, thickness, h, color);
  }

  drawDashedRect(
    x: number,
    y: number,
    w: number,
    h: number,
    dashLen: number,
    color: { r: number; g: number; b: number; a?: number },
  ): void {
    for (let px = x; px < x + w; px++) {
      if (Math.floor((px - x) / dashLen) % 2 === 0) {
        this.setPixel(px, y, color);
        this.setPixel(px, y + 1, color);
        this.setPixel(px, y + h - 1, color);
        this.setPixel(px, y + h - 2, color);
      }
    }
    for (let py = y; py < y + h; py++) {
      if (Math.floor((py - y) / dashLen) % 2 === 0) {
        this.setPixel(x, py, color);
        this.setPixel(x + 1, py, color);
        this.setPixel(x + w - 1, py, color);
        this.setPixel(x + w - 2, py, color);
      }
    }
  }

  fillCircle(
    cx: number,
    cy: number,
    radius: number,
    color: { r: number; g: number; b: number; a?: number },
  ): void {
    const r2 = radius * radius;
    for (let py = Math.floor(cy - radius); py <= Math.ceil(cy + radius); py++) {
      for (let px = Math.floor(cx - radius); px <= Math.ceil(cx + radius); px++) {
        const dx = px - cx;
        const dy = py - cy;
        if (dx * dx + dy * dy <= r2) {
          this.setPixel(px, py, color);
        }
      }
    }
  }

  drawLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    thickness: number,
    color: { r: number; g: number; b: number; a?: number },
  ): void {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = x0 + (x1 - x0) * t;
      const py = y0 + (y1 - y0) * t;
      this.fillRect(px - thickness / 2, py - thickness / 2, thickness, thickness, color);
    }
  }

  toPngBuffer(): Buffer {
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.width, 0);
    ihdr.writeUInt32BE(this.height, 4);
    ihdr[8] = 8; // bit depth 8
    ihdr[9] = 6; // color type RGBA
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    const stride = this.width * 4;
    const rawScanlines = Buffer.alloc((stride + 1) * this.height);
    for (let y = 0; y < this.height; y++) {
      const rowStart = y * (stride + 1);
      rawScanlines[rowStart] = 0; // filter type None
      Buffer.from(this.data.buffer, y * stride, stride).copy(rawScanlines, rowStart + 1);
    }

    const compressed = zlib.deflateSync(rawScanlines, { level: 6 });
    return Buffer.concat([
      signature,
      makeChunk('IHDR', ihdr),
      makeChunk('IDAT', compressed),
      makeChunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

/**
 * Generates a single color swatch PNG (e.g., 72x36px) with a subtle dark border
 * for embedding inside the .docx Color Table.
 */
export function renderColorSwatchPng(hex: string, width = 72, height = 36): Buffer {
  const rgb = hexToRgb(hex);
  const canvas = new PixelCanvas(width, height, { ...rgb, a: 255 });
  canvas.strokeRect(0, 0, width, height, 2, { r: 22, g: 16, b: 36, a: 255 });
  canvas.strokeRect(2, 2, width - 4, height - 4, 1, { r: 255, g: 255, b: 255, a: 60 });
  return canvas.toPngBuffer();
}

/**
 * Generates a horizontal palette bar PNG showing all colors proportional to their usage
 * for Discord proposal presentation and .docx header visual.
 */
export function renderPaletteStripPng(
  palette: ColorSwatchSpec[],
  width = 640,
  height = 96,
): Buffer {
  const canvas = new PixelCanvas(width, height, { r: 15, g: 11, b: 26, a: 255 });
  const pad = 8;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const totalWeight = palette.reduce((acc, c) => acc + Math.max(5, c.proportionPct || 20), 0);
  let cursorX = pad;

  palette.forEach((swatch, idx) => {
    const weight = Math.max(5, swatch.proportionPct || 20);
    const segW =
      idx === palette.length - 1
        ? width - pad - cursorX
        : Math.max(24, Math.round((weight / totalWeight) * innerW));

    const rgb = hexToRgb(swatch.hex);
    canvas.fillRect(cursorX, pad, segW, innerH, { ...rgb, a: 255 });
    // Subtle vertical divider between swatches
    if (idx > 0) {
      canvas.fillRect(cursorX, pad, 3, innerH, { r: 15, g: 11, b: 26, a: 255 });
    }
    cursorX += segW;
  });

  canvas.strokeRect(0, 0, width, height, 3, { r: 139, g: 92, b: 246, a: 255 });
  return canvas.toPngBuffer();
}

/**
 * Generates a programmatic Composition & Visual Hierarchy Diagram PNG
 * displaying safe margins, layout zones, reading flow vector, and focal crosshair.
 */
export function renderCompositionDiagramPng(
  composition: CompositionDiagramSpec,
  palette: ColorSwatchSpec[],
  width = 560,
  height = 315,
): Buffer {
  const bgHex = palette.find((c) => c.role === 'neutra_fundo')?.hex || '#161024';
  const domHex = palette.find((c) => c.role === 'dominante')?.hex || '#8B5CF6';
  const secHex = palette.find((c) => c.role === 'secundaria')?.hex || '#52B7FF';
  const accHex = palette.find((c) => c.role === 'acento')?.hex || '#D6456B';

  const bgRgb = hexToRgb(bgHex);
  const domRgb = hexToRgb(domHex);
  const secRgb = hexToRgb(secHex);
  const accRgb = hexToRgb(accHex);

  const canvas = new PixelCanvas(width, height, { ...bgRgb, a: 255 });

  // Rule of thirds subtle grid lines
  const gridColor = { r: 255, g: 255, b: 255, a: 28 };
  canvas.drawLine(width / 3, 0, width / 3, height, 1, gridColor);
  canvas.drawLine((width * 2) / 3, 0, (width * 2) / 3, height, 1, gridColor);
  canvas.drawLine(0, height / 3, width, height / 3, 1, gridColor);
  canvas.drawLine(0, (height * 2) / 3, width, (height * 2) / 3, 1, gridColor);

  // Safe margin dashed rectangle
  const marginPct = Math.max(4, Math.min(18, composition.safeMarginPct || 8));
  const mx = Math.round((marginPct / 100) * width);
  const my = Math.round((marginPct / 100) * height);
  canvas.drawDashedRect(mx, my, width - mx * 2, height - my * 2, 8, {
    ...secRgb,
    a: 150,
  });

  // Composition zones
  const zoneColors = [domRgb, secRgb, accRgb];
  composition.zones.forEach((zone, index) => {
    const zx = Math.round((zone.xPct / 100) * width);
    const zy = Math.round((zone.yPct / 100) * height);
    const zw = Math.round((zone.wPct / 100) * width);
    const zh = Math.round((zone.hPct / 100) * height);
    const zColor = zoneColors[index % zoneColors.length]!;

    canvas.fillRect(zx, zy, zw, zh, { ...zColor, a: 48 });
    canvas.strokeRect(zx, zy, zw, zh, 2, { ...zColor, a: 215 });
  });

  // Focal point target & crosshair
  const fx = Math.round(((composition.focalPoint.xPct || 50) / 100) * width);
  const fy = Math.round(((composition.focalPoint.yPct || 45) / 100) * height);
  canvas.fillCircle(fx, fy, 16, { ...accRgb, a: 85 });
  canvas.fillCircle(fx, fy, 6, { r: 255, g: 255, b: 255, a: 245 });
  canvas.drawLine(fx - 24, fy, fx + 24, fy, 2, { ...accRgb, a: 230 });
  canvas.drawLine(fx, fy - 24, fx, fy + 24, 2, { ...accRgb, a: 230 });

  // Reading flow vector from focal point toward lower/secondary zone
  const endX = Math.round(width * 0.5);
  const endY = Math.round(height * 0.78);
  canvas.drawLine(fx, fy, endX, endY, 3, { ...secRgb, a: 210 });
  canvas.fillCircle(endX, endY, 5, { ...secRgb, a: 245 });

  // Outer frame
  canvas.strokeRect(0, 0, width, height, 3, { ...domRgb, a: 255 });
  return canvas.toPngBuffer();
}
