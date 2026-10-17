"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BODY_MAP_VERSION, type CameraView, type InteractionMode } from "@/domain/contracts";
import { buildBodyAtlas, type BodyAtlas } from "./atlas";
import type { BodyCaptures, CaptureOptions, CaptureView, DeferredBodyHandle, SceneController } from "./body-handle";
import { BRUSH_RADII, type BrushSettings } from "./brush";
import { intensityToByte, type PaintLayers } from "./layers";
import type { MannequinAsset } from "./mannequin";
import { createPainMaterial, createPaintTexture, packPaintTexture, STATIC_TIME } from "./pain-material";
import { PaintEngine, type SurfaceHit } from "./paint-engine";
import { reduceRegions } from "./regions";

export type SceneStatus = "loading" | "ready" | "error";
interface Props {
  handle: DeferredBodyHandle;
  editable: boolean;
  mode: InteractionMode;
  view: CameraView;
  viewRequest: number;
  brush: BrushSettings;
  label: string;
  describedBy?: string;
  onStatus?: (status: SceneStatus) => void;
}
const VIEW_POSITIONS: Record<CameraView, [number, number, number]> = {
  front: [0, 1, 2.9], back: [0, 1, -2.9], left: [2.9, 1, 0], right: [-2.9, 1, 0],
};
const FOV = 40;
const RING_COLORS = { brush: 0x203b32, eraser: 0x8d302c };

/** Diagnostic hook for renderer lifecycle and handle checks in browser tests (task 2.8). Holds no patient data of its own. */
interface SceneStats { created: number; live: number; disposed: number; handles: Set<DeferredBodyHandle> }
const stats: SceneStats = ((globalThis as { __painJournalBodyScenes?: SceneStats }).__painJournalBodyScenes ??= { created: 0, live: 0, disposed: 0, handles: new Set() });

