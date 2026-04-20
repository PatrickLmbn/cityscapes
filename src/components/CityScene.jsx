import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import Building from './Building';

export default function CityScene({ buildings, comments = [], onSelect }) {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [30, 25, 50], fov: 42 }}
        gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      >
        <color attach="background" args={['#010108']} />
        
        {/* Light fog — just enough to fade distant buildings, not swallow them */}
        <fog attach="fog" args={['#010108', 80, 220]} />

        {/* Stars in the sky */}
        <Stars radius={120} depth={60} count={2000} factor={3} saturation={0} fade speed={0.4} />

        {/* Scene ambient — very dim, just enough to outline the building body */}
        <ambientLight intensity={0.12} color="#1a2a4a" />

        {/* Moonlight — cool directional casting long building shadows */}
        <directionalLight
          castShadow
          position={[60, 80, -40]}
          intensity={0.35}
          color="#4466aa"
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={1}
          shadow-camera-far={300}
          shadow-camera-left={-100}
          shadow-camera-right={100}
          shadow-camera-top={100}
          shadow-camera-bottom={-100}
        />

        {/* Ground — wet tarmac look */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[400, 400, 32, 32]} />
          <meshStandardMaterial
            color="#070710"
            roughness={0.4}
            metalness={0.6}
          />
        </mesh>

        {/* Grid lines on the ground for city block feeling */}
        <gridHelper
          args={[200, 40, '#1a1a2e', '#0d0d1a']}
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

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          maxPolarAngle={Math.PI / 2 - 0.04}
          minDistance={8}
          maxDistance={200}
          target={[0, 5, 0]}
        />
      </Canvas>
    </div>
  );
}
