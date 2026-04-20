import React, { useMemo } from 'react';
import * as THREE from 'three';

// ── GPU WINDOW & STRUCTURE SHADER ──────────────────────
const BuildingShader = {
  uniforms: {
    uWindowColor: { value: new THREE.Color('#ffffff') },
    uSecondaryColor: { value: new THREE.Color('#ffffff') },
    uMixedRatio: { value: 0.0 },
    uEmissiveIntensity: { value: 1.0 },
    uFloors: { value: 10.0 },
    uCols: { value: 6.0 },
    uSeed: { value: 1.0 },
    uDimensions: { value: new THREE.Vector2(4, 10) },
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
    uniform vec3 uSecondaryColor;
    uniform float uMixedRatio;
    uniform float uEmissiveIntensity;
    uniform float uFloors;
    uniform float uCols;
    uniform float uSeed;
    uniform vec2 uDimensions;
    varying vec2 vUv;

    float hash(float n) { return fract(sin(n) * 43758.5453123); }

    void main() {
      vec2 gridUv = vUv;
      float row = floor(gridUv.y * uFloors);
      float col = floor(gridUv.x * uCols);
      
      float windowId = hash(row * 127.3 + col * 43.1 + uSeed * 91.7);
      bool isLit = windowId > 0.35;

      vec2 cellUv = fract(gridUv * vec2(uCols, uFloors));
      
      // Structural details (beams and pillars)
      float beamThin = 0.08;
      float pillarThin = 0.08;
      bool isBeam = cellUv.y < beamThin || cellUv.y > (1.0 - beamThin);
      bool isPillar = cellUv.x < pillarThin || cellUv.x > (1.0 - pillarThin);

      // Window margins
      float marginX = 0.18;
      float marginY = 0.20;
      bool inWindow = (cellUv.x > marginX && cellUv.x < (1.0 - marginX)) &&
                      (cellUv.y > marginY && cellUv.y < (1.0 - marginY));

      vec3 facadeBase = vec3(0.04); // Concrete color
      if (isBeam || isPillar) facadeBase = vec3(0.05); // Brighter structural lines
      
      vec3 finalColor = facadeBase;
      vec3 emissive = vec3(0.0);

      if (inWindow) {
        if (isLit) {
          vec3 baseColor = uWindowColor;
          if (uMixedRatio > 0.05) {
            float colorId = hash(row * 33.1 + col * 97.4 + uSeed * 2.5);
            if (colorId < uMixedRatio) baseColor = uSecondaryColor;
          }
          finalColor = baseColor;
          emissive = baseColor * uEmissiveIntensity;
        } else {
          finalColor = vec3(0.02); // Deep dark glass
        }
      }

      gl_FragColor = vec4(finalColor + emissive, 1.0);
    }
  `
};

function BuildingPart({ width, height, depth, floors, color, secondaryColor, mixedRatio = 0, seed, emissiveIntensity, onClick, onPointerOver, onPointerOut, isTopClosed = false }) {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(BuildingShader.uniforms),
      vertexShader: BuildingShader.vertexShader,
      fragmentShader: BuildingShader.fragmentShader,
    });
  }, []);

  useMemo(() => {
    material.uniforms.uWindowColor.value.set(color);
    material.uniforms.uSecondaryColor.value.set(secondaryColor || color);
    material.uniforms.uMixedRatio.value = mixedRatio;
    material.uniforms.uEmissiveIntensity.value = emissiveIntensity;
    material.uniforms.uFloors.value = floors;
    material.uniforms.uCols.value = Math.max(3, Math.round(width / 0.8));
    material.uniforms.uSeed.value = seed;
    material.uniforms.uDimensions.value.set(width, height);
  }, [material, color, secondaryColor, mixedRatio, emissiveIntensity, floors, width, height, seed]);

  return (
    <group>
      <mesh castShadow receiveShadow onClick={onClick} onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
        <boxGeometry args={[width, height, depth]} />
        <primitive object={material} attach="material" />
      </mesh>
      {isTopClosed && (
        <mesh position={[0, height / 2 + 0.05, 0]}>
          <boxGeometry args={[width + 0.05, 0.1, depth + 0.05]} />
          <meshStandardMaterial color="#050505" roughness={0.9} />
        </mesh>
      )}
    </group>
  );
}

export default function Building({ data, comments = [], onSelect }) {
  const { width, height, depth, x, z, windowColor, windowBrightness, id, secondaryColor, mixedRatio } = data;

  const seed = useMemo(() => {
    let s = 0;
    for (let i = 0; i < id.length; i++) s += id.charCodeAt(i);
    return s || 42;
  }, [id]);

  const eI = 0.5 + windowBrightness * 0.45;
  const style = seed % 4; // 0=Standard, 1=Stepped, 2=Monolith, 3=Twins

  const commonProps = {
    color: windowColor,
    secondaryColor,
    mixedRatio,
    emissiveIntensity: eI,
    onClick: (e) => { e.stopPropagation(); onSelect(data); },
    onPointerOver: () => (document.body.style.cursor = 'pointer'),
    onPointerOut: () => (document.body.style.cursor = 'auto'),
  };

  const renderContent = () => {
    switch (style) {
      case 1: // STEPPED (Ziggurat style)
        const stepH = height / 3;
        return (
          <>
            <group position={[0, stepH/2, 0]}>
              <BuildingPart {...commonProps} width={width} height={stepH} depth={depth} floors={Math.floor(stepH/3)} seed={seed} />
            </group>
            <group position={[0, stepH + stepH/2, 0]}>
              <BuildingPart {...commonProps} width={width*0.8} height={stepH} depth={depth*0.8} floors={Math.floor(stepH/3)} seed={seed+1} />
            </group>
            <group position={[0, stepH*2 + stepH/2, 0]}>
              <BuildingPart {...commonProps} width={width*0.6} height={stepH} depth={depth*0.6} floors={Math.floor(stepH/3)} seed={seed+2} />
            </group>
          </>
        );

      case 2: // MONOLITH (Classic Slab)
        return (
          <group position={[0, height / 2, 0]}>
            <BuildingPart {...commonProps} width={width} height={height} depth={depth} floors={Math.floor(height/3.5)} seed={seed} />
          </group>
        );

      case 3: // TWINS (Shared lobby, two towers)
        const lobbyH = Math.min(4, height * 0.2);
        const tH = height - lobbyH;
        const tW = width * 0.4;
        return (
          <>
            <group position={[0, lobbyH / 2, 0]}>
              <BuildingPart {...commonProps} width={width} height={lobbyH} depth={depth} floors={1} seed={seed} emissiveIntensity={eI*1.5} />
            </group>
            <group position={[-width * 0.25, lobbyH + tH/2, 0]}>
              <BuildingPart {...commonProps} width={tW} height={tH} depth={depth*0.8} floors={Math.floor(tH/3.2)} seed={seed+1} />
            </group>
            <group position={[width * 0.25, lobbyH + tH/2, 0]}>
              <BuildingPart {...commonProps} width={tW} height={tH} depth={depth*0.8} floors={Math.floor(tH/3.2)} seed={seed+2} />
            </group>
          </>
        );

      default: // STANDARD (Lobby + Tower)
        const baseH = Math.min(6, height * 0.25);
        const mainH = height - baseH;
        return (
          <>
            <group position={[0, baseH / 2, 0]}>
              <BuildingPart {...commonProps} width={width} height={baseH} depth={depth} floors={Math.max(1, Math.floor(baseH/2.5))} seed={seed} emissiveIntensity={eI*1.5} />
            </group>
            <group position={[0, baseH + mainH/2, 0]}>
              <BuildingPart {...commonProps} width={width*0.85} height={mainH} depth={depth*0.85} floors={Math.floor(mainH/3.2)} seed={seed+1} />
            </group>
          </>
        );
    }
  };

  return (
    <group position={[x, 0, z]}>
      {renderContent()}

      {/* Growth Floors / Comments */}
      {comments.map((c, i) => {
        let gColor = windowColor;
        let gIntensity = eI;
        if (c.valence <= 3) { gColor = '#ff2233'; gIntensity = 1.4; }
        else if (c.valence >= 8) { gColor = '#ffffff'; gIntensity = 2.5; }
        const floorHeight = 2.4;
        const yPos = height + (i * floorHeight) + (floorHeight / 2);
        const currentWidth = style === 3 ? width * 0.4 : (style === 1 ? width * 0.6 : width * 0.85);

        return (
          <group key={c.id} position={[0, yPos, 0]}>
             <BuildingPart {...commonProps} color={gColor} emissiveIntensity={gIntensity} width={currentWidth * (0.95 - i*0.02)} height={floorHeight} depth={currentWidth * (0.95 - i*0.02)} floors={1} seed={seed + i + 10} />
          </group>
        );
      })}

      {/* Rooftop Props on the very top */}
      <group position={[0, height + (comments.length * 2.4), 0]}>
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[width * 0.5, 0.1, depth * 0.5]} />
          <meshStandardMaterial color="#050505" />
        </mesh>
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[width * 0.2, 1.2, depth * 0.2]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
        <mesh position={[0, 2, 0]}>
          <cylinderGeometry args={[0.01, 0.04, 3, 6]} />
          <meshStandardMaterial color={windowColor} emissive={windowColor} emissiveIntensity={2} />
        </mesh>
      </group>
    </group>
  );
}
