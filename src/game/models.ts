import * as THREE from 'three';
import { ChickenSkinId, EnemyArchetype, HatId, VisorId, WeaponId } from './types';

export interface ChickenRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftWing: THREE.Group;
  rightWing: THREE.Group;
  weaponMount: THREE.Group;
  jetFlameLeft: THREE.Mesh;
  jetFlameRight: THREE.Mesh;
  hitMeshes: THREE.Mesh[];
  setWeapon: (weaponId: WeaponId) => void;
  setJetpackActive: (active: boolean) => void;
}

const SKIN_COLORS: Record<ChickenSkinId, { body: number; wing: number; accent: number }> = {
  classic: { body: 0xf8fafc, wing: 0xe2e8f0, accent: 0xef4444 },
  gold: { body: 0xfbbf24, wing: 0xd97706, accent: 0xb91c1c },
  ninja: { body: 0x1e293b, wing: 0x0f172a, accent: 0xef4444 },
  cyber: { body: 0x0284c7, wing: 0x0369a1, accent: 0x38bdf8 },
  crimson: { body: 0xdc2626, wing: 0x991b1b, accent: 0xfacc15 },
};

export function createWeaponMesh(weaponId: WeaponId): THREE.Group {
  const group = new THREE.Group();
  const metalDark = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.85 });
  const metalSteel = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.25, metalness: 0.9 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.78, metalness: 0.05 });

  if (weaponId === 'ak_galo') {
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.56), metalDark);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.48, 8), metalSteel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, 0.45);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.32), woodMat);
    stock.position.set(0, -0.03, -0.36);
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.11, 0.24), woodMat);
    handguard.position.set(0, 0, 0.28);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.11), metalDark);
    mag.position.set(0, -0.17, 0.08);
    mag.rotation.x = 0.25;
    group.add(receiver, barrel, stock, handguard, mag);
  } else if (weaponId === 'shotgun') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.16, 0.48), metalDark);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.54, 8), metalSteel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.04, 0.42);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 8), metalDark);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, -0.03, 0.36);
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.22), woodMat);
    pump.position.set(0, -0.04, 0.34);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.32), woodMat);
    stock.position.set(0, -0.04, -0.34);
    group.add(body, barrel, tube, pump, stock);
  } else if (weaponId === 'bazooka') {
    const olive = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.65, metalness: 0.2 });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.05, 12), olive);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.06, 0.12);
    const flare = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.16, 12), metalDark);
    flare.rotation.x = Math.PI / 2;
    flare.position.set(0, 0.06, 0.66);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.2, 0.11), metalDark);
    grip.position.set(0, -0.1, 0.1);
    const eggWarhead = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.3, metalness: 0.1 }),
    );
    eggWarhead.scale.set(1, 1, 1.35);
    eggWarhead.position.set(0, 0.06, 0.72);
    group.add(tube, flare, grip, eggWarhead);
  } else if (weaponId === 'laser') {
    const shellMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.25, metalness: 0.4 });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 1.6,
      roughness: 0.15,
    });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.19, 0.68), shellMat);
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.38), glowMat);
    core.position.set(0, 0.02, 0.15);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.34, 10), metalSteel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, 0.48);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), glowMat);
    tip.position.set(0, 0, 0.66);
    group.add(hull, core, barrel, tip);
  } else {
    // Golden Frying Pan
    const panGold = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.22, metalness: 0.92 });
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.42), metalDark);
    handle.position.set(0, 0, 0.14);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.21, 0.07, 14), panGold);
    rim.position.set(0, 0.02, 0.54);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 14), metalDark);
    face.position.set(0, 0.035, 0.54);
    group.add(handle, rim, face);
  }

  return group;
}

