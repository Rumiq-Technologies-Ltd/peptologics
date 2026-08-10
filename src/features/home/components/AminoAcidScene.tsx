"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * The stylized amino acid that anchors the hero.
 *
 * Ball-and-stick, not molecularly exact: a central alpha carbon with an amino group,
 * a carboxyl group and a side chain, arranged so the shape reads as "amino acid" at a
 * glance without claiming to depict a specific compound. Making it exact would invite
 * the reading that it *is* a product, which is the one thing this site must not imply.
 *
 * Everything here is generated — no model file, no texture, and no downloaded HDR. That
 * last one is the CSP: `connect-src 'self'` means a drei helper fetching an environment
 * map from a CDN would be blocked at runtime. The glossy finish instead comes from
 * three's own `RoomEnvironment`, a procedural studio box rendered once into a PMREM
 * probe on the client, which costs one offscreen render and no network at all.
 *
 * The whole file is the client boundary for the hero. Its parent, and everything else
 * in the section, stays a Server Component.
 */

/**
 * Brand palette, as the design tokens define it. Kept literal — three needs hex, not CSS
 * vars.
 *
 * Laid out the way the logo mark is: a black core and black connectors, with the blue
 * reserved for the outer spheres. The model's own structure already divides the same way,
 * so the mapping is direct — the inner carbons and the bonds take the black, the
 * functional groups hanging off them take the blues.
 */
const CORE_BLACK = "#222223"; // ink-950, the mark's connectors and inner nodes
const LOGO_BLUE = "#0031bc"; // brand-800, the mark's outer spheres
const BRIGHT_BLUE = "#0044ff"; // brand-600, the lighter blue of the wordmark
// The four terminal hydrogens: the mark's small joints, and dark for the same reason —
// white vanished against the page's near-white background.
const HYDROGEN = "#29292b"; // ink-900

/**
 * Atom positions, in scene units, laid out around the alpha carbon at the origin.
 *
 * `backbone` atoms are the black inner carbons; `highlight` and `oxygen` are the blue
 * groups hanging off them, the highlights emissive so they carry the "lit from within"
 * look without a bloom pass.
 */
const ATOMS = [
  // The alpha carbon: the centre everything else hangs off.
  { key: "alpha-carbon", position: [0, 0, 0], radius: 0.52, tone: "backbone" },

  // Amino group, left.
  { key: "nitrogen", position: [-1.55, 0.5, 0.15], radius: 0.44, tone: "highlight" },
  { key: "amino-h1", position: [-2.35, 1.05, -0.25], radius: 0.28, tone: "hydrogen" },
  { key: "amino-h2", position: [-2.05, -0.05, 0.85], radius: 0.28, tone: "hydrogen" },

  // Carboxyl group, right: one double-bonded oxygen and one hydroxyl.
  { key: "carboxyl-carbon", position: [1.5, 0.35, -0.2], radius: 0.46, tone: "backbone" },
  { key: "oxygen-double", position: [2.35, 1.2, 0.15], radius: 0.42, tone: "oxygen" },
  { key: "oxygen-hydroxyl", position: [1.95, -0.6, -1.0], radius: 0.42, tone: "oxygen" },
  { key: "hydroxyl-h", position: [2.85, -1.1, -1.35], radius: 0.28, tone: "hydrogen" },

  // Side chain, rising out of the plane so the shape has depth from any angle.
  { key: "beta-carbon", position: [0.1, 1.55, 0.5], radius: 0.42, tone: "backbone" },
  { key: "gamma-carbon", position: [-0.35, 2.6, -0.15], radius: 0.4, tone: "highlight" },
  { key: "side-terminal", position: [0.25, 3.5, 0.55], radius: 0.34, tone: "highlight" },

  // The alpha hydrogen, below.
  { key: "alpha-h", position: [-0.3, -1.05, -0.55], radius: 0.28, tone: "hydrogen" },
] as const satisfies readonly {
  key: string;
  position: readonly [number, number, number];
  radius: number;
  tone: "backbone" | "highlight" | "hydrogen" | "oxygen";
}[];

/**
 * Which atoms are joined. Index pairs into `ATOMS`, resolved once at module scope.
 *
 * Only the amino acid's real bonding. Extra links were tried — closing the three carbons
 * into a triangle, joining the two oxygens — to make the shape echo the logo's lattice,
 * and they were removed: a peptide supplier's own molecule should not show bonds that
 * cannot exist. The mark is quoted through colour instead.
 */
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

/**
 * Bond thickness.
 *
 * Chunky rather than wireframe-thin, so a bond catches the same specular highlight the
 * atoms do and the joints read as one moulded object instead of sticks between beads.
 */
const BOND_RADIUS = 0.19;

/** How far the model tilts toward the pointer, in radians, at the edge of the canvas. */
const PARALLAX_X = 0.22;
const PARALLAX_Y = 0.32;
/** Higher eases back to centre faster. Tuned so idle drift is calm, not springy. */
const PARALLAX_EASE = 2.4;
/** A full turn every ~14 seconds — a visible drift, still short of a spin. */
const SPIN_SPEED = 0.45;

