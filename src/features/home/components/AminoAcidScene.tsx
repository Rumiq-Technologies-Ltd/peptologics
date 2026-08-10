"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * The stylized amino acid that anchors the hero.
 *
 * Ball-and-stick, not molecularly exact: a central alpha carbon with an amino group,
 * a carboxyl group and a side chain, arranged so the shape reads as "amino acid" at a
 * glance without claiming to depict a specific compound. Making it exact would invite
 * the reading that it *is* a product, which is the one thing this site must not imply.
 *
 * Everything here is generated geometry — no model file, no texture, no environment
 * map. That is partly taste and mostly the CSP: `connect-src 'self'` means a drei
 * helper fetching an HDR from a CDN would be blocked at runtime, so the lighting is
 * three real lights instead.
 *
 * The whole file is the client boundary for the hero. Its parent, and everything else
 * in the section, stays a Server Component.
 */

/** Brand palette, as the design tokens define it. Kept literal — three needs hex, not CSS vars. */
const NAVY = "#0F172A";
const BRAND_BLUE = "#1D4ED8";
const HYDROGEN = "#c8c8cb";
const OXYGEN = "#3a63e2";

/**
 * Atom positions, in scene units, laid out around the alpha carbon at the origin.
 *
 * `backbone` atoms are navy and structural; `highlight` atoms are brand blue and
 * emissive, which is what carries the "lit from within" look without a bloom pass.
 */
const ATOMS = [
  // The alpha carbon: the centre everything else hangs off.
  { key: "alpha-carbon", position: [0, 0, 0], radius: 0.52, tone: "backbone" },

  // Amino group, left.
  { key: "nitrogen", position: [-1.55, 0.5, 0.15], radius: 0.44, tone: "highlight" },
  { key: "amino-h1", position: [-2.35, 1.05, -0.25], radius: 0.2, tone: "hydrogen" },
  { key: "amino-h2", position: [-2.05, -0.05, 0.85], radius: 0.2, tone: "hydrogen" },

  // Carboxyl group, right: one double-bonded oxygen and one hydroxyl.
  { key: "carboxyl-carbon", position: [1.5, 0.35, -0.2], radius: 0.46, tone: "backbone" },
  { key: "oxygen-double", position: [2.35, 1.2, 0.15], radius: 0.42, tone: "oxygen" },
  { key: "oxygen-hydroxyl", position: [1.95, -0.6, -1.0], radius: 0.42, tone: "oxygen" },
  { key: "hydroxyl-h", position: [2.85, -1.1, -1.35], radius: 0.2, tone: "hydrogen" },

  // Side chain, rising out of the plane so the shape has depth from any angle.
  { key: "beta-carbon", position: [0.1, 1.55, 0.5], radius: 0.42, tone: "backbone" },
  { key: "gamma-carbon", position: [-0.35, 2.6, -0.15], radius: 0.4, tone: "highlight" },
  { key: "side-terminal", position: [0.25, 3.5, 0.55], radius: 0.34, tone: "highlight" },

  // The alpha hydrogen, below.
  { key: "alpha-h", position: [-0.3, -1.05, -0.55], radius: 0.2, tone: "hydrogen" },
] as const satisfies readonly {
  key: string;
  position: readonly [number, number, number];
  radius: number;
  tone: "backbone" | "highlight" | "hydrogen" | "oxygen";
}[];

/** Which atoms are joined. Index pairs into `ATOMS`, resolved once at module scope. */
const BONDS = [
  ["alpha-carbon", "nitrogen"],
  ["nitrogen", "amino-h1"],
  ["nitrogen", "amino-h2"],
  ["alpha-carbon", "carboxyl-carbon"],
  ["carboxyl-carbon", "oxygen-double"],
  ["carboxyl-carbon", "oxygen-hydroxyl"],
  ["oxygen-hydroxyl", "hydroxyl-h"],
  ["alpha-carbon", "beta-carbon"],
  ["beta-carbon", "gamma-carbon"],
  ["gamma-carbon", "side-terminal"],
  ["alpha-carbon", "alpha-h"],
] as const;

const TONE_COLOR: Record<string, string> = {
  backbone: NAVY,
  highlight: BRAND_BLUE,
  hydrogen: HYDROGEN,
  oxygen: OXYGEN,
};

/** How far the model tilts toward the pointer, in radians, at the edge of the canvas. */
const PARALLAX_X = 0.22;
const PARALLAX_Y = 0.32;
/** Higher eases back to centre faster. Tuned so idle drift is calm, not springy. */
const PARALLAX_EASE = 2.4;
/** A full turn every ~35 seconds. Slow enough to read as ambient rather than spinning. */
const SPIN_SPEED = 0.18;

function atomByKey(key: string) {
  const atom = ATOMS.find((candidate) => candidate.key === key);
  if (!atom) throw new Error(`Unknown atom "${key}"`);
  return atom;
}

/**
 * One bond, as a cylinder stretched between two atoms.
 *
 * A cylinder is born along the Y axis, so it has to be rotated onto the bond vector.
 * That rotation is computed once per bond at module evaluation rather than per frame —
 * the geometry never changes, only the group around it moves.
 */
