import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Environment, PerspectiveCamera, PresentationControls, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { createBasketballTextures, createSoccerTextures, createTennisTextures } from './textures'

function TrophyShape() {
  const goldMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#ffb300', // Rich vibrant gold
    emissive: '#421600', // Subtle warm glow in crevices
    emissiveIntensity: 0.2,
    metalness: 1.0,
    roughness: 0.15,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    envMapIntensity: 2.5,
  }), [])

  const woodMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#3e1a06', // Rich mahogany wood
    roughness: 0.9,
    metalness: 0.1,
  }), [])

  const silverMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#f8fafc', // Bright Silver
    metalness: 1.0,
    roughness: 0.1,
    envMapIntensity: 3.0,
  }), [])

  const rubyMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#e11d48', // Deep Ruby Red
    metalness: 0.2,
    roughness: 0.05,
    transmission: 0.9, // Glass-like transparency
    ior: 1.5,
    thickness: 0.5,
  }), [])

  const sapphireMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#2563eb', // Royal Sapphire Blue
    metalness: 0.2,
    roughness: 0.05,
    transmission: 0.9,
    ior: 1.5,
    thickness: 0.5,
  }), [])

  const cupPoints = useMemo(() => {
    const path = new THREE.CurvePath<THREE.Vector2>();
    
    // Foot base
    path.add(new THREE.LineCurve(new THREE.Vector2(0, 0), new THREE.Vector2(0.8, 0)));
    path.add(new THREE.LineCurve(new THREE.Vector2(0.8, 0), new THREE.Vector2(0.8, 0.1)));
    
    // Foot slope to stem
    path.add(new THREE.CubicBezierCurve(
      new THREE.Vector2(0.8, 0.1),
      new THREE.Vector2(0.7, 0.3),
      new THREE.Vector2(0.3, 0.3),
      new THREE.Vector2(0.2, 0.5)
    ));
    
    // Lower Stem
    path.add(new THREE.LineCurve(new THREE.Vector2(0.2, 0.5), new THREE.Vector2(0.2, 1.0)));
    
    // Decorative Node on stem
    path.add(new THREE.CubicBezierCurve(
      new THREE.Vector2(0.2, 1.0),
      new THREE.Vector2(0.5, 1.1),
      new THREE.Vector2(0.5, 1.3),
      new THREE.Vector2(0.2, 1.4)
    ));
    
    // Upper Stem
    path.add(new THREE.LineCurve(new THREE.Vector2(0.2, 1.4), new THREE.Vector2(0.2, 1.7)));
    
    // Bowl bottom curve
    path.add(new THREE.CubicBezierCurve(
      new THREE.Vector2(0.2, 1.7),
      new THREE.Vector2(0.8, 1.8),
      new THREE.Vector2(1.2, 2.5),
      new THREE.Vector2(1.4, 3.2)
    ));
    
    // Bowl upper straightish
    path.add(new THREE.QuadraticBezierCurve(
      new THREE.Vector2(1.4, 3.2),
      new THREE.Vector2(1.5, 3.8),
      new THREE.Vector2(1.6, 4.0)
    ));
    
    // Rim outward lip
    path.add(new THREE.LineCurve(new THREE.Vector2(1.6, 4.0), new THREE.Vector2(1.75, 4.1)));
    path.add(new THREE.LineCurve(new THREE.Vector2(1.75, 4.1), new THREE.Vector2(1.75, 4.15)));
    path.add(new THREE.LineCurve(new THREE.Vector2(1.75, 4.15), new THREE.Vector2(1.6, 4.2)));
    
    // Close the top interior
    path.add(new THREE.LineCurve(new THREE.Vector2(1.6, 4.2), new THREE.Vector2(0, 4.2)));

    // Scale down
    return path.getPoints(120).map(p => new THREE.Vector2(p.x * 0.6, p.y * 0.6));
  }, [])

  const lidPoints = useMemo(() => {
    const path = new THREE.CurvePath<THREE.Vector2>();
    path.add(new THREE.LineCurve(new THREE.Vector2(0, 0), new THREE.Vector2(1.6, 0)));
    path.add(new THREE.CubicBezierCurve(
      new THREE.Vector2(1.6, 0),
      new THREE.Vector2(1.5, 0.3),
      new THREE.Vector2(0.8, 0.7),
      new THREE.Vector2(0.2, 1.0)
    ));
    path.add(new THREE.LineCurve(new THREE.Vector2(0.2, 1.0), new THREE.Vector2(0, 1.0)));
    return path.getPoints(40).map(p => new THREE.Vector2(p.x * 0.6, p.y * 0.6));
  }, [])

  const handleCurve = useMemo(() => {
    return new THREE.CubicBezierCurve3(
      new THREE.Vector3(0.5, 1.1, 0), // attach at lower bowl
      new THREE.Vector3(1.8, 1.1, 0), // pull out
      new THREE.Vector3(1.8, 2.4, 0), // pull up and out
      new THREE.Vector3(0.95, 2.4, 0) // attach at rim
    );
  }, [])

  return (
    <group position={[0, -1.5, 0]}>
      {/* Mahogany Wood Octagonal Base */}
      <group position={[0, 0, 0]}>
        <mesh material={woodMaterial} position={[0, 0.2, 0]} castShadow>
          <cylinderGeometry args={[1.0, 1.2, 0.4, 8]} />
        </mesh>
        <mesh material={woodMaterial} position={[0, 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.8, 0.9, 0.2, 8]} />
        </mesh>
        {/* Silver plaque on base */}
        <mesh material={silverMaterial} position={[0, 0.2, 1.15]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.8, 0.2, 0.05]} />
        </mesh>
      </group>

      {/* Gold Cup Assembly */}
      <group position={[0, 0.6, 0]}>
        {/* Main body (lathe) */}
        <mesh material={goldMaterial} castShadow>
          <latheGeometry args={[cupPoints, 128]} />
        </mesh>
        
        {/* Colored Gemstone Rings */}
        <mesh material={sapphireMaterial} position={[0, 0.05, 0]} castShadow>
          <torusGeometry args={[0.49, 0.05, 32, 64]} />
        </mesh>
        <mesh material={rubyMaterial} position={[0, 0.72, 0]} castShadow>
          <torusGeometry args={[0.26, 0.04, 32, 64]} />
        </mesh>

        {/* Elegant Sweeping Handles */}
        <mesh material={goldMaterial} castShadow>
          <tubeGeometry args={[handleCurve, 64, 0.06, 16, false]} />
        </mesh>
        <mesh material={goldMaterial} rotation={[0, Math.PI, 0]} castShadow>
          <tubeGeometry args={[handleCurve, 64, 0.06, 16, false]} />
        </mesh>

        {/* Decorative Ribbons on Handles */}
        {/* Left ribbons */}
        <group position={[-1.7, 1.8, 0]} rotation={[0, 0, 0.2]}>
           <mesh material={rubyMaterial} position={[-0.05, -0.4, 0.04]} rotation={[0, 0, -0.05]} castShadow>
             <boxGeometry args={[0.06, 1.0, 0.01]} />
           </mesh>
           <mesh material={sapphireMaterial} position={[0.05, -0.3, -0.04]} rotation={[0, 0, 0.1]} castShadow>
             <boxGeometry args={[0.06, 0.8, 0.01]} />
           </mesh>
        </group>
        {/* Right ribbons */}
        <group position={[1.7, 1.8, 0]} rotation={[0, 0, -0.2]}>
           <mesh material={rubyMaterial} position={[0.05, -0.4, 0.04]} rotation={[0, 0, 0.05]} castShadow>
             <boxGeometry args={[0.06, 1.0, 0.01]} />
           </mesh>
           <mesh material={sapphireMaterial} position={[-0.05, -0.3, -0.04]} rotation={[0, 0, -0.1]} castShadow>
             <boxGeometry args={[0.06, 0.8, 0.01]} />
           </mesh>
        </group>

        {/* Lid */}
        <group position={[0, 2.52, 0]}>
          <mesh material={goldMaterial} castShadow>
            <latheGeometry args={[lidPoints, 64]} />
          </mesh>
          {/* Top finial sphere */}
          <mesh material={silverMaterial} position={[0, 0.7, 0]} castShadow>
            <sphereGeometry args={[0.15, 32, 32]} />
          </mesh>
        </group>
      </group>
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
          polar={[-Math.PI / 8, Math.PI / 8]} // Limit vertical rotation to 22.5 degrees
          azimuth={[-Math.PI / 4, Math.PI / 4]} // Limit horizontal rotation to 45 degrees
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