export default function BodyScene({ handle, editable, mode, view, viewRequest, brush, label, describedBy, onStatus }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const controller = useRef<(SceneController & { setMode(mode: InteractionMode): void }) | null>(null);
  const currentMode = useRef(mode);
  const currentView = useRef(view);
  const currentBrush = useRef(brush);
  const statusListener = useRef(onStatus);
  currentMode.current = editable ? mode : "rotate";
  currentView.current = view;
  currentBrush.current = brush;
  statusListener.current = onStatus;
  const [status, setStatusState] = useState<SceneStatus>("loading");

  useEffect(() => {
    const host = mount.current!;
    let renderer: THREE.WebGLRenderer | undefined;
    let controls: OrbitControls | undefined;
    let observer: ResizeObserver | undefined;
    let geometry: THREE.BufferGeometry | undefined;
    let material: THREE.ShaderMaterial | undefined;
    let texture: THREE.DataTexture | undefined;
    const disposables: { dispose(): void }[] = [];
    const listeners: [EventTarget, string, EventListener][] = [];
    let cancelled = false;
    let raf = 0;
    let attached: SceneController | null = null;
    const abort = new AbortController();
    const setStatus = (next: SceneStatus) => { if (!cancelled) { setStatusState(next); statusListener.current?.(next); } };
    const listen = <E extends Event>(target: EventTarget, type: string, handler: (event: E) => void, options?: AddEventListenerOptions) => {
      target.addEventListener(type, handler as EventListener, options);
      listeners.push([target, type, handler as EventListener]);
    };
    stats.created++; stats.live++;

    async function initialize() {
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        const canvas = renderer.domElement;
        canvas.tabIndex = 0;
        canvas.setAttribute("aria-label", label);
        if (describedBy) canvas.setAttribute("aria-describedby", describedBy);
        canvas.setAttribute("role", "img");
        host.appendChild(canvas);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(FOV, 1, .01, 30);
        controls = new OrbitControls(camera, canvas);
        controls.target.set(0, 1, 0);
        controls.enableDamping = false;
        controls.enablePan = false;
        controls.minDistance = 1.6;
        controls.maxDistance = 5;
        controls.minPolarAngle = .08;
        controls.maxPolarAngle = Math.PI - .08;
        controls.rotateSpeed = .75;

        let needsRender = true;
        const requestRender = () => { needsRender = true; };
        const publishCamera = () => { canvas.dataset.camera = camera.position.toArray().map(value => value.toFixed(4)).join(","); };
        controls.addEventListener("change", () => { publishCamera(); requestRender(); });

        const setMode = (next: InteractionMode) => {
          const effective = editable ? next : "rotate";
          if (effective !== "paint") cancelStroke();
          controls!.enabled = effective === "rotate";
          canvas.dataset.mode = effective;
          ring.visible = false; requestRender();
        };
        const setView = (next: CameraView) => {
          camera.position.set(...VIEW_POSITIONS[next]);
          controls!.target.set(0, 1, 0);
          camera.lookAt(controls!.target);
          controls!.update();
          canvas.dataset.view = next;
          publishCamera(); requestRender();
        };

        listen<KeyboardEvent>(canvas, "keydown", event => {
          if (event.key === "Escape" && engine?.stroking) { cancelStroke(); event.preventDefault(); return; }
          if (currentMode.current !== "rotate") return;
          const offset = camera.position.clone().sub(controls!.target);
          const spherical = new THREE.Spherical().setFromVector3(offset);
          switch (event.key) {
            case "ArrowLeft": spherical.theta -= .15; break;
            case "ArrowRight": spherical.theta += .15; break;
            case "ArrowUp": spherical.phi = Math.max(.08, spherical.phi - .15); break;
            case "ArrowDown": spherical.phi = Math.min(Math.PI - .08, spherical.phi + .15); break;
            case "+": case "=": spherical.radius = Math.max(1.6, spherical.radius * .9); break;
            case "-": spherical.radius = Math.min(5, spherical.radius * 1.1); break;
            case "Home": setView("front"); event.preventDefault(); return;
            default: return;
          }
          event.preventDefault();
          camera.position.copy(controls!.target).add(new THREE.Vector3().setFromSpherical(spherical));
          controls!.update(); publishCamera(); requestRender();
        });
        listen(canvas, "webglcontextlost", event => {
          event.preventDefault(); controls!.enabled = false; cancelAnimationFrame(raf);
          if (attached) { handle.detach(attached); attached = null; }
          setStatus("error");
        });

        // Brush preview ring, oriented to the surface under the pointer.
        const ringGeometry = new THREE.RingGeometry(.86, 1, 48);
        const ringMaterial = new THREE.MeshBasicMaterial({ color: RING_COLORS.brush, transparent: true, opacity: .85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.visible = false; ring.renderOrder = 2;
        scene.add(ring);
        disposables.push(ringGeometry, ringMaterial);

        let engine: PaintEngine | undefined;
        let atlas: BodyAtlas | undefined;
        let hasPaint = false;
        function cancelStroke() {
          if (!engine?.stroking) return;
          engine.cancelStroke(); stroke.pointer = -1; requestRender();
        }
        const stroke = { pointer: -1, x: 0, y: 0 };

        controller.current = { setMode, setView, snapshot: () => engine!.snapshot(), load: () => undefined, undo: () => false, capture: async () => ({}) };
        setMode(currentMode.current);
        setView(currentView.current);

        observer = new ResizeObserver(() => {
          if (cancelled) return;
          const { width, height } = host.getBoundingClientRect();
          if (!width || !height) return;
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer!.setSize(width, height); requestRender();
        });
        observer.observe(host);

        const response = await fetch("/body/mannequin-v1.json", { signal: abort.signal });
        if (!response.ok) throw new Error("Body asset unavailable.");
        const asset: MannequinAsset = await response.json();
        if (cancelled) return;
        if (asset.bodyMapVersion !== BODY_MAP_VERSION) throw new Error("Unsupported body asset version.");
        atlas = buildBodyAtlas(asset);
        engine = new PaintEngine(atlas);
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(asset.positions, 3));
        geometry.setAttribute("normal", new THREE.Float32BufferAttribute(asset.normals, 3));
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(asset.uvs, 2));
        geometry.setIndex(asset.indices);
        texture = createPaintTexture();
        material = createPainMaterial(texture);
        const body = new THREE.Mesh(geometry, material);
        scene.add(body);

        // One raycast mesh per UV island: bounding-sphere culling keeps hit tests cheap, and the island is known per hit.
        const rayMaterial = new THREE.MeshBasicMaterial({ side: THREE.FrontSide });
        disposables.push(rayMaterial);
        const rayMeshes = asset.islands.map(island => {
          const islandGeometry = new THREE.BufferGeometry();
          const start = island.vertexStart, end = start + island.vertexCount;
          islandGeometry.setAttribute("position", new THREE.Float32BufferAttribute(asset.positions.slice(start * 3, end * 3), 3));
          islandGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(asset.uvs.slice(start * 2, end * 2), 2));
          const indices: number[] = [];
          for (let i = 0; i < asset.indices.length; i += 3) if (asset.indices[i] >= start && asset.indices[i] < end) indices.push(asset.indices[i] - start, asset.indices[i + 1] - start, asset.indices[i + 2] - start);
          islandGeometry.setIndex(indices);
          islandGeometry.computeBoundingSphere();
          disposables.push(islandGeometry);
          const mesh = new THREE.Mesh(islandGeometry, rayMaterial);
          mesh.userData.island = island.id;
          return mesh;
        });
        const raycaster = new THREE.Raycaster();
        const ndc = new THREE.Vector2();
        const hitAt = (clientX: number, clientY: number): SurfaceHit | null => {
          const rect = canvas.getBoundingClientRect();
          ndc.set((clientX - rect.left) / rect.width * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
          raycaster.setFromCamera(ndc, camera);
          const hit = raycaster.intersectObjects(rayMeshes, false)[0];
          if (!hit?.face) return null;
          return { point: [hit.point.x, hit.point.y, hit.point.z], normal: [hit.face.normal.x, hit.face.normal.y, hit.face.normal.z], island: hit.object.userData.island as number };
        };
        const showRing = (hit: SurfaceHit | null) => {
          const visible = !!hit && currentMode.current === "paint";
          if (visible) {
            const radius = BRUSH_RADII[currentBrush.current.size];
            ring.position.set(hit.point[0] + hit.normal[0] * .002, hit.point[1] + hit.normal[1] * .002, hit.point[2] + hit.normal[2] * .002);
            ring.lookAt(hit.point[0] + hit.normal[0], hit.point[1] + hit.normal[1], hit.point[2] + hit.normal[2]);
            ring.scale.setScalar(radius);
            ringMaterial.color.setHex(RING_COLORS[currentBrush.current.tool]);
          }
          if (visible || ring.visible) requestRender();
          ring.visible = visible;
        };
        const pressureIntensity = (event: PointerEvent) => {
          const base = intensityToByte(currentBrush.current.intensity);
          return event.pointerType === "pen" && event.pressure > 0 ? Math.max(1, base * Math.min(1, event.pressure)) : base;
        };
        /** Screen-space subdivision between pointer samples keeps each stamp on the real surface. */
        const paintTo = (event: PointerEvent) => {
          const radius = BRUSH_RADII[currentBrush.current.size];
          const distance = camera.position.distanceTo(controls!.target);
          const radiusPixels = radius / (distance * Math.tan(THREE.MathUtils.degToRad(FOV / 2))) * (canvas.clientHeight / 2);
          const step = Math.max(3, radiusPixels * .5);
          const dx = event.clientX - stroke.x, dy = event.clientY - stroke.y;
          const steps = Math.min(24, Math.max(1, Math.ceil(Math.hypot(dx, dy) / step)));
          const intensity = pressureIntensity(event);
          let last: SurfaceHit | null = null;
          for (let i = 1; i <= steps; i++) {
            last = hitAt(stroke.x + dx * i / steps, stroke.y + dy * i / steps);
            engine!.strokeTo(last, intensity);
          }
          stroke.x = event.clientX; stroke.y = event.clientY;
          showRing(last);
        };

        const emit = (reason: "stroke" | "undo" | "load") => {
          const observations = reduceRegions(engine!.peek(), atlas);
          handle.emit({ revision: engine!.revision, isEmpty: engine!.isEmpty(), canUndo: engine!.canUndo, undoDepth: engine!.undoDepth, observations, reason });
          canvas.dataset.revision = String(engine!.revision);
          // Compact public summary (region:type:coverage) for verification, like data-camera.
          canvas.dataset.observations = observations.map(o => `${o.regionId}:${o.painType}:${o.mapCoverage}`).join(" ");
          hasPaint = !engine!.isEmpty();
        };
        const finishStroke = () => {
          if (!engine?.stroking) return;
          stroke.pointer = -1;
          if (engine.endStroke()) emit("stroke");
        };
        listen<PointerEvent>(canvas, "pointerdown", event => {
          if (!editable || currentMode.current !== "paint") return;
          if (stroke.pointer !== -1) { cancelStroke(); return; } // A second finger means a gesture, not a stroke.
          if (event.pointerType === "mouse" && event.button !== 0) return;
          event.preventDefault();
          canvas.setPointerCapture(event.pointerId);
          stroke.pointer = event.pointerId; stroke.x = event.clientX; stroke.y = event.clientY;
          const { tool, painType, size } = currentBrush.current;
          engine!.beginStroke({ layer: painType, tool, intensity: pressureIntensity(event), radius: BRUSH_RADII[size] });
          const hit = hitAt(event.clientX, event.clientY);
          engine!.strokeTo(hit, pressureIntensity(event));
          showRing(hit);
        });
        listen<PointerEvent>(canvas, "pointermove", event => {
          if (!editable || currentMode.current !== "paint") return;
          if (stroke.pointer !== event.pointerId) { showRing(hitAt(event.clientX, event.clientY)); return; }
          const samples = event.getCoalescedEvents?.() ?? [];
          for (const sample of samples.length ? samples : [event]) paintTo(sample);
        });
        listen<PointerEvent>(canvas, "pointerup", event => { if (stroke.pointer === event.pointerId) finishStroke(); });
        listen<PointerEvent>(canvas, "pointercancel", event => { if (stroke.pointer === event.pointerId) cancelStroke(); });
        listen<PointerEvent>(canvas, "lostpointercapture", event => { if (stroke.pointer === event.pointerId) finishStroke(); });
        listen(canvas, "pointerleave", () => { if (stroke.pointer === -1) showRing(null); });

        // Reduced motion freezes shader time; colours and static patterns remain.
        const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
        const applyMotion = () => {
          material!.uniforms.uMotion.value = motionQuery.matches ? 0 : 1;
          if (motionQuery.matches) material!.uniforms.uTime.value = STATIC_TIME;
          canvas.dataset.motion = motionQuery.matches ? "reduced" : "full";
          requestRender();
        };
        listen(motionQuery, "change", applyMotion);
        applyMotion();

        let uploaded = -1;
        const start = performance.now();
        let frames = 0, windowStart = start;
        const loop = (now: number) => {
          raf = requestAnimationFrame(loop);
          if (engine!.dirty !== uploaded) {
            packPaintTexture(texture!, engine!.peek(), atlas!);
            uploaded = engine!.dirty;
            needsRender = true;
          }
          const animate = material!.uniforms.uMotion.value === 1 && (hasPaint || engine!.stroking);
          if (animate) { material!.uniforms.uTime.value = (now - start) / 1000; needsRender = true; }
          if (!needsRender) { frames = 0; windowStart = now; return; }
          needsRender = false;
          renderer!.render(scene, camera);
          frames++;
          if (now - windowStart >= 1000) {
            // Rendered frames per second while continuously rendering (animation or painting).
            if (frames >= 10) canvas.dataset.fps = (frames * 1000 / (now - windowStart)).toFixed(1);
            frames = 0; windowStart = now;
          }
        };

        const capture = async ({ layers, views = ["front", "back"], width = 360, height = 600 }: CaptureOptions): Promise<BodyCaptures> => {
          const scale = 2;
          const captureTexture = layers ? createPaintTexture() : texture!;
          if (layers) packPaintTexture(captureTexture, layers, atlas!);
          else if (engine!.dirty !== uploaded) { packPaintTexture(texture!, engine!.peek(), atlas!); uploaded = engine!.dirty; }
          const uniforms = material!.uniforms;
          const previous = { texture: uniforms.uPaint.value, motion: uniforms.uMotion.value, time: uniforms.uTime.value, ring: ring.visible, clear: renderer!.getClearColor(new THREE.Color()), alpha: renderer!.getClearAlpha() };
          uniforms.uPaint.value = captureTexture; uniforms.uMotion.value = 0; uniforms.uTime.value = STATIC_TIME; ring.visible = false;
          const target = new THREE.WebGLRenderTarget(width * scale, height * scale, { colorSpace: THREE.SRGBColorSpace });
          const captureCamera = new THREE.PerspectiveCamera(30, width / height, .01, 30);
          const pixels = new Uint8Array(width * scale * height * scale * 4);
          const output: BodyCaptures = {};
          try {
            for (const side of views as CaptureView[]) {
              captureCamera.position.set(0, .98, side === "front" ? 4.1 : -4.1);
              captureCamera.lookAt(0, .98, 0);
              renderer!.setRenderTarget(target);
              renderer!.setClearColor(0xffffff, 0);
              renderer!.clear();
              renderer!.render(scene, captureCamera);
              renderer!.readRenderTargetPixels(target, 0, 0, width * scale, height * scale, pixels);
              output[side] = pixelsToDataUrl(pixels, width * scale, height * scale, width, height);
            }
          } finally {
            renderer!.setRenderTarget(null);
            renderer!.setClearColor(previous.clear, previous.alpha);
            uniforms.uPaint.value = previous.texture; uniforms.uMotion.value = previous.motion; uniforms.uTime.value = previous.time; ring.visible = previous.ring;
            target.dispose();
            if (layers) captureTexture.dispose();
            requestRender();
          }
          return output;
        };

        const ready: SceneController & { setMode(mode: InteractionMode): void } = {
          setMode, setView,
          snapshot: () => engine!.snapshot(),
          load(layers: PaintLayers | null) { stroke.pointer = -1; engine!.load(layers); emit("load"); },
          undo() { if (!editable || !engine!.undo()) return false; emit("undo"); return true; },
          capture,
        };
        controller.current = ready;
        raf = requestAnimationFrame(loop);
        attached = ready;
        handle.attach(ready);
        stats.handles.add(handle);
        if (engine.revision === 0) emit("load");
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }
    initialize();
    return () => {
      cancelled = true; abort.abort(); observer?.disconnect(); cancelAnimationFrame(raf);
      if (attached) handle.detach(attached);
      stats.handles.delete(handle);
      controller.current = null;
      for (const [target, type, handler] of listeners) target.removeEventListener(type, handler);
      renderer?.domElement.remove();
      for (const item of disposables) item.dispose();
      controls?.dispose(); geometry?.dispose(); material?.dispose(); texture?.dispose(); renderer?.dispose(); renderer?.forceContextLoss();
      stats.live--; stats.disposed++;
    };
    // The renderer is created once per mount; props flow through refs and the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { controller.current?.setMode(editable ? mode : "rotate"); }, [mode, editable]);
  useEffect(() => { controller.current?.setView(view); }, [view, viewRequest]);

  return <><div className="scene-mount" ref={mount} aria-hidden={status !== "ready"} data-status={status} />
    {status === "loading" && <div className="scene-message" role="status">Preparing your body map…</div>}
    {status === "error" && <div className="scene-message scene-error" role="alert"><h2>The body map couldn’t load</h2><p>This preview needs WebGL and the body asset. Enable graphics support or try a different browser, then reload.</p><button type="button" onClick={() => window.location.reload()}>Reload body map</button></div>}
  </>;
}

/** Flips WebGL's bottom-up rows and downsamples the 2x render for a smooth PNG. */
function pixelsToDataUrl(pixels: Uint8Array, width: number, height: number, outWidth: number, outHeight: number) {
  const full = document.createElement("canvas");
  full.width = width; full.height = height;
  const image = new ImageData(width, height);
  const rowBytes = width * 4;
  for (let row = 0; row < height; row++) image.data.set(pixels.subarray((height - 1 - row) * rowBytes, (height - row) * rowBytes), row * rowBytes);
  full.getContext("2d")!.putImageData(image, 0, 0);
  const out = document.createElement("canvas");
  out.width = outWidth; out.height = outHeight;
  const context = out.getContext("2d")!;
  context.imageSmoothingQuality = "high";
  context.drawImage(full, 0, 0, outWidth, outHeight);
  return out.toDataURL("image/png");
}
