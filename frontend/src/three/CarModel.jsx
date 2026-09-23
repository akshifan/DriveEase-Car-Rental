import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import GlbCar from './GlbCar.jsx';

/**
 * The DriveEase car.
 *
 * This is an original model, authored in code - no third-party or licensed
 * asset is bundled. The silhouette is built by extruding a hand-drawn side
 * profile, which gives a recognisable grand-tourer shape with very few draw
 * calls (one body, one greenhouse, four wheels).
 *
 * A real glTF/GLB asset can be dropped in instead: set VITE_CAR_MODEL_URL to a
 * model path and <CarModel> swaps in <GlbCar> (see below). The procedural car
 * stays as the offline default so the site never depends on a remote asset.
 */

const CAR_MODEL_URL = import.meta.env.VITE_CAR_MODEL_URL || '';

/** Shared, memoised geometry + materials - created once, disposed on unmount. */
function useCarAssets() {
  const assets = useMemo(() => {
    // ---- side profile of the body, extruded across the width -------------
    const bodyShape = new THREE.Shape();
    bodyShape.moveTo(2.18, 0.3);
    bodyShape.quadraticCurveTo(2.3, 0.42, 2.16, 0.6);
    bodyShape.lineTo(1.78, 0.72);
    bodyShape.quadraticCurveTo(1.45, 0.78, 1.12, 1.02);
    bodyShape.quadraticCurveTo(0.72, 1.32, 0.1, 1.36);
    bodyShape.quadraticCurveTo(-0.72, 1.38, -1.24, 1.1);
    bodyShape.quadraticCurveTo(-1.66, 0.9, -2.04, 0.78);
    bodyShape.quadraticCurveTo(-2.28, 0.66, -2.24, 0.4);
    bodyShape.lineTo(-2.1, 0.24);
    bodyShape.lineTo(-1.62, 0.2);
    bodyShape.lineTo(1.62, 0.2);
    bodyShape.lineTo(2.02, 0.24);
    bodyShape.closePath();

    const bodyGeometry = new THREE.ExtrudeGeometry(bodyShape, {
      depth: 1.62,
      bevelEnabled: true,
      bevelThickness: 0.09,
      bevelSize: 0.11,
      bevelSegments: 3,
      curveSegments: 16,
    });
    bodyGeometry.translate(0, 0, -0.81);
    bodyGeometry.computeVertexNormals();

    // ---- greenhouse (glass) ---------------------------------------------
    const glassShape = new THREE.Shape();
    glassShape.moveTo(1.06, 1.0);
    glassShape.quadraticCurveTo(0.7, 1.26, 0.12, 1.3);
    glassShape.quadraticCurveTo(-0.66, 1.31, -1.16, 1.06);
    glassShape.lineTo(-1.16, 1.0);
    glassShape.lineTo(1.06, 1.0);
    glassShape.closePath();

    const glassGeometry = new THREE.ExtrudeGeometry(glassShape, {
      depth: 1.5,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 1,
      curveSegments: 12,
    });
    glassGeometry.translate(0, 0, -0.75);

    const wheelGeometry = new THREE.CylinderGeometry(0.37, 0.37, 0.26, 28, 1);
    wheelGeometry.rotateX(Math.PI / 2);

    const rimGeometry = new THREE.CylinderGeometry(0.23, 0.23, 0.28, 20, 1);
    rimGeometry.rotateX(Math.PI / 2);

    const discGeometry = new THREE.CylinderGeometry(0.16, 0.16, 0.3, 16, 1);
    discGeometry.rotateX(Math.PI / 2);

    const materials = {
      // Clearcoated dielectric paint: reads as polished graphite under studio
      // lights and stays visible even without an environment map (metal-only
      // paint goes black when no IBL is present, e.g. software GL).
      paint: new THREE.MeshPhysicalMaterial({
        color: '#6E7987',
        metalness: 0.45,
        roughness: 0.3,
        clearcoat: 1.0,
        clearcoatRoughness: 0.22,
        envMapIntensity: 1.2,
      }),
      paintDark: new THREE.MeshStandardMaterial({
        color: '#232A33',
        metalness: 0.4,
        roughness: 0.5,
      }),
      glass: new THREE.MeshPhysicalMaterial({
        color: '#0B1216',
        metalness: 0.1,
        roughness: 0.06,
        transmission: 0.35,
        thickness: 0.4,
        transparent: true,
        opacity: 0.92,
        envMapIntensity: 1.8,
      }),
      tyre: new THREE.MeshStandardMaterial({ color: '#0A0B0D', roughness: 0.92, metalness: 0.05 }),
      rim: new THREE.MeshStandardMaterial({
        color: '#C9D1D6',
        metalness: 1,
        roughness: 0.22,
        envMapIntensity: 1.4,
      }),
      disc: new THREE.MeshStandardMaterial({ color: '#3C444D', metalness: 0.9, roughness: 0.4 }),
      accent: new THREE.MeshStandardMaterial({
        color: '#D7F24B',
        emissive: '#D7F24B',
        emissiveIntensity: 1.5,
        metalness: 0.3,
        roughness: 0.3,
      }),
      headlight: new THREE.MeshStandardMaterial({
        color: '#EAF7FF',
        emissive: '#BFE9FF',
        emissiveIntensity: 2.4,
        roughness: 0.2,
      }),
      taillight: new THREE.MeshStandardMaterial({
        color: '#FF5A5A',
        emissive: '#FF2D2D',
        emissiveIntensity: 1.9,
        roughness: 0.3,
      }),
      underglow: new THREE.MeshBasicMaterial({
        color: '#D7F24B',
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    };

    const underglowGeometry = new THREE.PlaneGeometry(4.3, 2.4);

    return {
      bodyGeometry,
      glassGeometry,
      wheelGeometry,
      rimGeometry,
      discGeometry,
      underglowGeometry,
      materials,
    };
  }, []);

  // Explicit GPU cleanup: r3f disposes JSX-declared objects, but these were
  // created imperatively and must be released by hand.
  useEffect(
    () => () => {
      Object.values(assets).forEach((value) => {
        if (value && typeof value.dispose === 'function') value.dispose();
      });
      Object.values(assets.materials).forEach((material) => material.dispose());
    },
    [assets],
  );

  return assets;
}

function Wheel({ geometry, rimGeometry, discGeometry, tyre, rim, disc, position }) {
  return (
    // The name lets CarScrollController spin wheels without owning the model.
    <group name="wheel" position={position}>
      <mesh geometry={geometry} material={tyre} castShadow receiveShadow />
      <mesh geometry={rimGeometry} material={rim} />
      <mesh geometry={discGeometry} material={disc} />
      {/* Five spokes give the rim readable detail without extra geometry cost. */}
      {Array.from({ length: 5 }).map((_, index) => (
        <mesh
          key={index}
          position={[0, 0, 0]}
          rotation={[0, 0, (Math.PI * 2 * index) / 5]}
          material={rim}
        >
          <boxGeometry args={[0.34, 0.045, 0.12]} />
        </mesh>
      ))}
    </group>
  );
}

/** The original procedural car. */
function ProceduralCar({ modelRef }) {
  const { bodyGeometry, glassGeometry, wheelGeometry, rimGeometry, discGeometry, underglowGeometry, materials } =
    useCarAssets();

  return (
    <group ref={modelRef} dispose={null}>
      {/* main body */}
      <mesh geometry={bodyGeometry} material={materials.paint} castShadow receiveShadow />
      {/* greenhouse */}
      <mesh geometry={glassGeometry} material={materials.glass} position={[0, 0.02, 0]} />

      {/* lower valance + diffuser add visual weight */}
      <RoundedBox args={[3.9, 0.16, 1.5]} radius={0.06} smoothness={3} position={[0, 0.19, 0]}>
        <meshStandardMaterial color="#0A0C0F" metalness={0.6} roughness={0.6} />
      </RoundedBox>

      {/* side accent blade - the brand's lime line */}
      {[0.86, -0.86].map((z) => (
        <mesh key={z} material={materials.accent} position={[-0.2, 0.53, z]}>
          <boxGeometry args={[3.3, 0.035, 0.02]} />
        </mesh>
      ))}

      {/* grille */}
      <mesh material={materials.paintDark} position={[2.1, 0.42, 0]}>
        <boxGeometry args={[0.1, 0.2, 1.12]} />
      </mesh>

      {/* lights */}
      {[0.62, -0.62].map((z) => (
        <RoundedBox
          key={`h${z}`}
          args={[0.2, 0.1, 0.42]}
          radius={0.04}
          smoothness={2}
          position={[2.02, 0.68, z]}
          material={materials.headlight}
        />
      ))}
      {[0.64, -0.64].map((z) => (
        <RoundedBox
          key={`t${z}`}
          args={[0.14, 0.09, 0.46]}
          radius={0.03}
          smoothness={2}
          position={[-2.14, 0.72, z]}
          material={materials.taillight}
        />
      ))}

      {/* mirrors */}
      {[1.02, -1.02].map((z) => (
        <RoundedBox key={`m${z}`} args={[0.16, 0.09, 0.24]} radius={0.035} smoothness={2} position={[0.85, 1.0, z]}>
          <meshStandardMaterial color="#151A20" metalness={0.8} roughness={0.3} />
        </RoundedBox>
      ))}

      {/* rear spoiler */}
      <mesh material={materials.paintDark} position={[-1.92, 1.0, 0]}>
        <boxGeometry args={[0.38, 0.045, 1.42]} />
      </mesh>
      {[0.6, -0.6].map((z) => (
        <mesh key={`s${z}`} material={materials.paintDark} position={[-1.9, 0.92, z]}>
          <boxGeometry args={[0.12, 0.16, 0.05]} />
        </mesh>
      ))}

      {/* wheels */}
      <Wheel
        geometry={wheelGeometry}
        rimGeometry={rimGeometry}
        discGeometry={discGeometry}
        tyre={materials.tyre}
        rim={materials.rim}
        disc={materials.disc}
        position={[1.42, 0.37, 0.9]}
      />
      <Wheel
        geometry={wheelGeometry}
        rimGeometry={rimGeometry}
        discGeometry={discGeometry}
        tyre={materials.tyre}
        rim={materials.rim}
        disc={materials.disc}
        position={[1.42, 0.37, -0.9]}
      />
      <Wheel
        geometry={wheelGeometry}
        rimGeometry={rimGeometry}
        discGeometry={discGeometry}
        tyre={materials.tyre}
        rim={materials.rim}
        disc={materials.disc}
        position={[-1.5, 0.37, 0.9]}
      />
      <Wheel
        geometry={wheelGeometry}
        rimGeometry={rimGeometry}
        discGeometry={discGeometry}
        tyre={materials.tyre}
        rim={materials.rim}
        disc={materials.disc}
        position={[-1.5, 0.37, -0.9]}
      />

      {/* underglow */}
      <mesh geometry={underglowGeometry} material={materials.underglow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} />
    </group>
  );
}

export default function CarModel({ modelRef, quality = 'high' }) {
  // The original procedural car is the default; a real glTF/GLB asset can be
  // configured with VITE_CAR_MODEL_URL without touching any other code.
  if (CAR_MODEL_URL) {
    return <GlbCar modelRef={modelRef} url={CAR_MODEL_URL} quality={quality} />;
  }
  return <ProceduralCar modelRef={modelRef} quality={quality} />;
}

export { ProceduralCar };
