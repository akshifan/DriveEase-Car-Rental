import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { AdaptiveDpr, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import CarModel, { ProceduralCar } from './CarModel.jsx';
import CarCamera from './CarCamera.jsx';
import CarLighting from './CarLighting.jsx';
import CarScrollController, { registerStageTracking, sceneState } from './CarScrollController.jsx';
import WebGLFallback from './WebGLFallback.jsx';

/**
 * The homepage 3D stage.
 *
 * - Detects WebGL before mounting a canvas; unsupported devices get an
 *   elegant static SVG instead of an empty box.
 * - Chooses a quality tier from viewport, CPU count and device memory; the
 *   mobile tier drops shadows, halves the pixel ratio and simplifies shadows.
 * - Pauses the render loop whenever the canvas is scrolled out of view, so a
 *   reader at the bottom of the page pays nothing for the scene above.
 * - Honours prefers-reduced-motion by rendering a single static frame
 *   (`frameloop="demand"`) with no scroll or pointer response at all.
 * - Disposes the renderer and any cached glTF buffers on unmount.
 */

function supportsWebGL() {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl')),
    );
  } catch {
    return false;
  }
}

function detectQuality() {
  if (typeof window === 'undefined') return 'low';
  const width = window.innerWidth;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  if (width < 900 || cores <= 4 || memory <= 4 || coarsePointer) return 'low';
  return 'high';
}

/** Catches a failed optional glTF load and keeps the original car on screen. */
class ModelBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    // Warn in development; production simply keeps the procedural model.
    if (import.meta.env.DEV) {
      console.warn('[DriveEaseScene] Falling back to the procedural car:', error?.message);
    }
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

/**
 * Procedural image-based lighting: PMREM-bakes three's RoomEnvironment into a
 * radiance map so metallic paint has something to reflect. Ships with three -
 * no network fetch, no licence concerns. Also re-invalidates demand-mode
 * (reduced motion) rendering so the baked frame includes it.
 */
function StudioEnvironment() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);
    scene.environment = target.texture;
    invalidate({ frames: 2 });
    return () => {
      scene.environment = null;
      target.dispose();
      pmrem.dispose();
    };
  }, [gl, scene, invalidate]);

  return null;
}

export default function DriveEaseScene({ className = '', ariaLabel = 'Interactive 3D view of a DriveEase car' }) {
  const hostRef = useRef(null);
  const carRef = useRef(null);
  const rendererRef = useRef(null);
  const [webgl, setWebgl] = useState(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [active, setActive] = useState(true);

  const quality = useMemo(() => detectQuality(), []);

  useEffect(() => {
    setWebgl(supportsWebGL());
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  // Scroll tracking for the scene: attached once WebGL is confirmed.
  useEffect(() => {
    if (!webgl || !hostRef.current) return undefined;
    const track = hostRef.current.closest('[data-scene-track]') || hostRef.current;
    return registerStageTracking(track, { reducedMotion });
  }, [webgl, reducedMotion]);

  // Stop rendering while the stage is off-screen.
  useEffect(() => {
    if (!hostRef.current) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { rootMargin: '180px 0px' },
    );
    observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, [webgl]);

  // Release the renderer and any cached glTF payloads when the stage unmounts.
  useEffect(
    () => () => {
      rendererRef.current?.dispose?.();
      rendererRef.current = null;
      THREE.Cache.clear();
    },
    [],
  );

  const frameloop = reducedMotion ? 'demand' : active ? 'always' : 'never';

  if (webgl === null) {
    // Single frame of neutral space while detection completes - avoids a flash.
    return <div ref={hostRef} className={`bg-ink-950/40 ${className}`} aria-hidden="true" />;
  }

  if (!webgl) {
    return (
      <div ref={hostRef} className={className} data-testid="webgl-fallback">
        <WebGLFallback reason="unavailable" />
      </div>
    );
  }

  return (
    <div ref={hostRef} className={className} data-quality={quality} data-testid="driveease-scene">
      <Canvas
        className="!touch-pan-y"
        frameloop={frameloop}
        dpr={quality === 'high' ? [1, 1.75] : [1, 1.2]}
        shadows={quality === 'high'}
        performance={{ min: 0.55 }}
        gl={{
          antialias: quality === 'high',
          alpha: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false,
        }}
        camera={{ fov: 38, near: 0.1, far: 70, position: [7.4, 2.6, 8.6] }}
        onCreated={({ gl, scene }) => {
          rendererRef.current = gl;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.06;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          scene.fog = new THREE.Fog('#07080A', 16, 34);
        }}
        aria-label={ariaLabel}
        role="img"
      >
        <Suspense fallback={null}>
          <StudioEnvironment />
          <CarLighting quality={quality} />
          <ModelBoundary fallback={<ProceduralCar modelRef={carRef} />}>
            <CarModel modelRef={carRef} quality={quality} />
          </ModelBoundary>
          <ContactShadows
            position={[0, 0.015, 0]}
            opacity={0.62}
            scale={13}
            blur={2.4}
            far={4.5}
            resolution={quality === 'high' ? 512 : 256}
            color="#000000"
          />
          <CarScrollController carRef={carRef} quality={quality} />
          <CarCamera quality={quality} />
        </Suspense>
        {frameloop === 'always' && <AdaptiveDpr />}
      </Canvas>
    </div>
  );
}

export { sceneState };
