/**
 * Minimal lossless 8-bit grayscale PNG codec for paint layers. Uses only web-standard globals that also exist in
 * Node 20+ (CompressionStream, DecompressionStream, TextEncoder) — no DOM, canvas, or WebGL.
 */
export type MapErrorCode = "version" | "format" | "dimensions" | "corrupt" | "too-large" | "note-too-long";
export class MapValidationError extends Error {
  readonly code: MapErrorCode;
  constructor(code: MapErrorCode, message: string) { super(message); this.name = "MapValidationError"; this.code = code; }
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(bytes: Uint8Array, start: number, end: number) {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function transform(data: Uint8Array, stream: CompressionStream | DecompressionStream, maxOutput: number): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  const writing = writer.write(data as Uint8Array<ArrayBuffer>).then(() => writer.close());
  writing.catch(() => undefined);
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxOutput) { await reader.cancel().catch(() => undefined); throw new MapValidationError("corrupt", "Paint map image data is larger than its declared size."); }
    chunks.push(value);
  }
  await writing;
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}

function chunk(type: string, data: Uint8Array) {
  const bytes = new Uint8Array(12 + data.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) bytes[4 + i] = type.charCodeAt(i);
  bytes.set(data, 8);
  view.setUint32(8 + data.length, crc32(bytes, 4, 8 + data.length));
  return bytes;
}

export async function encodeGrayPng(pixels: Uint8Array, width: number, height: number): Promise<Uint8Array> {
  if (pixels.length !== width * height) throw new Error("Pixel buffer does not match its dimensions.");
  // Each row uses the Up filter, which compresses the soft vertical gradients of brush marks well.
  const filtered = new Uint8Array(height * (width + 1));
  for (let row = 0; row < height; row++) {
    const out = row * (width + 1);
    filtered[out] = 2;
    for (let column = 0; column < width; column++) {
      const above = row ? pixels[(row - 1) * width + column] : 0;
      filtered[out + 1 + column] = (pixels[row * width + column] - above) & 0xff;
    }
  }
  const compressed = await transform(filtered, new CompressionStream("deflate"), Infinity);
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width); view.setUint32(4, height);
  header.set([8, 0, 0, 0, 0], 8); // bit depth 8, grayscale, deflate, adaptive filtering, no interlace
  const parts = [Uint8Array.from(SIGNATURE), chunk("IHDR", header), chunk("IDAT", compressed), chunk("IEND", new Uint8Array())];
  const png = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { png.set(part, offset); offset += part.length; }
  return png;
}

