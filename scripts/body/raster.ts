import { deflateSync } from "node:zlib";
import { cross, dot, normalize, sub, type Vec3 } from "./mesh";

/** An orthographic view: screen x = dot(p, right), screen y = dot(p, up), depth = dot(p, forward toward the viewer). */
export interface OrthoView { right: Vec3; up: Vec3; toward: Vec3; center: [number, number]; size: [number, number]; width: number; height: number }

export function orthoView(toward: Vec3, up: Vec3, center: [number, number], size: [number, number], width: number): OrthoView {
  const t = normalize(toward);
  const right = normalize(cross(up, t));
  const trueUp = cross(t, right);
  return { right, up: trueUp, toward: t, center, size, width, height: Math.round(width * size[1] / size[0]) };
}

export interface LabelImage { width: number; height: number; label: Int32Array; shade: Float32Array }

/** Z-buffered label render: each pixel gets the label of the nearest triangle facing the viewer (-1 = background). */
export function renderLabels(view: OrthoView, positions: Vec3[], triangles: [number, number, number][], labels: ArrayLike<number>): LabelImage {
  const { width, height } = view;
  const label = new Int32Array(width * height).fill(-1);
  const depth = new Float32Array(width * height).fill(-Infinity);
  const shade = new Float32Array(width * height);
  const project = (p: Vec3): [number, number, number] => [
    ((dot(p, view.right) - view.center[0]) / view.size[0] + .5) * width,
    (.5 - (dot(p, view.up) - view.center[1]) / view.size[1]) * height,
    dot(p, view.toward),
  ];
  const light = normalize([-.3, .5, 1]);
  triangles.forEach(([a, b, c], index) => {
    const n = normalize(cross(sub(positions[b], positions[a]), sub(positions[c], positions[a])));
    if (dot(n, view.toward) <= 0) return;
    const intensity = .35 + .65 * Math.max(0, dot(n, normalize([dot(light, view.right), dot(light, view.up), dot(light, view.toward)].reduce<Vec3>((acc, value, axis) => {
      const basis = [view.right, view.up, view.toward][axis];
      return [acc[0] + basis[0] * value, acc[1] + basis[1] * value, acc[2] + basis[2] * value];
    }, [0, 0, 0]))));
    const [p, q, r] = [project(positions[a]), project(positions[b]), project(positions[c])];
    const area = (q[0] - p[0]) * (r[1] - p[1]) - (r[0] - p[0]) * (q[1] - p[1]);
    if (Math.abs(area) < 1e-12) return;
    const minX = Math.max(0, Math.floor(Math.min(p[0], q[0], r[0]))), maxX = Math.min(width - 1, Math.ceil(Math.max(p[0], q[0], r[0])));
    const minY = Math.max(0, Math.floor(Math.min(p[1], q[1], r[1]))), maxY = Math.min(height - 1, Math.ceil(Math.max(p[1], q[1], r[1])));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = x + .5, py = y + .5;
      const w0 = ((q[0] - px) * (r[1] - py) - (r[0] - px) * (q[1] - py)) / area;
      const w1 = ((r[0] - px) * (p[1] - py) - (p[0] - px) * (r[1] - py)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
      const z = w0 * p[2] + w1 * q[2] + w2 * r[2];
      const pixel = y * width + x;
      if (z <= depth[pixel]) continue;
      depth[pixel] = z; label[pixel] = labels[index]; shade[pixel] = intensity;
    }
  });
  return { width, height, label, shade };
}

/** Minimal RGB PNG writer for inspection images. */
export function rgbPng(width: number, height: number, rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) rgb.subarray(y * width * 3, (y + 1) * width * 3).forEach((value, i) => { raw[y * (width * 3 + 1) + 1 + i] = value; });
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buffer: Buffer) => { let c = 0xffffffff; for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
