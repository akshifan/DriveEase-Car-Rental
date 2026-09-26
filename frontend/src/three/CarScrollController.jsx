import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Scroll-driven choreography for the 3D scene.
 *
 * Two responsibilities:
 *   1. a module-level `sceneState` store, written by a passive scroll listener
 *      (no React re-render per frame) and read by the car, camera and lighting;
 *   2. the frame loop that damps the car towards its target pose.
 *
 * Every value is critically damped, and every velocity-driven effect decays
 * back to zero once the scroll stops, so the car settles smoothly into the
 * exact pose implied by the current scroll position.
 */

export const sceneState = {
  progress: 0,
  dampedProgress: 0,
  pointerX: 0,
  pointerY: 0,
  dampedPointerX: 0,
  dampedPointerY: 0,
  velocity: 0,
  wheelSpin: 0,
  reducedMotion: false,
};

const clamp01 = (value) => Math.min(1, Math.max(0, value));

/** Frame-rate independent exponential damping. */
function damp(current, target, lambda, delta) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * delta));
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

/** Piecewise interpolation over `[{ at, ... }]` keyframes with eased segments. */
export function sampleKeyframes(keyframes, progress) {
  if (progress <= keyframes[0].at) return keyframes[0];
  const last = keyframes[keyframes.length - 1];
  if (progress >= last.at) return last;

  for (let index = 1; index < keyframes.length; index += 1) {
    const previous = keyframes[index - 1];
    const next = keyframes[index];
    if (progress > next.at) continue;

    const span = next.at - previous.at || 1;
    const t = smoothstep(clamp01((progress - previous.at) / span));
    const blended = { at: progress };
    Object.keys(next).forEach((key) => {
      if (key === 'at') return;
      const from = previous[key];
      const to = next[key];
      blended[key] = Array.isArray(to)
        ? to.map((component, i) => THREE.MathUtils.lerp(from[i], component, t))
        : THREE.MathUtils.lerp(from, to, t);
    });
    return blended;
  }
  return last;
}

/** Car pose across the sequence: rotate through a full beauty pass. */
const CAR_KEYFRAMES = [
  { at: 0.0,  rotationY: -0.68, rotationZ: 0.015, position: [0.35, 0, 0],    scale: 1.0 },
  { at: 0.3,  rotationY:  0.42, rotationZ: 0.0,   position: [0.1, 0.05, 0.15], scale: 1.01 },
  { at: 0.56, rotationY:  1.85, rotationZ: -0.012, position: [-0.15, 0.02, 0.25], scale: 1.02 },
  { at: 0.8,  rotationY:  3.05, rotationZ: 0.01,  position: [-0.05, 0.07, 0.1],  scale: 1.01 },
  { at: 1.0,  rotationY:  3.95, rotationZ: 0.0,   position: [0.0, 0.02, 0.0],   scale: 1.0 },
];

/**
 * Attaches passive scroll/resize listeners that turn the sticky stage's
 * position into 0..1 progress. Cheap: reads geometry inside a rAF-throttled
 * handler and never touches layout during the frame loop.
 */
export function registerStageTracking(element, { reducedMotion = false } = {}) {
  if (!element || typeof window === 'undefined') return () => {};

  sceneState.reducedMotion = reducedMotion;
  let frame = 0;

  const measure = () => {
    frame = 0;
    const rect = element.getBoundingClientRect();
    const viewport = window.innerHeight || 1;
    const scrollable = Math.max(1, rect.height - viewport);
    const travelled = clamp01(-rect.top / scrollable);
    const delta = travelled - sceneState.progress;
    sceneState.progress = travelled;
    // Velocity is proportional to the per-frame scroll delta, smoothed against
    // the previous frame's velocity. Clamped so a single large trackpad jump
    // does not produce an abrupt tilt.
    sceneState.velocity = Math.min(
      2.5,
      Math.abs(delta) * 18 + sceneState.velocity * 0.75,
    );
  };

  const onScroll = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(measure);
  };

  const onPointerMove = (event) => {
    if (sceneState.reducedMotion) return;
    const width = window.innerWidth || 1;
    const height = window.innerHeight || 1;
    sceneState.pointerX = clamp01(event.clientX / width) * 2 - 1;
    sceneState.pointerY = clamp01(event.clientY / height) * 2 - 1;
  };

  const onPointerLeave = () => {
    sceneState.pointerX = 0;
    sceneState.pointerY = 0;
  };

  measure();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  // Pointer parallax is a mouse affordance: touch devices drag instead.
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerleave', onPointerLeave, { passive: true });

  return () => {
    if (frame) window.cancelAnimationFrame(frame);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerleave', onPointerLeave);
  };
}

export default function CarScrollController({ carRef }) {
  const wheelsRef = useRef([]);

  useEffect(() => {
    const group = carRef?.current;
    if (!group) return undefined;
    // First damped frame should land on the current pose, not animate in.
    sceneState.dampedProgress = sceneState.progress;

    // Cache wheel meshes once so the per-frame loop never walks the scene graph.
    const wheels = [];
    group.traverse((child) => {
      if (child.name === 'wheel') wheels.push(child);
    });
    wheelsRef.current = wheels;

    return () => {
      wheelsRef.current = [];
    };
  }, [carRef]);

  useFrame((_, delta) => {
    const group = carRef?.current;
    const step = Math.min(delta, 0.05);

    sceneState.dampedProgress = damp(sceneState.dampedProgress, sceneState.progress,
      sceneState.reducedMotion ? 30 : 5.2, step);
    sceneState.dampedPointerX = damp(sceneState.dampedPointerX, sceneState.pointerX, 2.6, step);
    sceneState.dampedPointerY = damp(sceneState.dampedPointerY, sceneState.pointerY, 2.6, step);
    // Velocity decays fast so the tilt/scale pulse feels responsive and settles.
    sceneState.velocity = damp(sceneState.velocity, 0, 3.4, step);

    if (!group) return;

    const progress = sceneState.reducedMotion ? 0.42 : sceneState.dampedProgress;
    const pose = sampleKeyframes(CAR_KEYFRAMES, progress);

    // ---- base pose from keyframes -------------------------------------
    const baseY = pose.rotationY + sceneState.dampedPointerX * 0.09;
    const baseZ = pose.rotationZ;
    const baseX = -sceneState.dampedPointerY * 0.02;

    // ---- velocity-driven overlay --------------------------------------
    // Pitch: nose-down when scrolling down, nose-up when scrolling up.
    const velocityTilt = THREE.MathUtils.clamp(sceneState.velocity * 0.045, -0.14, 0.14);
    // Roll: slight bank in the direction of motion.
    const velocityRoll = THREE.MathUtils.clamp(sceneState.velocity * 0.025, -0.07, 0.07);
    // Lift: the car rises a touch while the scroll is in motion.
    const velocityLift = Math.min(sceneState.velocity, 2) * 0.06;
    // Expand: the car pulses up to ~8% larger during a fast scroll.
    const velocityScale = 1 + Math.min(sceneState.velocity, 2) * 0.04;

    group.rotation.y = baseY;
    group.rotation.z = baseZ + velocityRoll;
    group.rotation.x = baseX + velocityTilt;

    group.position.set(
      pose.position[0],
      pose.position[1] + velocityLift,
      pose.position[2],
    );

    group.scale.setScalar(pose.scale * velocityScale);

    if (!sceneState.reducedMotion && wheelsRef.current.length) {
      sceneState.wheelSpin += (0.5 + sceneState.velocity * 6) * step;
      for (const wheel of wheelsRef.current) {
        wheel.rotation.z = -sceneState.wheelSpin;
      }
    }
  });

  return null;
}
