import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Environment, PerspectiveCamera, PresentationControls, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { createBasketballTextures, createSoccerTextures, createTennisTextures } from './textures'

function TrophyShape() {
  const trophyMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#fbbf24', // Amber 400 (Gold)
    metalness: 1.0,
    roughness: 0.1,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    envMapIntensity: 2.5, // High reflections
  }), [])

  const points = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    
    // Smooth spline for the trophy profile
    const profilePoints = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(1.2, 0),
      new THREE.Vector2(1.2, 0.2),
      new THREE.Vector2(0.9, 0.3),
      new THREE.Vector2(0.3, 0.6),
      new THREE.Vector2(0.3, 2.0),
      new THREE.Vector2(0.6, 2.1),
      new THREE.Vector2(1.2, 2.4),
      new THREE.Vector2(1.6, 3.2),
      new THREE.Vector2(1.8, 4.2),
      new THREE.Vector2(1.7, 4.3),
      new THREE.Vector2(1.5, 4.3),
      new THREE.Vector2(1.4, 3.2),
      new THREE.Vector2(0, 2.2),
    ];
    
    // Generate a smooth spline curve from the profile points
    const curve = new THREE.SplineCurve(profilePoints);
    const smoothPoints = curve.getPoints(80); // 80 segments for perfect smoothness
    
    // Scale everything down
    return smoothPoints.map(p => new THREE.Vector2(p.x * 0.55, p.y * 0.55))
  }, [])

  return (
    <group position={[0, -1, 0]}>
      {/* Main body (lathe) */}
      <mesh material={trophyMaterial} castShadow>
        <latheGeometry args={[points, 128]} /> {/* High segment count for smooth rounded look */}
      </mesh>
      
      {/* Handles */}
      <mesh material={trophyMaterial} position={[-0.8, 1.8, 0]} rotation={[0, 0, Math.PI / 6]} castShadow>
        <torusGeometry args={[0.5, 0.08, 32, 128]} />
      </mesh>
      <mesh material={trophyMaterial} position={[0.8, 1.8, 0]} rotation={[0, 0, -Math.PI / 6]} castShadow>
        <torusGeometry args={[0.5, 0.08, 32, 128]} />
      </mesh>
    </group>
  )
}

function Basketball() {
  const textures = useMemo(() => createBasketballTextures(), [])
  
  return (
    <Float speed={1.5} rotationIntensity={2} floatIntensity={3} position={[-3.5, 2, -1]}>
      <mesh castShadow>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial 
          map={textures.map}
          bumpMap={textures.bumpMap}
          bumpScale={0.05} // Indent the black lines
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>
    </Float>
  )
}

function SoccerBall() {
  const textures = useMemo(() => createSoccerTextures(), [])
  
  return (
    <Float speed={2.5} rotationIntensity={3} floatIntensity={2} position={[3.5, 1.5, -2]}>
      <mesh castShadow>
        <sphereGeometry args={[1.2, 64, 64]} />
        <meshStandardMaterial 
          map={textures.map}
          bumpMap={textures.bumpMap}
          bumpScale={0.02} // Indent the panel gaps
          roughness={0.5}
          metalness={0.1}
        />
      </mesh>
    </Float>
  )
}

function TennisBall() {
  const textures = useMemo(() => createTennisTextures(), [])
  
  return (
    <Float speed={3} rotationIntensity={2} floatIntensity={4} position={[-2, -2.5, 2]}>
      <mesh castShadow>
        <sphereGeometry args={[0.5, 64, 64]} />
        <meshStandardMaterial 
          map={textures.map}
          bumpMap={textures.bumpMap}
          bumpScale={0.03} // Fuzz and deep seams
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>
    </Float>
  )
}

function Shapes() {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.1) * 0.2
    }
  })

  return (
    <group ref={groupRef}>
      {/* Central Trophy */}
      <Float speed={2} rotationIntensity={0.5} floatIntensity={1} position={[0, -0.5, 0]}>
        <TrophyShape />
      </Float>

      <Basketball />
      <SoccerBall />
      <TennisBall />

      {/* Floating Ping Pong / generic ball */}
      <Float speed={2} rotationIntensity={1} floatIntensity={2} position={[3, -2, 1.5]}>
        <mesh castShadow>
          <sphereGeometry args={[0.4, 32, 32]} />
          <meshPhysicalMaterial 
            color="#ffffff"
            transmission={0.95}
            opacity={1}
            metalness={0.1}
            roughness={0.05}
            ior={1.5}
            thickness={2}
          />
        </mesh>
      </Float>
    </group>
  )
}

export function HeroScene() {
  return (
    <div className="absolute inset-0 h-full w-full opacity-100 pointer-events-auto">
      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={45} />
        
        {/* Soft lighting setup */}
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1.5} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        
        <PresentationControls
          global
          config={{ mass: 2, tension: 500 }}
          snap={{ mass: 4, tension: 1500 }}
          rotation={[0, 0.3, 0]}
          polar={[-Math.PI / 3, Math.PI / 3]}
          azimuth={[-Math.PI / 1.4, Math.PI / 2]}
        >
          <Shapes />
        </PresentationControls>

        {/* High-quality HDR environment for hyper-realistic lighting & reflections */}
        <Environment preset="studio" />
        
        {/* Soft shadow plane underneath */}
        <ContactShadows position={[0, -3.5, 0]} opacity={0.6} scale={20} blur={2.5} far={4.5} />
      </Canvas>
    </div>
  )
}
