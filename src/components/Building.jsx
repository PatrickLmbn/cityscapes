import React, { useMemo } from 'react';
import * as THREE from 'three';

// ── GPU WINDOW SHADER ──────────────────────────────────
// This calculates the window grid mathematically on the GPU.
// No textures = No memory usage = Infinite performance.
const BuildingShader = {
  uniforms: {
    uWindowColor: { value: new THREE.Color('#ffffff') },
    uEmissiveIntensity: { value: 1.0 },
    uFloors: { value: 10.0 },
    uCols: { value: 6.0 },
    uSeed: { value: 1.0 },
    uDimensions: { value: new THREE.Vector2(4, 10) }, // width, height
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    void main() {
      vUv = uv;
      vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uWindowColor;
    uniform float uEmissiveIntensity;
    uniform float uFloors;
    uniform float uCols;
    uniform float uSeed;
    uniform vec2 uDimensions;
    varying vec2 vUv;

    // Pseudo-random function
    float hash(float n) { return fract(sin(n) * 43758.5453123); }

    void main() {
      // Scale UVs based on dimensions to keep windows square-ish
      vec2 gridUv = vUv;
      
      // Calculate row and col index
      float row = floor(gridUv.y * uFloors);
      float col = floor(gridUv.x * uCols);
      
      // Random value for this specific window
      float windowId = hash(row * 127.3 + col * 43.1 + uSeed * 91.7);
      bool isLit = windowId > 0.3; // 70% lit

      // Calculate localized UV within the window cell
      vec2 cellUv = fract(gridUv * vec2(uCols, uFloors));
      
      // Window margins (creates the concrete gaps)
      float marginX = 0.22;
      float marginY = 0.25;
      
      bool inWindow = (cellUv.x > marginX && cellUv.x < (1.0 - marginX)) &&
                      (cellUv.y > marginY && cellUv.y < (1.0 - marginY));

      vec3 finalColor = vec3(0.06); // Dark concrete facade
      vec3 emissive = vec3(0.0);

      if (inWindow) {
        if (isLit) {
          finalColor = uWindowColor;
          emissive = uWindowColor * uEmissiveIntensity;
        } else {
          finalColor = vec3(0.035); // Dark unlit glass
        }
      }

      // Add a thin floor line every level
      if (cellUv.y < 0.05) {
        finalColor = vec3(0.04);
      }

      gl_FragColor = vec4(finalColor + emissive, 1.0);
    }
  `
};

function BuildingPart({ width, height, depth, floors, color, seed, emissiveIntensity, onClick, onPointerOver, onPointerOut }) {
  // We use the same shader material but unique uniforms per building part
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(BuildingShader.uniforms),
      vertexShader: BuildingShader.vertexShader,
      fragmentShader: BuildingShader.fragmentShader,
    });
  }, []);

  // Update uniforms
  useMemo(() => {
    material.uniforms.uWindowColor.value.set(color);
    material.uniforms.uEmissiveIntensity.value = emissiveIntensity;
    material.uniforms.uFloors.value = floors;
    material.uniforms.uCols.value = Math.max(3, Math.round(width / 0.8));
    material.uniforms.uSeed.value = seed;
    material.uniforms.uDimensions.value.set(width, height);
  }, [material, color, emissiveIntensity, floors, width, height, seed]);

  // Top material (simple dark concrete)
  const topMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#080808' }), []);

  return (
    <mesh 
      castShadow 
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <boxGeometry args={[width, height, depth]} />
      {/* Array of materials for the box [px, nx, py, ny, pz, nz] */}
      <primitive object={material} attach="material" />
    </mesh>
  );
}

export default function Building({ data, comments = [], onSelect }) {
  const { width, height, depth, x, z, windowColor, windowBrightness, floors, intensity, id } = data;

  const seed = useMemo(() => {
    let s = 0;
    for (let i = 0; i < id.length; i++) s += id.charCodeAt(i);
    return s || 42;
  }, [id]);

  const eI = 0.6 + windowBrightness * 0.5;
  const antennaH = 1 + intensity * 0.2;

  return (
    <group position={[x, 0, z]}>
      {/* 1. Base Building */}
      <group position={[0, height / 2, 0]}>
        <BuildingPart 
          width={width} height={height} depth={depth} 
          floors={floors} color={windowColor} seed={seed} 
          emissiveIntensity={eI} 
          onClick={(e) => { e.stopPropagation(); onSelect(data); }}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = 'auto')}
        />
      </group>

      {/* 2. Growth Floors */}
      {comments.map((c, i) => {
        // Red for Hostile, White for Supportive, Theme for Neutral
        let gColor = windowColor;
        let gIntensity = eI;
        
        if (c.valence <= 3) {
          gColor = '#ff2233'; // Hostile Red
          gIntensity = 1.4;
        } else if (c.valence >= 8) {
          gColor = '#ffffff'; // Supportive White
          gIntensity = 2.5;
        }

        const floorHeight = 2.4;
        const yPos = height + (i * floorHeight) + (floorHeight / 2);
        
        return (
          <group key={c.id} position={[0, yPos, 0]}>
            <BuildingPart 
              width={width * 0.98} height={floorHeight} depth={depth * 0.98} 
              floors={1} color={gColor} seed={seed + i + 1} 
              emissiveIntensity={gIntensity} 
            />
            {c.valence >= 8 && (
              <pointLight color="#ffffff" intensity={0.6} distance={6} decay={2} />
            )}
            {c.valence <= 3 && (
              <pointLight color="#ff2233" intensity={0.5} distance={5} decay={2} />
            )}
          </group>
        );
      })}

      {/* 3. Rooftop */}
      <group position={[0, height + (comments.length * 2.4), 0]}>
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[width + 0.2, 0.2, depth + 0.2]} />
          <meshStandardMaterial color="#050505" />
        </mesh>
        <mesh position={[width * 0.2, antennaH / 2, depth * 0.2]}>
          <cylinderGeometry args={[0.035, 0.035, antennaH, 6]} />
          <meshStandardMaterial color={windowColor} emissive={windowColor} emissiveIntensity={1} />
        </mesh>
      </group>
    </group>
  );
}
