import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { sceneState, sampleKeyframes } from './CarScrollController.jsx';

/**
 * Camera rig.
 *
 * Five keyframed camera stops describe one continuous orbit around the car.
 * Positions are sampled with the same eased interpolation as the car, then
 * damped towards - so the camera keeps travelling for a moment after the
 * scrolling stops, which is what reads as "cinematic" rather than "attached".
 *
 * A narrow, damped pointer offset adds parallax; it is disabled for reduced
 * motion and on touch-first devices (where there is no hover to react to).
 */
const CAMERA_KEYFRAMES = [
  { at: 0.0, position: [7.4, 2.6, 8.6], target: [0, 0.85, 0] },
  { at: 0.3, position: [9.6, 1.55, 4.6], target: [0, 0.8, 0] },
  { at: 0.56, position: [5.2, 1.15, 9.4], target: [0, 0.72, 0] },
  { at: 0.8, position: [-6.4, 1.75, 7.2], target: [0, 0.88, 0] },
  { at: 1.0, position: [-8.4, 2.3, 3.4], target: [0, 0.95, 0] },
];

export default function CarCamera({ quality = 'high' }) {
  const { camera, size } = useThree();
  const desiredPosition = useRef(new THREE.Vector3(7.4, 2.6, 8.6));
  const desiredTarget = useRef(new THREE.Vector3(0, 0.85, 0));
  const currentTarget = useRef(new THREE.Vector3(0, 0.85, 0));

  /** Portrait/narrow viewports need a wider lens and more distance. */
  const framing = useMemo(() => {
    const narrow = size.width < 820;
    return {
      narrow,
      distanceScale: narrow ? 1.42 : 1,
      heightOffset: narrow ? 0.55 : 0,
      fov: narrow ? 46 : 38,
    };
  }, [size.width]);

  useFrame((state, delta) => {
    const step = Math.min(delta, 0.05);
    const progress = sceneState.reducedMotion ? 0.42 : sceneState.dampedProgress;
    const stop = sampleKeyframes(CAMERA_KEYFRAMES, progress);

    const scale = framing.distanceScale;
    desiredPosition.current.set(
      stop.position[0] * scale,
      stop.position[1] * (framing.narrow ? 1.12 : 1) + framing.heightOffset,
      stop.position[2] * scale,
    );
    desiredTarget.current.set(stop.target[0], stop.target[1], stop.target[2]);

    const parallaxStrength = sceneState.reducedMotion || framing.narrow ? 0 : 1;
    desiredPosition.current.x += sceneState.dampedPointerX * 0.42 * parallaxStrength;
    desiredPosition.current.y += -sceneState.dampedPointerY * 0.26 * parallaxStrength;
    desiredTarget.current.x += sceneState.dampedPointerX * 0.16 * parallaxStrength;

    const lambda = sceneState.reducedMotion ? 30 : 3.6;
    camera.position.lerp(desiredPosition.current, 1 - Math.exp(-lambda * step));
    currentTarget.current.lerp(desiredTarget.current, 1 - Math.exp(-lambda * step));
    camera.lookAt(currentTarget.current);

    if (camera.isPerspectiveCamera && camera.fov !== framing.fov) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, framing.fov, 1 - Math.exp(-6 * step));
      camera.updateProjectionMatrix();
    }

    // Keep the canvas resolution honest on quality changes.
    if (state.gl.getPixelRatio() > qualityMaxPixelRatio(quality)) {
      state.gl.setPixelRatio(qualityMaxPixelRatio(quality));
    }
  });

  return null;
}

function qualityMaxPixelRatio(quality) {
  return quality === 'low' ? 1.25 : 1.75;
}
