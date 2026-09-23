import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { sceneState } from './CarScrollController.jsx';

/**
 * Lighting rig.
 *
 * A programmatically generated room environment (three's RoomEnvironment +
 * PMREM) provides image-based reflections, which is what makes the paint read
 * as paint. No HDR file is downloaded, and the generated texture is disposed on
 * unmount.
 *
 * On top of that sit three practical lights - a cool key, a lime rim that ties
 * back to the brand accent, and a soft fill - whose intensities are modulated
 * by scroll progress so the car is lit differently in each story beat.
 */
export default function CarLighting({ quality = 'high' }) {
  const { gl, scene } = useThree();
  const keyLight = useRef();
  const rimLight = useRef();
  const fillLight = useRef();
  const accentLight = useRef();

  const environment = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);
    return { pmrem, room, texture: target.texture };
  }, [gl]);

  useEffect(() => {
    scene.environment = environment.texture;
    return () => {
      scene.environment = null;
      environment.texture.dispose();
      environment.pmrem.dispose();
      environment.room.dispose?.();
    };
  }, [scene, environment]);

  useFrame(() => {
    const progress = sceneState.dampedProgress;
    // Lighting shifts subtly across the story: warmer and tighter at the start,
    // cooler and more sculpted once the car turns.
    if (keyLight.current) {
      keyLight.current.intensity = 2.1 - progress * 0.5;
      keyLight.current.position.x = 4.5 - progress * 3.2;
      keyLight.current.position.y = 6.2 - progress * 1.8;
    }
    if (rimLight.current) {
      rimLight.current.intensity = 1.4 + progress * 1.9;
      rimLight.current.position.z = 5.2 - progress * 2.4;
    }
    if (fillLight.current) {
      fillLight.current.intensity = 0.55 + progress * 0.35;
    }
    if (accentLight.current) {
      accentLight.current.intensity = progress > 0.45 ? 2.4 * (progress - 0.45) : 0;
    }
  });

  return (
    <>
      <ambientLight intensity={0.34} color="#8FB6C8" />
      <hemisphereLight args={['#9FB6C4', '#0A0C10', 0.42]} />

      <directionalLight
        ref={keyLight}
        position={[4.5, 6.2, 3.4]}
        intensity={1.9}
        color="#FFF3E0"
        castShadow={quality === 'high'}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0008}
      >
        <orthographicCamera attach="shadow-camera" args={[-7, 7, 7, -7, 0.1, 30]} />
      </directionalLight>

      <directionalLight ref={rimLight} position={[-4.6, 2.4, 4.2]} intensity={1.6} color="#D7F24B" />
      <directionalLight ref={fillLight} position={[0, 1.6, -6]} intensity={0.6} color="#7FE3FF" />
      <pointLight ref={accentLight} position={[0, 0.35, 0]} intensity={0} color="#D7F24B" distance={6} />
    </>
  );
}
