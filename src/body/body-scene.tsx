"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BODY_MAP_VERSION, type CameraView, type InteractionMode } from "@/domain/contracts";
import type { MannequinAsset } from "./mannequin";

interface Props { mode: InteractionMode; view: CameraView; viewRequest: number }
interface Controller { setMode(mode: InteractionMode): void; setView(view: CameraView): void }
const VIEW_POSITIONS: Record<CameraView, [number, number, number]> = {
  front: [0, 1, 3.25], back: [0, 1, -3.25], left: [3.25, 1, 0], right: [-3.25, 1, 0],
};

export default function BodyScene({ mode, view, viewRequest }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const controller = useRef<Controller | null>(null);
  const currentMode = useRef(mode);
  const currentView = useRef(view);
  currentMode.current = mode;
  currentView.current = view;
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const host = mount.current!;
    let renderer: THREE.WebGLRenderer | undefined;
    let controls: OrbitControls | undefined;
    let observer: ResizeObserver | undefined;
    let geometry: THREE.BufferGeometry | undefined;
    let material: THREE.MeshStandardMaterial | undefined;
    let cancelled = false;
    const abort = new AbortController();
    let onKey: ((event: KeyboardEvent) => void) | undefined;
    let onContextLost: ((event: Event) => void) | undefined;

    async function initialize() {
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        const canvas = renderer.domElement;
        canvas.tabIndex = 0;
        canvas.setAttribute("aria-label", "Rotatable 3D body, patient-left is positive X");
        canvas.setAttribute("aria-describedby", "scene-help");
        canvas.setAttribute("role", "img");
        host.appendChild(canvas);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, 1, .01, 30);
        controls = new OrbitControls(camera, canvas);
        controls.target.set(0, 1, 0);
        controls.enableDamping = false;
        controls.enablePan = false;
        controls.minDistance = 1.6;
        controls.maxDistance = 5;
        controls.minPolarAngle = .08;
        controls.maxPolarAngle = Math.PI - .08;
        controls.rotateSpeed = .75;
        scene.add(new THREE.HemisphereLight(0xffffff, 0x667a6b, 2.3));
        const key = new THREE.DirectionalLight(0xffffff, 3.1);
        key.position.set(-2, 3, 4);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xffffff, 1.8);
        fill.position.set(2, 2, -3);
        scene.add(fill);
        const draw = () => {
          if (cancelled) return;
          renderer!.render(scene, camera);
          // Public canvas state supports mode/camera verification without exposing renderer internals.
          canvas.dataset.camera = camera.position.toArray().map(value => value.toFixed(4)).join(",");
        };
        controls.addEventListener("change", draw);
        controller.current = {
          setMode(next) { controls!.enabled = next === "rotate"; canvas.dataset.mode = next; },
          setView(next) {
            camera.position.set(...VIEW_POSITIONS[next]);
            controls!.target.set(0, 1, 0);
            camera.lookAt(controls!.target);
            controls!.update(); draw();
            canvas.dataset.view = next;
          },
        };
        controller.current.setMode(currentMode.current);
        controller.current.setView(currentView.current);
        onKey = event => {
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
            case "Home": controller.current!.setView("front"); event.preventDefault(); return;
            default: return;
          }
          event.preventDefault();
          camera.position.copy(controls!.target).add(new THREE.Vector3().setFromSpherical(spherical));
          controls!.update(); draw();
        };
        canvas.addEventListener("keydown", onKey);
        onContextLost = event => { event.preventDefault(); controls!.enabled = false; setStatus("error"); };
        canvas.addEventListener("webglcontextlost", onContextLost);
        observer = new ResizeObserver(() => {
          if (cancelled) return;
          const { width, height } = host.getBoundingClientRect();
          if (!width || !height) return;
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer!.setSize(width, height); draw();
        });
        observer.observe(host);
        const response = await fetch("/body/mannequin-v1.json", { signal: abort.signal });
        if (!response.ok) throw new Error("Body asset unavailable.");
        const asset: MannequinAsset = await response.json();
        if (cancelled) return;
        if (asset.bodyMapVersion !== BODY_MAP_VERSION) throw new Error("Unsupported body asset version.");
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(asset.positions, 3));
        geometry.setAttribute("normal", new THREE.Float32BufferAttribute(asset.normals, 3));
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(asset.uvs, 2));
        geometry.setIndex(asset.indices);
        material = new THREE.MeshStandardMaterial({ color: 0xc2cec5, roughness: .76, metalness: 0 });
        scene.add(new THREE.Mesh(geometry, material));
        draw(); setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }
    initialize();
    return () => {
      cancelled = true; abort.abort(); observer?.disconnect(); controller.current = null;
      if (renderer) {
        if (onKey) renderer.domElement.removeEventListener("keydown", onKey);
        if (onContextLost) renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
        renderer.domElement.remove();
      }
      controls?.dispose(); geometry?.dispose(); material?.dispose(); renderer?.dispose(); renderer?.forceContextLoss();
    };
  }, []);

  useEffect(() => { controller.current?.setMode(mode); }, [mode]);
  useEffect(() => { controller.current?.setView(view); }, [view, viewRequest]);

  return <><div className="scene-mount" ref={mount} aria-hidden={status !== "ready"} data-status={status} />
    {status === "loading" && <div className="scene-message" role="status">Preparing your body map…</div>}
    {status === "error" && <div className="scene-message scene-error" role="alert"><h2>The body map couldn’t load</h2><p>This preview needs WebGL and the body asset. Enable graphics support or try a different browser, then reload.</p><button type="button" onClick={() => window.location.reload()}>Reload body map</button></div>}
  </>;
}
