import { useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Optional path for a real glTF/GLB car asset.
 *
 * Enabled only when VITE_CAR_MODEL_URL is configured, so the bundled build
 * never requests a model that is not there. The file is expected to be
 * self-authored or permissively licensed (e.g. CC0) - nothing copyrighted is
 * vendored with this project.
 */
export default function GlbCar({ modelRef, url, quality = 'high' }) {
  const { scene } = useGLTF(url);

  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = quality === 'high';
        child.receiveShadow = quality === 'high';
        if (child.material) {
          child.material.envMapIntensity = 1.1;
          child.material.needsUpdate = true;
        }
        <div className="pointer-events-none absolute inset-0 bg-ink-950/40" />
      }
    });
  }, [scene, quality]);

  return <primitive ref={modelRef} object={scene} scale={1} dispose={null} />;
}

export function disposeGlbCache() {
  // Free the cached glTF buffers when the scene unmounts for good.
  THREE.Cache.clear();
}