/** Decodes only the exact format this feature writes; any other PNG flavour is rejected rather than reinterpreted. */
export async function decodeGrayPng(png: Uint8Array, width: number, height: number): Promise<Uint8Array> {
  if (png.length < 8 || SIGNATURE.some((byte, i) => png[i] !== byte)) throw new MapValidationError("format", "Paint map is not a PNG image.");
  if (png.length < 8 + 25 + 12) throw new MapValidationError("corrupt", "Paint map image is truncated.");
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const idat: Uint8Array[] = [];
  let offset = 8, sawHeader = false, sawEnd = false;
  while (offset < png.length) {
    if (offset + 12 > png.length) throw new MapValidationError("corrupt", "Paint map image is truncated.");
    const length = view.getUint32(offset);
    if (offset + 12 + length > png.length) throw new MapValidationError("corrupt", "Paint map image is truncated.");
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    if (crc32(png, offset + 4, offset + 8 + length) !== view.getUint32(offset + 8 + length)) throw new MapValidationError("corrupt", "Paint map image failed its integrity check.");
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (!sawHeader && type !== "IHDR") throw new MapValidationError("format", "Paint map image has no header.");
    if (type === "IHDR") {
      if (sawHeader || length !== 13) throw new MapValidationError("format", "Paint map image header is invalid.");
      sawHeader = true;
      const header = new DataView(data.buffer, data.byteOffset, 13);
      if (header.getUint32(0) !== width || header.getUint32(4) !== height) throw new MapValidationError("dimensions", `Paint map must be ${width}x${height} pixels.`);
      if (data[8] !== 8 || data[9] !== 0 || data[10] !== 0 || data[11] !== 0 || data[12] !== 0) throw new MapValidationError("format", "Paint map must be an 8-bit grayscale, non-interlaced PNG.");
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") { sawEnd = true; break; }
    else if (type.charCodeAt(0) < 97) throw new MapValidationError("format", `Paint map image has an unsupported ${type} chunk.`);
    offset += 12 + length;
  }
  if (!sawEnd || !idat.length) throw new MapValidationError("corrupt", "Paint map image is incomplete.");
  const compressed = new Uint8Array(idat.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of idat) { compressed.set(part, at); at += part.length; }
  const stride = width + 1;
  let raw: Uint8Array;
  try { raw = await transform(compressed, new DecompressionStream("deflate"), height * stride); }
  catch (error) { throw error instanceof MapValidationError ? error : new MapValidationError("corrupt", "Paint map image data could not be decompressed."); }
  if (raw.length !== height * stride) throw new MapValidationError("corrupt", "Paint map image data does not match its dimensions.");
  const pixels = new Uint8Array(width * height);
  for (let row = 0; row < height; row++) {
    const filter = raw[row * stride];
    for (let column = 0; column < width; column++) {
      const value = raw[row * stride + 1 + column];
      const left = column ? pixels[row * width + column - 1] : 0;
      const above = row ? pixels[(row - 1) * width + column] : 0;
      const corner = row && column ? pixels[(row - 1) * width + column - 1] : 0;
      let predictor: number;
      switch (filter) {
        case 0: predictor = 0; break;
        case 1: predictor = left; break;
        case 2: predictor = above; break;
        case 3: predictor = (left + above) >> 1; break;
        case 4: {
          const p = left + above - corner, pa = Math.abs(p - left), pb = Math.abs(p - above), pc = Math.abs(p - corner);
          predictor = pa <= pb && pa <= pc ? left : pb <= pc ? above : corner; break;
        }
        default: throw new MapValidationError("corrupt", "Paint map image uses an unknown row filter.");
      }
      pixels[row * width + column] = (value + predictor) & 0xff;
    }
  }
  return pixels;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LOOKUP = new Int16Array(128).fill(-1);
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET.charCodeAt(i)] = i;

export function bytesToBase64(bytes: Uint8Array): string {
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    output += ALPHABET[a >> 2] + ALPHABET[((a & 3) << 4) | ((b ?? 0) >> 4)] +
      (i + 1 < bytes.length ? ALPHABET[((b & 15) << 2) | ((c ?? 0) >> 6)] : "=") + (i + 2 < bytes.length ? ALPHABET[c & 63] : "=");
  }
  return output;
}

export function base64ToBytes(text: string): Uint8Array {
  if (text.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) throw new MapValidationError("corrupt", "Paint map is not valid base64.");
  const padding = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0;
  const bytes = new Uint8Array(text.length / 4 * 3 - padding);
  let out = 0;
  for (let i = 0; i < text.length; i += 4) {
    const a = LOOKUP[text.charCodeAt(i)], b = LOOKUP[text.charCodeAt(i + 1)];
    const c = text[i + 2] === "=" ? 0 : LOOKUP[text.charCodeAt(i + 2)], d = text[i + 3] === "=" ? 0 : LOOKUP[text.charCodeAt(i + 3)];
    const triple = (a << 18) | (b << 12) | (c << 6) | d;
    if (out < bytes.length) bytes[out++] = triple >> 16;
    if (out < bytes.length) bytes[out++] = (triple >> 8) & 0xff;
    if (out < bytes.length) bytes[out++] = triple & 0xff;
  }
  return bytes;
}
