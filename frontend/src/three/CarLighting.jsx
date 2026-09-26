import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { sceneState } from './CarScrollController.jsx';

export default function CarLighting({ quality = 'high' }) {
  const keyLight = useRef();
  const rimLight = useRef();
  const fillLight = useRef();
  const accentLight = useRef();

  useFrame(() => {
    const progress = sceneState.dampedProgress;
    if (keyLight.current) {
      keyLight.current.intensity = 3.6 - progress * 0.6;
      keyLight.current.position.x = 5.5 - progress * 3.2;
      keyLight.current.position.y = 7.5 - progress * 1.8;
    }
    if (rimLight.current) {
      rimLight.current.intensity = 2.4 + progress * 2.6;
    }
    if (fillLight.current) {
      fillLight.current.intensity = 0.35;
    }
    if (accentLight.current) {
      accentLight.current.intensity = progress > 0.4 ? 3.2 * (progress - 0.4) : 0;
    }
  });

  return (
    <>
      <ambientLight intensity={0.15} color="#6B7A8F" />
      <hemisphereLight args={['#3A4654', '#0A0C10', 0.25]} />

      {/* Bright key light — main highlight on the body */}
      <directionalLight
        ref={keyLight}
        position={[5.5, 7.5, 3.4]}
        intensity={3.6}
        color="#FFF6E6"
        castShadow={quality === 'high'}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
      >
        <orthographicCamera attach="shadow-camera" args={[-8, 8, 8, -8, 0.1, 30]} />
      </directionalLight>

      {/* Lime rim light — the DriveEase brand accent, gives the car an edge */}
      <directionalLight ref={rimLight} position={[-6, 3, -5]} intensity={2.4} color="#D7F24B" />

      {/* Cool fill — kills the pure-black shadows without flattening the scene */}
      <directionalLight ref={fillLight} position={[0, 2, -8]} intensity={0.35} color="#7FE3FF" />

      {/* Underside accent — only kicks in mid-scroll */}
      <pointLight ref={accentLight} position={[0, 0.3, 0]} intensity={0} color="#D7F24B" distance={8} />
    </>
  );
}