/**
 * Longer than a default lens, and deliberately.
 *
 * A wide field of view exaggerates depth: the near atoms bloat, the far ones shrink, and
 * the frame has to be loosened to stop the near ones clipping — so the model ends up
 * *smaller* on screen. Pulling back onto a longer lens flattens the shape, which both
 * fills more of the box and matches the studio-render look of the reference.
 */
const FIELD_OF_VIEW = 30;
/** Slack between the model's widest sweep and the frame edge. 1 would have them touch. */
const FRAMING_MARGIN = 1.02;

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

/* --------------------------------------------------------------------------
 * Framing.
 *
 * The model is laid out around its alpha carbon, which is nowhere near the middle of
 * the shape. Spinning about that point swung the far side of the carboxyl group out
 * through the edge of the canvas — the clipping that prompted this pass.
 *
 * So: derive the model's own centre, rotate about *that*, and place the camera from
 * what the rotation actually sweeps rather than from a distance picked by eye. Both
 * fall out of `ATOMS`, so adding or moving an atom re-frames the shot on its own.
 * ------------------------------------------------------------------------ */

function modelCentre() {
  const box = new THREE.Box3();

  for (const atom of ATOMS) {
    const position = new THREE.Vector3(...atom.position);
    box.expandByPoint(position.clone().subScalar(atom.radius));
    box.expandByPoint(position.clone().addScalar(atom.radius));
  }

  return box.getCenter(new THREE.Vector3());
}

const MODEL_CENTRE = modelCentre();

/**
 * Every position an atom's centre ever occupies: the full turn of the spin, at each
 * limit of the pointer tilt.
 *
 * The tilt is applied outside the spin, so sweeping the whole circle for the spin and
 * then tilting covers every combination of the two — including the pointer tilt on Y,
 * which is the same axis the spin already sweeps.
 */
const SPIN_SAMPLES = 96;
const TILT_SAMPLES = 5;

const SWEPT_ATOMS = ATOMS.flatMap((atom) => {
  const base = new THREE.Vector3(...atom.position).sub(MODEL_CENTRE);
  const positions: { position: THREE.Vector3; radius: number }[] = [];

  for (let spin = 0; spin < SPIN_SAMPLES; spin += 1) {
    const spun = base
      .clone()
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), (spin / SPIN_SAMPLES) * Math.PI * 2);

    for (let step = 0; step < TILT_SAMPLES; step += 1) {
      const tilt = PARALLAX_X * ((2 * step) / (TILT_SAMPLES - 1) - 1);

      positions.push({
        position: spun.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), tilt),
        radius: atom.radius,
      });
    }
  }

  return positions;
});

/**
 * The closest the camera can sit with nothing ever leaving the frame.
 *
 * Comparing extents against the frustum's width at the model's centre plane is the
 * obvious approach and it is wrong: it is an orthographic test on a perspective camera.
 * An atom swung toward the viewer is nearer than the centre plane, so the frame there is
 * narrower and it clips while the arithmetic still says it fits — which is exactly how
 * the alpha hydrogen kept clipping off the bottom edge.
 *
 * The honest test is angular. A sphere is inside the frustum when the angle from the view
 * axis to its centre, widened by its own angular radius, stays within half the field of
 * view. That holds under perspective at any depth, so the search below simply asks for
 * the smallest distance at which every swept position passes.
 *
 * The canvas is square, so one distance covers both axes.
 */
function fitsAt(distance: number): boolean {
  const halfFov = (FIELD_OF_VIEW / 2) * THREE.MathUtils.DEG2RAD;
  const camera = new THREE.Vector3(0, 0, distance);

  return SWEPT_ATOMS.every(({ position, radius }) => {
    const toAtom = position.clone().sub(camera);
    const range = toAtom.length();

    // Behind the camera, or so close the sphere swallows it: no distance test is
    // meaningful, so treat it as not fitting and let the search push the camera back.
    if (range <= radius) return false;

    const offAxis = Math.acos(THREE.MathUtils.clamp(-toAtom.z / range, -1, 1));

    return offAxis + Math.asin(radius / range) <= halfFov;
  });
}

function nearestSafeDistance(): number {
  let tooClose = 0;
  let safe = 100;

  // 40 halvings resolve the interval far below one scene unit; the loop is bounded rather
  // than convergence-tested so a pathological model cannot hang module evaluation.
  for (let iteration = 0; iteration < 40; iteration += 1) {
    const midpoint = (tooClose + safe) / 2;
    if (fitsAt(midpoint)) safe = midpoint;
    else tooClose = midpoint;
  }

  return safe;
}

const CAMERA_DISTANCE = nearestSafeDistance() * FRAMING_MARGIN;

/**
 * The molecule itself.
 *
 * Two nested groups on purpose: the outer one carries the pointer tilt, the inner one
 * the continuous spin. Combining both on a single group would mean the tilt fighting
 * the rotation every frame.
 */
