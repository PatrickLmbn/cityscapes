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
  const { width, height, depth, x, z, windowColor, windowBrightness, id, secondaryColor, mixedRatio, avatarType = 'building' } = data;

  const seed = useMemo(() => {
    let s = 0;
    for (let i = 0; i < id.length; i++) s += id.charCodeAt(i);
    return s || 42;
  }, [id]);

  // Random rotation for cars based on seed
  const carRotation = useMemo(() => {
    if (avatarType === 'car') {
      // Use a hash function for better random distribution
      const hash = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
      const randomAngle = (hash - Math.floor(hash)) * Math.PI * 2; // 0 to 2π
      return randomAngle;
    }
    return 0;
  }, [avatarType, seed]);

  const eI = 0.5 + windowBrightness * 0.45;
  const style = seed % 4; // 0=Standard, 1=Stepped, 2=Monolith, 3=Twins

  // Shared geometries to save memory and improve performance
  const sphereGeom = useMemo(() => new THREE.SphereGeometry(1, 6, 6), []); // Minimal segments
  const boxGeom = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const wheelGeom = useMemo(() => new THREE.CylinderGeometry(0.25, 0.25, 0.15, 6), []); // Minimal segments
  const circleGeom = useMemo(() => new THREE.CircleGeometry(1, 8), []); // Minimal segments
  const beamGeom = useMemo(() => new THREE.CylinderGeometry(0.02, 0.8, 16, 6, 1, true), []);
  const downwardBeamGeom = useMemo(() => new THREE.CylinderGeometry(0.1, 2.8, 7, 8, 1, true), []);

  // Flat ground-projected triangle beams for car headlights (like the reference image)
  const leftInnerBeam = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0,    // tip
      -3, -12, 0, // far left (now negative Y to point forward after X-rotation)
      0.5, -12, 0 // far right
    ], 3));
    geo.computeVertexNormals();
    return geo;
  }, []);
  const leftOuterBeam = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0,
      -5, -22, 0,
      2, -22, 0
    ], 3));
    geo.computeVertexNormals();
    return geo;
  }, []);
  const rightInnerBeam = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0,
      -0.5, -12, 0,
      3, -12, 0
    ], 3));
    geo.computeVertexNormals();
    return geo;
  }, []);
  const rightOuterBeam = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0,
      -2, -22, 0,
      5, -22, 0
    ], 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  const commonProps = {
    color: windowColor,
    secondaryColor,
    mixedRatio,
    emissiveIntensity: eI,
    onClick: (e) => { e.stopPropagation(); onSelect(data); },
    onPointerOver: () => (document.body.style.cursor = 'pointer'),
    onPointerOut: () => (document.body.style.cursor = 'auto'),
  };

  const renderBuilding = () => {
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

  const renderAvatar = () => {
    // Derive a stable hex string from windowColor for reliable R3F material props
    const glowHex = windowColor;

    // Invisible Hitbox for easier clicking on smaller objects
    const HitBox = ({ h = 2, w = 1, d = 1 }) => (
      <mesh 
        onClick={commonProps.onClick} 
        onPointerOver={commonProps.onPointerOver} 
        onPointerOut={commonProps.onPointerOut} 
        position={[0, h/2, 0]}
      >
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial transparent opacity={0} visible={false} />
      </mesh>
    );

    switch (avatarType) {
      case 'person':
        // Whole body = emotion color. Slightly varied intensity per part for readable human silhouette.
        return (
          <group position={[0, 0, 0]}>
            <HitBox h={2.2} w={1.2} d={1.2} />
            {/* Legs */}
            <mesh position={[-0.2, 0.4, 0]}>
              <boxGeometry args={[0.15, 0.8, 0.15]} />
              <meshBasicMaterial color={glowHex} toneMapped={false} />
            </mesh>
            <mesh position={[0.2, 0.4, 0]}>
              <boxGeometry args={[0.15, 0.8, 0.15]} />
              <meshBasicMaterial color={glowHex} toneMapped={false} />
            </mesh>
            {/* Torso — slightly brighter so body reads distinct from limbs */}
            <mesh position={[0, 1.2, 0]}>
              <boxGeometry args={[0.5, 0.8, 0.3]} />
              <meshBasicMaterial color={glowHex} toneMapped={false} />
            </mesh>
            {/* Arms */}
            <mesh position={[-0.38, 1.15, 0]}>
              <boxGeometry args={[0.13, 0.6, 0.13]} />
              <meshBasicMaterial color={glowHex} toneMapped={false} />
            </mesh>
            <mesh position={[0.38, 1.15, 0]}>
              <boxGeometry args={[0.13, 0.6, 0.13]} />
              <meshBasicMaterial color={glowHex} toneMapped={false} />
            </mesh>
            {/* Glowing Heart / Core — ultra bright focal point */}
            <mesh position={[0, 1.3, 0.16]}>
              <sphereGeometry args={[0.1, 6, 6]} />
              <meshBasicMaterial color={glowHex} toneMapped={false} />
              <pointLight color={glowHex} intensity={2} distance={3} decay={2} />
            </mesh>
            {/* Head */}
            <mesh position={[0, 1.82, 0]}>
              <sphereGeometry args={[0.22, 12, 12]} />
              <meshBasicMaterial color={glowHex} toneMapped={false} />
            </mesh>
          </group>
        );
      
      case 'car':
        return (
          <group position={[0, 0, 0]} rotation={[0, carRotation, 0]}>
            <HitBox h={1.4} w={1.8} d={3.2} />
            
            <group position={[0, 0.35, 0]}>
              {/* Main Chassis - Low and wide car body */}
              <mesh position={[0, 0.2, 0]}>
                <boxGeometry args={[1.6, 0.4, 2.8]} />
                <meshBasicMaterial color="#20222a" />
              </mesh>

              {/* Cabin / Roof - Rounded top like a classic sedan */}
              <mesh position={[0, 0.75, 0]}>
                <boxGeometry args={[1.2, 0.55, 1.6]} />
                <meshBasicMaterial color="#1a1c24" />
              </mesh>

              {/* Windshield - Front angled glass */}
              <mesh position={[0, 0.75, 0.75]} rotation={[0, 0, 0]}>
                <boxGeometry args={[1.18, 0.35, 0.1]} />
                <meshBasicMaterial color="#0a0a10" transparent opacity={0.5} />
              </mesh>

              {/* Rear Window - Back glass */}
              <mesh position={[0, 0.75, -0.75]} rotation={[0, 0, 0]}>
                <boxGeometry args={[1.18, 0.3, 0.1]} />
                <meshBasicMaterial color="#0a0a10" transparent opacity={0.5} />
              </mesh>

              {/* Side windows - Removed for performance */}

              {/* Front Bumper - Simplified */}
              <mesh position={[0, 0.25, 1.42]}>
                <boxGeometry args={[1.4, 0.3, 0.15]} />
                <meshBasicMaterial color="#15171e" />
              </mesh>

              {/* Rear Bumper */}
              <mesh position={[0, 0.25, -1.42]}>
                <boxGeometry args={[1.4, 0.3, 0.15]} />
                <meshBasicMaterial color="#15171e" />
              </mesh>

              {/* Wheels - 4 wheels simplified */}
              {[[-0.82, -0.05, 1.0], [0.82, -0.05, 1.0], [-0.82, -0.05, -1.0], [0.82, -0.05, -1.0]].map((pos, i) => (
                <mesh key={i} position={pos} rotation={[0, 0, Math.PI/2]}>
                  <cylinderGeometry args={[0.32, 0.32, 0.25, 6]} />
                  <meshBasicMaterial color="#050505" />
                </mesh>
              ))}

              {/* Headlights - Simplified with emissive glow */}
              {[[-0.55, 0.28, 1.45], [0.55, 0.28, 1.45]].map((pos, i) => (
                <mesh key={i} position={pos}>
                  <boxGeometry args={[0.35, 0.15, 0.15]} />
                  <meshBasicMaterial color={glowHex} toneMapped={false} />
                  <pointLight color={glowHex} intensity={2} distance={8} decay={2} />
                </mesh>
              ))}

              {/* GROUND LIGHT BEAMS — flat triangles on the ground */}
              <mesh position={[-0.55, -0.05, 1.45]} rotation={[-Math.PI / 2, 0, -0.15]}>
                <primitive object={leftInnerBeam} />
                <meshBasicMaterial color={glowHex} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
              </mesh>
              <mesh position={[-0.55, -0.04, 1.45]} rotation={[-Math.PI / 2, 0, -0.25]}>
                <primitive object={leftOuterBeam} />
                <meshBasicMaterial color={glowHex} transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
              </mesh>
              <mesh position={[0.55, -0.05, 1.45]} rotation={[-Math.PI / 2, 0, 0.15]}>
                <primitive object={rightInnerBeam} />
                <meshBasicMaterial color={glowHex} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
              </mesh>
              <mesh position={[0.55, -0.04, 1.45]} rotation={[-Math.PI / 2, 0, 0.25]}>
                <primitive object={rightOuterBeam} />
                <meshBasicMaterial color={glowHex} transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
              </mesh>

              {/* Taillights - Simplified with glow */}
              {[[-0.55, 0.28, -1.45], [0.55, 0.28, -1.45]].map((pos, i) => (
                <mesh key={i} position={pos}>
                  <boxGeometry args={[0.35, 0.15, 0.1]} />
                  <meshBasicMaterial color="#ff0000" toneMapped={false} />
                  <pointLight color="#ff0000" intensity={0.8} distance={4} decay={2} />
                </mesh>
              ))}
            </group>
          </group>
        );

      case 'stoplight':
        // Structure = dark steel (visible). Only the bulb = emotion color.
        return (
          <group position={[0, 0, 0]}>
            <HitBox h={5} w={1} d={1} />
            {/* Pole — dark steel, clearly visible on noir bg */}
            <mesh position={[0, 2.5, 0]}>
              <cylinderGeometry args={[0.1, 0.15, 5, 8]} />
              <meshBasicMaterial color="#1a1e28" />
            </mesh>
            {/* Head housing — dark box */}
            <mesh position={[0, 4.2, 0.3]}>
              <boxGeometry args={[0.6, 1.5, 0.5]} />
              <meshBasicMaterial color="#111318" />
            </mesh>
            {/* Bulb — EMOTION COLOR only, ultra bright + REAL LIGHT */}
            <mesh position={[0, 4.5, 0.56]}>
               <primitive object={sphereGeom} scale={0.15} />
               <meshBasicMaterial color={glowHex} toneMapped={false} />
               <pointLight color={glowHex} intensity={2} distance={6} decay={2} />
             </mesh>
           </group>
         );

      case 'lamp':
        // Structure = dark steel (visible). Only the bulb = emotion color.
        return (
          <group position={[0, 0, 0]}>
            <HitBox h={6} w={2} d={1} />
            {/* Pole — dark steel, visible */}
            <mesh position={[0, 3, 0]}>
              <cylinderGeometry args={[0.05, 0.1, 6, 8]} />
              <meshBasicMaterial color="#1a1e28" />
            </mesh>
            {/* Arm — dark steel */}
            <mesh position={[0.5, 5.8, 0]} rotation={[0, 0, Math.PI/2]}>
              <cylinderGeometry args={[0.03, 0.03, 1, 8]} />
              <meshBasicMaterial color="#1a1e28" />
            </mesh>
            {/* Bulb — EMOTION COLOR only, ultra bright + REAL LIGHT */}
            <mesh position={[1.0, 5.7, 0]}>
              <primitive object={sphereGeom} scale={0.2} />
              <meshBasicMaterial color={glowHex} toneMapped={false} />
              <pointLight color={glowHex} intensity={3} distance={10} decay={2} />
            </mesh>
            {/* Ground Splash Reflection */}
            <mesh position={[1.0, 0.02, 0]} rotation={[-Math.PI/2, 0, 0]} scale={2.5}>
               <primitive object={circleGeom} />
               <meshBasicMaterial color={glowHex} transparent opacity={0.15} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
          </group>
        );

      default:
        return renderBuilding();
    }
  };

  return (
    <group position={[x, 0, z]}>
      {renderAvatar()}

      {/* For Non-Buildings, comments appear as glowing floaters or simple expansions */}
      {avatarType !== 'building' && comments.length > 0 && (
         <group position={[0, avatarType === 'lamp' ? 6 : 2.5, 0]}>
            {comments.map((c, i) => (
              <mesh key={c.id} position={[0, 0.5 + i*0.4, 0]}>
                <sphereGeometry args={[0.05 + Math.random()*0.05, 8, 8]} />
                <meshStandardMaterial color={c.valence >= 8 ? '#fff' : (c.valence <= 3 ? '#ff2233' : windowColor)} emissive={c.valence >= 8 ? '#fff' : (c.valence <= 3 ? '#ff2233' : windowColor)} emissiveIntensity={2} />
              </mesh>
            ))}
         </group>
      )}

      {/* Building-specific floors and props */}
      {avatarType === 'building' && (
        <>
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
        </>
      )}
    </group>
  );
}
