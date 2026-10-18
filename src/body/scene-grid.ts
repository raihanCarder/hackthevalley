import * as THREE from "three";

/** Decorative floor only: never add this mesh to the body's painting raycasts. */
export function createSceneGrid(color: string) {
  const geometry = new THREE.PlaneGeometry(12, 12);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: { uColor: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      varying vec3 vWorld;

      float lines(vec2 point) {
        vec2 pixel = max(fwidth(point), vec2(0.00001));
        vec2 distanceToLine = abs(fract(point - 0.5) - 0.5) / pixel;
        vec2 stroke = 1.0 - smoothstep(vec2(0.35), vec2(1.15), distanceToLine);
        // Remove each family of lines before its cells become subpixel at the horizon.
        stroke *= 1.0 - smoothstep(vec2(0.12), vec2(0.45), pixel);
        return max(stroke.x, stroke.y);
      }

      void main() {
        float minor = lines(vWorld.xz / 0.2);
        float major = lines(vWorld.xz);
        float fade = 1.0 - smoothstep(1.5, 5.5, length(vWorld.xz));
        vec3 toCamera = normalize(cameraPosition - vWorld);
        float angle = smoothstep(0.015, 0.16, toCamera.y);
        float alpha = max(minor * 0.14, major * 0.22) * fade * angle;
        gl_FragColor = vec4(uColor, alpha);
        #include <colorspace_fragment>
      }
    `,
  });
  const grid = new THREE.Mesh(geometry, material);
  grid.position.y = -0.025;
  return grid;
}