/**
 * The reflections the glossy materials need, built on the client and never fetched.
 *
 * `RoomEnvironment` is a plain three scene — a box with a few emissive panels standing in
 * for softboxes. Rendering it through `PMREMGenerator` gives the pre-filtered probe that
 * `clearcoat` and `metalness` sample, and that is where the highlights sliding across the
 * atoms come from. One offscreen render at mount, then nothing.
 *
 * Returned for the materials to hold as their own `envMap` rather than assigned to
 * `scene.environment`. Same result, and it keeps every piece of GPU state this file
 * creates owned by the thing that disposes it.
 */
function useStudioProbe(): THREE.WebGLRenderTarget {
  const renderer = useThree((state) => state.gl);

  const probe = useMemo(() => {
    const generator = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const rendered = generator.fromScene(room, 0.04);

    // Both are scaffolding: the probe survives them.
    room.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
    generator.dispose();

    return rendered;
  }, [renderer]);

  useEffect(() => () => probe.dispose(), [probe]);

  return probe;
}

function Molecule({ animate }: { animate: boolean }) {
  const tiltRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const probe = useStudioProbe();

  // Shared across every atom and bond: 23 meshes, two geometries.
  const sphereGeometry = useMemo(() => new THREE.SphereGeometry(1, 48, 48), []);
  const cylinderGeometry = useMemo(
    () => new THREE.CylinderGeometry(BOND_RADIUS, BOND_RADIUS, 1, 24),
    [],
  );

  /*
   * One material per tone rather than one per mesh. Twenty-three `<meshPhysicalMaterial>`
   * elements would be twenty-three shader programs' worth of uniforms to update; five
   * covers the whole model.
   *
   * Physical rather than standard because of `clearcoat`: it adds a second, sharper
   * specular lobe over the base one, which is the difference between "plastic bead" and
   * the lacquered look of the reference. The environment probe supplies what those lobes
   * reflect — without it, both materials would render nearly black.
   */
  const materials = useMemo(() => {
    const shell = (color: string, extra?: THREE.MeshPhysicalMaterialParameters) =>
      new THREE.MeshPhysicalMaterial({
        color,
        envMap: probe.texture,
        metalness: 0.45,
        roughness: 0.12,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        envMapIntensity: 1.7,
        ...extra,
      });

    return {
      backbone: shell(CORE_BLACK),
      // The blue atoms carry a little emissive on top of the reflections, which is what
      // reads as "lit from within" without paying for a bloom pass.
      highlight: shell(LOGO_BLUE, {
        metalness: 0.35,
        roughness: 0.09,
        emissive: new THREE.Color(LOGO_BLUE),
        emissiveIntensity: 0.4,
      }),
      hydrogen: shell(HYDROGEN, { metalness: 0.2, roughness: 0.1 }),
      oxygen: shell(BRIGHT_BLUE, { metalness: 0.35, roughness: 0.1 }),
      bond: shell(CORE_BLACK, { metalness: 0.5, roughness: 0.18 }),
    } satisfies Record<string, THREE.MeshPhysicalMaterial>;
  }, [probe]);

  // Nothing here is declared as JSX, so R3F will not dispose any of it for us.
  useEffect(() => {
    return () => {
      sphereGeometry.dispose();
      cylinderGeometry.dispose();
      for (const material of Object.values(materials)) material.dispose();
    };
  }, [sphereGeometry, cylinderGeometry, materials]);

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
      <group ref={spinRef}>
        {/*
          Shifts the atoms so the model's own centre lands on the group origin. Both the
          spin and the tilt turn about that origin, so this is what keeps the far side of
          the carboxyl group inside the frame instead of swinging out past its edge.
        */}
        <group position={[-MODEL_CENTRE.x, -MODEL_CENTRE.y, -MODEL_CENTRE.z]}>
          {ATOMS.map((atom) => (
            <mesh
              key={atom.key}
              geometry={sphereGeometry}
              material={materials[atom.tone]}
              // Spread element-wise: a `readonly` tuple is not assignable to the
              // mutable one three expects.
              position={[atom.position[0], atom.position[1], atom.position[2]]}
              scale={atom.radius}
            />
          ))}

          {BOND_TRANSFORMS.map((bond) => (
            <mesh
              key={bond.key}
              geometry={cylinderGeometry}
              material={materials.bond}
              position={bond.position}
              rotation={bond.rotation}
              scale={[1, bond.length, 1]}
            />
          ))}
        </group>
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
      // Derived, not chosen: far enough that nothing clips at any point in the rotation,
      // and no further. See the framing block above.
      camera={{ position: [0, 0, CAMERA_DISTANCE], fov: FIELD_OF_VIEW }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      {/*
        The probe now does most of the lighting, so these three are much weaker than they
        were: enough to shape the form and keep the shadow side from going flat, not
        enough to wash out the reflections that carry the finish.
      */}
      <ambientLight intensity={0.35} />
      {/* Key light, high and to the right, giving the spheres their specular edge. */}
      <directionalLight position={[4, 6, 5]} intensity={1.1} />
      {/* Cool rim from below-left, which is what stops the black reading as flat. */}
      <directionalLight position={[-5, -3, -4]} intensity={0.5} color={BRIGHT_BLUE} />

      <Molecule animate={animate} />
    </Canvas>
  );
}
