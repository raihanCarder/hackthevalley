import * as THREE from "three";
import { MAP_SIZE } from "../domain/contracts";
import type { BodyAtlas } from "./atlas";
import { TEXEL_COUNT, type PaintLayers } from "./layers";

/** Shader time used for captures and reduced motion: patterns stay visible but do not change. */
export const STATIC_TIME = 1.37;

const vertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vObject;
void main() {
  vUv = uv;
  vObject = position;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Paint texture channels: R burning, G sharp, B aching, A tingling. CPU row 0 is the top of the atlas, while
// DataTexture row 0 is uploaded at t = 0, so the vertical flip happens here and nowhere else.
const fragmentShader = /* glsl */ `
uniform sampler2D uPaint;
uniform float uTime;
uniform float uMotion;
uniform vec3 uBase;
uniform vec3 uSky;
uniform vec3 uGround;
uniform vec3 uKeyColor;
uniform vec3 uKeyDir;
uniform vec3 uFillColor;
uniform vec3 uFillDir;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vObject;

float hash13(vec3 p3) { p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1., 0., 0.)), f.x), mix(hash13(i + vec3(0., 1., 0.)), hash13(i + vec3(1., 1., 0.)), f.x), f.y),
             mix(mix(hash13(i + vec3(0., 0., 1.)), hash13(i + vec3(1., 0., 1.)), f.x), mix(hash13(i + vec3(0., 1., 1.)), hash13(i + vec3(1., 1., 1.)), f.x), f.y), f.z);
}
float fbm(vec3 p) { return .55 * noise(p) + .3 * noise(p * 2.03 + 7.1) + .15 * noise(p * 4.01 + 3.7); }

void main() {
  vec4 paint = texture2D(uPaint, vec2(vUv.x, 1.0 - vUv.y));
  float t = uTime;
  bool moving = uMotion > .5;
  vec4 presence = smoothstep(vec4(.04), vec4(.07), paint);
  vec4 weight = presence * (.42 + .58 * paint);

  // Burning: red-orange with slow, rising heat shimmer.
  float heat = fbm(vObject * 24.0 + vec3(0.0, -t * .5, t * .17));
  float hot = smoothstep(.42, .8, heat);
  vec3 burning = mix(vec3(.66, .045, .005), vec3(1.0, .34, .02), hot);

  // Sharp: white-hot points on a dark ground with flickering four-point spikes.
  vec2 grid = vUv * ${MAP_SIZE.toFixed(1)} / 5.0;
  vec2 cell = floor(grid);
  vec2 local = fract(grid) - .5;
  float seed = hash12(cell);
  vec2 d = local - (vec2(hash12(cell + 17.0), hash12(cell + 43.0)) - .5) * .36;
  float r = length(d);
  float angle = atan(d.y, d.x) + seed * 1.57;
  float flicker = moving ? step(.4, fract(sin(floor(t * 8.0 + seed * 17.0) * 91.7 + seed * 47.0) * 437.5)) : 1.0;
  float rays = pow(abs(cos(angle * 2.0)), 30.0) * smoothstep(.5, .04, r) * flicker;
  float spark = clamp(max(smoothstep(.15, .03, r), rays), 0.0, 1.0);
  vec3 sharp = mix(vec3(.019, .016, .028), vec3(1.0, .97, .9), spark);

  // Aching: deep purple with a slow pulse; static mottling identifies it without motion.
  float mottle = fbm(vObject * 10.0 + 3.0);
  float pulse = moving ? .5 + .5 * sin(t * 1.6) : .55;
  vec3 aching = mix(vec3(.05, .01, .13), vec3(.2, .05, .43), .45 * mottle + .55 * pulse);

  // Tingling: blue with static-like sparkles that re-seed many times per second.
  float frame = moving ? floor(t * 12.0) : 0.0;
  float speck = step(.9, hash13(floor(vObject * 230.0) + frame * vec3(1.7, 9.2, 3.1)));
  vec3 tingling = mix(vec3(.014, .115, .392), vec3(.75, .9, 1.0), speck);

  // Deterministic normalized blend of overlapping layers; each layer stays stored separately.
  float total = weight.x + weight.y + weight.z + weight.w;
  float alpha = clamp(max(max(weight.x, weight.y), max(weight.z, weight.w)), 0.0, 1.0);
  vec4 share = total > 0.0 ? weight / total : vec4(0.0);
  vec3 painColor = burning * share.x + sharp * share.y + aching * share.z + tingling * share.w;

  vec3 n = normalize(vNormal);
  vec3 irradiance = mix(uGround, uSky, .5 + .5 * n.y) + uKeyColor * max(dot(n, uKeyDir), 0.0) + uFillColor * max(dot(n, uFillDir), 0.0);
  // Pain colours get gentler shading than the body so they keep their designed hue on lit and shaded sides.
  float shade = .62 + .45 * max(dot(n, uKeyDir), 0.0) + .15 * max(dot(n, uFillDir), 0.0);
  vec3 highlight = vec3(1.0, .45, .1) * hot * share.x * .25
    + vec3(1.0, .97, .9) * spark * share.y * .8
    + vec3(.6, .82, 1.0) * speck * share.w * .6;
  vec3 color = mix(uBase * irradiance, painColor * shade + highlight, alpha * .95);
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createPaintTexture() {
  const texture = new THREE.DataTexture(new Uint8Array(TEXEL_COUNT * 4), MAP_SIZE, MAP_SIZE, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.colorSpace = THREE.NoColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/** Packs four layers into RGBA and copies island edges into the gutter so linear filtering does not darken seams. */
export function packPaintTexture(texture: THREE.DataTexture, layers: Readonly<PaintLayers>, atlas: BodyAtlas) {
  const data = texture.image.data as Uint8Array;
  const { burning, sharp, aching, tingling } = layers;
  for (let texel = 0, out = 0; texel < TEXEL_COUNT; texel++, out += 4) {
    data[out] = burning[texel]; data[out + 1] = sharp[texel]; data[out + 2] = aching[texel]; data[out + 3] = tingling[texel];
  }
  const fill = atlas.gutterFill;
  for (let i = 0; i < fill.length; i += 2) {
    const to = fill[i] * 4, from = fill[i + 1] * 4;
    data[to] = data[from]; data[to + 1] = data[from + 1]; data[to + 2] = data[from + 2]; data[to + 3] = data[from + 3];
  }
  texture.needsUpdate = true;
}

export function createPainMaterial(texture: THREE.Texture) {
  // Matches the task 1 hemisphere + key + fill rig (Lambert BRDF: intensity / pi).
  const lambert = (hex: number, intensity: number) => new THREE.Color(hex).multiplyScalar(intensity / Math.PI);
  return new THREE.ShaderMaterial({
    vertexShader, fragmentShader,
    uniforms: {
      uPaint: { value: texture },
      uTime: { value: STATIC_TIME },
      uMotion: { value: 1 },
      uBase: { value: new THREE.Color(0xc2cec5) },
      uSky: { value: lambert(0xffffff, 2.3) },
      uGround: { value: lambert(0x667a6b, 2.3) },
      uKeyColor: { value: lambert(0xffffff, 3.1) },
      uKeyDir: { value: new THREE.Vector3(-2, 3, 4).normalize() },
      uFillColor: { value: lambert(0xffffff, 1.8) },
      uFillDir: { value: new THREE.Vector3(2, 2, -3).normalize() },
    },
  });
}