function bondTransform(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
) {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const direction = new THREE.Vector3().subVectors(end, start);

  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize(),
  );

  return {
    position: new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5),
    rotation: new THREE.Euler().setFromQuaternion(quaternion),
    length: direction.length(),
  };
}

const BOND_TRANSFORMS = BONDS.map(([fromKey, toKey]) => ({
  key: `${fromKey}-${toKey}`,
  ...bondTransform(atomByKey(fromKey).position, atomByKey(toKey).position),
}));

/**
 * The molecule itself.
 *
 * Two nested groups on purpose: the outer one carries the pointer tilt, the inner one
 * the continuous spin. Combining both on a single group would mean the tilt fighting
 * the rotation every frame.
 */
function Molecule({ animate }: { animate: boolean }) {
  const tiltRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);

  // Shared across every atom and bond: 23 meshes, two geometries.
  const sphereGeometry = useMemo(() => new THREE.SphereGeometry(1, 32, 32), []);
  const cylinderGeometry = useMemo(() => new THREE.CylinderGeometry(0.085, 0.085, 1, 16), []);

  useFrame((state, delta) => {
    if (!animate) return;

    // `delta` rather than a frame count, so the speed is the same at 60 and 120 Hz.
    if (spinRef.current) spinRef.current.rotation.y += delta * SPIN_SPEED;

    if (tiltRef.current) {
      const { x, y } = state.pointer;
      // Eased toward the target rather than snapped, so the model settles back to
      // centre when the pointer leaves instead of stopping dead.
      const ease = Math.min(1, delta * PARALLAX_EASE);
      tiltRef.current.rotation.x += (-y * PARALLAX_X - tiltRef.current.rotation.x) * ease;
      tiltRef.current.rotation.y += (x * PARALLAX_Y - tiltRef.current.rotation.y) * ease;
    }
  });

  return (
    <group ref={tiltRef} rotation={[0.12, -0.35, 0]}>
      {/*
        Offsets the group so the model's own centre of mass sits on the origin, not its
        alpha carbon. The atoms span roughly x -2.35..2.85 and y -1.05..3.5, so without
        this the molecule renders high and to the right of its box — visible in the first
        screenshot as dead space along the bottom-left.
      */}
      <group ref={spinRef} position={[-0.25, -1.2, 0]}>
        {ATOMS.map((atom) => {
          const isHighlight = atom.tone === "highlight";

          return (
            <mesh
              key={atom.key}
              geometry={sphereGeometry}
              // Spread element-wise: a `readonly` tuple is not assignable to the
              // mutable one three expects.
              position={[atom.position[0], atom.position[1], atom.position[2]]}
              scale={atom.radius}
            >
              <meshStandardMaterial
                color={TONE_COLOR[atom.tone]}
                roughness={isHighlight ? 0.25 : 0.32}
                metalness={0.2}
                // Stands in for a bloom pass: the brand-blue atoms read as lit from
                // within, at no extra render target (see the PR discussion).
                emissive={isHighlight ? BRAND_BLUE : "#000000"}
                emissiveIntensity={isHighlight ? 0.45 : 0}
              />
            </mesh>
          );
        })}

        {BOND_TRANSFORMS.map((bond) => (
          <mesh
            key={bond.key}
            geometry={cylinderGeometry}
            position={bond.position}
            rotation={bond.rotation}
            scale={[1, bond.length, 1]}
          >
            <meshStandardMaterial color={NAVY} roughness={0.5} metalness={0.1} opacity={0.9} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export interface AminoAcidSceneProps {
  /**
   * False pauses the render loop entirely — the canvas keeps its last frame and costs
   * nothing. Set while the section is off-screen, the tab is hidden, or the disclaimer
   * gate is still covering the page.
   */
  active?: boolean;
}

export default function AminoAcidScene({ active = true }: AminoAcidSceneProps) {
  const prefersReducedMotion = useReducedMotion();
  const animate = active && !prefersReducedMotion;

  return (
    <Canvas
      // Capped rather than uncapped `window.devicePixelRatio`. A phone reporting 3
      // would otherwise render nine times the pixels for a difference nobody can see
      // on a 400px canvas.
      dpr={[1, 1.75]}
      /*
       * "demand" rather than "never" when paused. Both stop the continuous loop, but
       * "demand" still draws the initial frame — which is exactly what the
       * reduced-motion case needs: a rendered, static pose rather than a blank canvas.
       */
      frameloop={animate ? "always" : "demand"}
      // Pulled in from 9: at that distance the molecule filled barely half its square
      // and read as small rather than as a centrepiece.
      camera={{ position: [0, 0, 7.4], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      {/* Base fill, so unlit faces are still legible rather than black. */}
      <ambientLight intensity={0.85} />
      {/* Key light, high and to the right, giving the spheres their specular edge. */}
      <directionalLight position={[4, 6, 5]} intensity={1.7} />
      {/* Cool rim from below-left, which is what stops the navy reading as flat. */}
      <directionalLight position={[-5, -3, -4]} intensity={0.75} color={BRAND_BLUE} />

      <Molecule animate={animate} />
    </Canvas>
  );
}