export function createChickenModel(options: {
  skin: ChickenSkinId;
  hat: HatId;
  visor: VisorId;
  scale?: number;
  withJetpack?: boolean;
  archetype?: EnemyArchetype;
}): ChickenRig {
  const scale = options.scale ?? 1;
  const palette = SKIN_COLORS[options.skin];

  const featherMat = new THREE.MeshStandardMaterial({
    color: palette.body,
    roughness: 0.85,
    metalness: 0.02,
  });
  const wingMat = new THREE.MeshStandardMaterial({
    color: palette.wing,
    roughness: 0.82,
    metalness: 0.04,
  });
  const combMat = new THREE.MeshStandardMaterial({
    color: palette.accent,
    roughness: 0.48,
    metalness: 0.05,
  });
  const beakMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    roughness: 0.32,
    metalness: 0.08,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.12,
    metalness: 0.2,
  });

  const root = new THREE.Group();
  root.scale.setScalar(scale);

  const hitMeshes: THREE.Mesh[] = [];

  // Body pivot around hip height so bottom of feet sit at y = 0
  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = 0.55;
  root.add(bodyGroup);

  // Plump torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.72, 0.84), featherMat);
  torso.position.y = 0.22;
  torso.castShadow = true;
  torso.receiveShadow = true;
  bodyGroup.add(torso);
  hitMeshes.push(torso);

  // Tail feathers (layered)
  const tailUpper = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.28), wingMat);
  tailUpper.position.set(0, 0.36, -0.46);
  tailUpper.rotation.x = -0.35;
  tailUpper.castShadow = true;
  const tailTip = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 0.22), combMat);
  tailTip.position.set(0, 0.48, -0.56);
  tailTip.rotation.x = -0.5;
  bodyGroup.add(tailUpper, tailTip);

  // Legs (grounded so foot bottom = y: 0 in root space)
  const createLeg = (xOffset: number): THREE.Group => {
    const leg = new THREE.Group();
    leg.position.set(xOffset, 0.42, 0.02);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.36, 0.11), beakMat);
    shin.position.y = -0.18;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.3), beakMat);
    foot.position.set(0, -0.38, 0.07);
    leg.add(shin, foot);
    return leg;
  };
  const leftLeg = createLeg(-0.2);
  const rightLeg = createLeg(0.2);
  root.add(leftLeg, rightLeg);

  // Wings
  const leftWing = new THREE.Group();
  leftWing.position.set(-0.42, 0.28, 0.02);
  const leftWingMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.52), wingMat);
  leftWingMesh.position.set(-0.04, -0.1, 0);
  leftWingMesh.castShadow = true;
  leftWing.add(leftWingMesh);

  const rightWing = new THREE.Group();
  rightWing.position.set(0.42, 0.28, 0.02);
  const rightWingMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.52), wingMat);
  rightWingMesh.position.set(0.04, -0.1, 0);
  rightWingMesh.castShadow = true;
  rightWing.add(rightWingMesh);

  const weaponMount = new THREE.Group();
  weaponMount.position.set(-0.1, -0.06, 0.34);
  weaponMount.scale.setScalar(1.18);
  leftWing.add(weaponMount);

  bodyGroup.add(leftWing, rightWing);

  // Head Group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.62, 0.16);
  bodyGroup.add(headGroup);

  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.52, 0.56), featherMat);
  headMesh.position.y = 0.24;
  headMesh.castShadow = true;
  headMesh.userData.isHead = true;
  headGroup.add(headMesh);
  hitMeshes.push(headMesh);

  // Red Comb (3 lobes)
  for (let i = 0; i < 3; i++) {
    const lobe = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.16 - i * 0.02, 0.13),
      combMat,
    );
    lobe.position.set(0, 0.56 - i * 0.015, 0.12 - i * 0.13);
    headGroup.add(lobe);
  }

  // Beak & Wattle
  const beakTop = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 4), beakMat);
  beakTop.rotation.x = Math.PI / 2;
  beakTop.rotation.y = Math.PI / 4;
  beakTop.position.set(0, 0.21, 0.38);
  const wattle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.12), combMat);
  wattle.position.set(0, 0.07, 0.3);
  headGroup.add(beakTop, wattle);

  // Eyes
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.06), eyeMat);
  eyeL.position.set(-0.17, 0.3, 0.27);
  const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.06), eyeMat);
  eyeR.position.set(0.17, 0.3, 0.27);
  headGroup.add(eyeL, eyeR);

  // Visors
  if (options.visor === 'shades') {
    const shadesMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.12, metalness: 0.85 });
    const lensL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.06), shadesMat);
    lensL.position.set(-0.15, 0.3, 0.31);
    const lensR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.06), shadesMat);
    lensR.position.set(0.15, 0.3, 0.31);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.05, 0.05), shadesMat);
    bridge.position.set(0, 0.32, 0.3);
    headGroup.add(lensL, lensR, bridge);
  } else if (options.visor === 'tactical') {
    const visorGlass = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.6,
      roughness: 0.1,
      metalness: 0.7,
    });
    const visorBand = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.15, 0.12), visorGlass);
    visorBand.position.set(0, 0.3, 0.29);
    headGroup.add(visorBand);
  }

  // Hats
  if (options.hat === 'helmet') {
    const helmMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.55, metalness: 0.25 });
    const dome = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.26, 0.64), helmMat);
    dome.position.set(0, 0.48, 0);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.06, 0.72), helmMat);
    brim.position.set(0, 0.39, 0.04);
    headGroup.add(dome, brim);
  } else if (options.hat === 'crown') {
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.2, metalness: 0.92 });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.26, 0.14, 8), goldMat);
    ring.position.set(0, 0.56, 0);
    headGroup.add(ring);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 4), goldMat);
      spike.position.set(Math.cos(a) * 0.21, 0.69, Math.sin(a) * 0.21);
      headGroup.add(spike);
    }
  } else if (options.hat === 'sombrero') {
    const strawMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.85, metalness: 0.02 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.07, 16), strawMat);
    brim.position.set(0, 0.49, 0);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.28, 12), strawMat);
    crown.position.set(0, 0.64, 0);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.285, 0.07, 12), combMat);
    band.position.set(0, 0.54, 0);
    headGroup.add(brim, crown, band);
  } else if (options.hat === 'mohawk') {
    const punkMat = new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.45, metalness: 0.1 });
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28 - i * 0.03, 0.14), punkMat);
      fin.position.set(0, 0.58, 0.18 - i * 0.13);
      headGroup.add(fin);
    }
  } else if (options.hat === 'tophat') {
    const velvetMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.7, metalness: 0.1 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 14), velvetMat);
    brim.position.set(0, 0.51, 0);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.26, 0.38, 14), velvetMat);
    top.position.set(0, 0.72, 0);
    const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.07, 14), combMat);
    ribbon.position.set(0, 0.57, 0);
    headGroup.add(brim, top, ribbon);
  }

  // Jetpack or Bomber TNT Pack
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
  const jetFlameLeft = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.34, 6), flameMat);
  jetFlameLeft.rotation.x = Math.PI;
  jetFlameLeft.position.set(-0.14, -0.05, -0.52);
  jetFlameLeft.visible = false;

  const jetFlameRight = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.34, 6), flameMat);
  jetFlameRight.rotation.x = Math.PI;
  jetFlameRight.position.set(0.14, -0.05, -0.52);
  jetFlameRight.visible = false;

  if (options.archetype === 'bomber') {
    const tntMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45, emissive: 0x7f1d1d, emissiveIntensity: 0.5 });
    const pack = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.5, 10), tntMat);
    pack.position.set(0, 0.28, -0.5);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.1, 10), eyeMat);
    band.position.set(0, 0.28, -0.5);
    bodyGroup.add(pack, band);
  } else if (options.withJetpack) {
    const packMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.35, metalness: 0.8 });
    const tankL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.44, 8), packMat);
    tankL.position.set(-0.14, 0.26, -0.49);
    const tankR = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.44, 8), packMat);
    tankR.position.set(0.14, 0.26, -0.49);
    bodyGroup.add(tankL, tankR, jetFlameLeft, jetFlameRight);
  }

  let currentWeapon: THREE.Group | null = null;
  const setWeapon = (weaponId: WeaponId) => {
    if (currentWeapon) {
      weaponMount.remove(currentWeapon);
    }
    currentWeapon = createWeaponMesh(weaponId);
    weaponMount.add(currentWeapon);
  };

  const setJetpackActive = (active: boolean) => {
    jetFlameLeft.visible = active;
    jetFlameRight.visible = active;
  };

  return {
    root,
    bodyGroup,
    headGroup,
    leftLeg,
    rightLeg,
    leftWing,
    rightWing,
    weaponMount,
    jetFlameLeft,
    jetFlameRight,
    hitMeshes,
    setWeapon,
    setJetpackActive,
  };
}

