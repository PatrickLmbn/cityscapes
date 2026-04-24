import React from 'react';
import { Canvas } from '@react-three/fiber';
import { MapControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import Building from './Building';

export default function CityScene({ buildings, comments = [], onSelect }) {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas
        shadows="basic" // Use basic shadows instead of PCF
        dpr={[1, 1]} // Lock to 1x pixel ratio for max performance
        camera={{ position: [30, 25, 50], fov: 42 }}
        gl={{ 
          antialias: false, // Disable antialiasing for performance
          alpha: false, 
          toneMapping: THREE.ACESFilmicToneMapping, 
          toneMappingExposure: 1.2,
          powerPreference: "high-performance",
          stencil: false, // Disable stencil buffer
          depth: true
        }}
        frameloop="demand" // Only render when needed
        performance={{ min: 0.1 }} // Allow aggressive frame rate drops
      >
        <color attach="background" args={['#010108']} />
        
        {/* Light fog for atmosphere */}
        <fog attach="fog" args={['#010108', 150, 600]} />

        {/* Reduced stars for performance */}
        <Stars radius={100} depth={50} count={800} factor={2.5} saturation={0} fade speed={0.3} />

        {/* Scene ambient — very dim, just enough to outline the building body */}
        <ambientLight intensity={0.12} color="#1a2a4a" />

        {/* Moonlight — cool directional casting long building shadows */}
        <directionalLight
          castShadow
          position={[60, 80, -40]}
          intensity={0.35}
          color="#4466aa"
          shadow-mapSize={[512, 512]}
          shadow-camera-near={1}
          shadow-camera-far={200}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={50}
          shadow-camera-bottom={-50}
        />

        {/* Ground — wet tarmac look */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[2000, 2000, 1, 1]} />
          <meshBasicMaterial color="#070710" />
        </mesh>

        {/* Simplified grid */}
        <gridHelper
          args={[2000, 20, '#1a1a2e', '#0d0d1a']}
          position={[0, 0.01, 0]}
        />

        {/* Central spotlight — dark buildings cluster here */}
        <pointLight
          position={[0, 2, 0]}
          color="#220033"
          intensity={3}
          distance={20}
          decay={2}
        />

        {/* Render all buildings */}
        {buildings.map(b => (
          <Building 
            key={b.id} 
            data={b} 
            comments={comments.filter(c => c.building_id === b.id)} 
            onSelect={onSelect} 
          />
        ))}

        <MapControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          maxPolarAngle={Math.PI / 2 - 0.04}
          minDistance={8}
          maxDistance={500}
          enableDamping={false}
          makeDefault
        />

        {/* Lightweight bloom - optimized for performance */}
        <EffectComposer disableNormalPass multisampling={0}>
          <Bloom 
            luminanceThreshold={0.9}
            intensity={0.5}
            levels={3}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