export interface BuggyRig {
  root: THREE.Group;
  wheels: THREE.Mesh[];
  steeringPivot: THREE.Group;
}

export function createBuggyModel(): BuggyRig {
  const root = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.38, metalness: 0.35 });
  const cageMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.75 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.88, metalness: 0.05 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.25, metalness: 0.88 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.12, metalness: 0.3, transparent: true, opacity: 0.65 });

  // Chassis (bottom sits above wheel axle)
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.55, 3.6), bodyMat);
  chassis.position.set(0, 0.68, 0);
  chassis.castShadow = true;
  chassis.receiveShadow = true;

  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.35, 1.1), bodyMat);
  hood.position.set(0, 1.0, 1.1);
  hood.rotation.x = 0.14;

  // Rollcage pillars
  const pillarFL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.05, 0.1), cageMat);
  pillarFL.position.set(-0.88, 1.4, 0.52);
  pillarFL.rotation.x = -0.22;
  const pillarFR = pillarFL.clone();
  pillarFR.position.x = 0.88;

  const pillarRL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.1), cageMat);
  pillarRL.position.set(-0.88, 1.4, -0.95);
  const pillarRR = pillarRL.clone();
  pillarRR.position.x = 0.88;

  const roofBar = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.1, 1.45), cageMat);
  roofBar.position.set(0, 1.9, -0.22);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.65, 0.08), glassMat);
  windshield.position.set(0, 1.42, 0.56);
  windshield.rotation.x = -0.22;

  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.28, 0.25), cageMat);
  bumper.position.set(0, 0.55, 1.88);

  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 0.42), cageMat);
  spoiler.position.set(0, 1.45, -1.65);
  spoiler.rotation.x = 0.2;

  // Headlights
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 1.3 });
  const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.1), headMat);
  hl.position.set(-0.66, 0.78, 1.81);
  const hr = hl.clone();
  hr.position.x = 0.66;

  root.add(chassis, hood, pillarFL, pillarFR, pillarRL, pillarRR, roofBar, windshield, bumper, spoiler, hl, hr);

  const steeringPivot = new THREE.Group();
  root.add(steeringPivot);

  const wheels: THREE.Mesh[] = [];
  const wheelCoords: [number, number][] = [
    [-1.18, 1.2],
    [1.18, 1.2],
    [-1.18, -1.2],
    [1.18, -1.2],
  ];
  const tireGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.38, 14);
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.4, 10);
  rimGeo.rotateZ(Math.PI / 2);

  for (const [wx, wz] of wheelCoords) {
    const wheel = new THREE.Mesh(tireGeo, tireMat);
    wheel.position.set(wx, 0.48, wz);
    wheel.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, rimMat);
    wheel.add(rim);
    root.add(wheel);
    wheels.push(wheel);
  }

  return { root, wheels, steeringPivot };
}

export function createTurretModel(): { root: THREE.Group; head: THREE.Group } {
  const root = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.75 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.3, metalness: 0.6 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.58, 0.55, 8), baseMat);
  base.position.y = 0.275;
  base.castShadow = true;

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.45, 8), baseMat);
  stem.position.y = 0.72;

  const head = new THREE.Group();
  head.position.y = 1.02;

  const pod = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.36, 0.62), headMat);
  const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.6, 8), baseMat);
  barrelL.rotation.x = Math.PI / 2;
  barrelL.position.set(-0.14, 0, 0.45);
  const barrelR = barrelL.clone();
  barrelR.position.x = 0.14;

  head.add(pod, barrelL, barrelR);
  root.add(base, stem, head);

  return { root, head };
}
