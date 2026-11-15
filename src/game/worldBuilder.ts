import * as THREE from 'three';
import { AABB2D } from './rules';
import { ProceduralTextureSet } from './textures';
import { ARENA_MAPS, ArenaMapId } from './types';

export interface RampSurface {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  lowY: number;
  highY: number;
  dir: 'north' | 'south' | 'east' | 'west';
}

export interface DestructibleBarrel {
  id: number;
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  hp: number;
  alive: boolean;
  colliderIdx: number;
}

export interface BuiltWorld {
  group: THREE.Group;
  colliders: AABB2D[];
  ramps: RampSurface[];
  barrels: DestructibleBarrel[];
  raycastTargets: THREE.Object3D[];
  radarDish?: THREE.Object3D;
  arenaRadius: number;
}

export function createBarrelMesh(): THREE.Group {
  const g = new THREE.Group();
  const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45, metalness: 0.35 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5, metalness: 0.2 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.8 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.15, 12), redMat);
  body.position.y = 0.575;
  body.castShadow = true;
  body.receiveShadow = true;

  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.24, 12), stripeMat);
  band.position.y = 0.58;

  const rimTop = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.08, 12), rimMat);
  rimTop.position.y = 1.12;

  const rimBot = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.08, 12), rimMat);
  rimBot.position.y = 0.04;

  g.add(body, band, rimTop, rimBot);
  return g;
}

export function createCrateMesh(textures: ProceduralTextureSet, size = 1.8): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.crateMap,
    bumpMap: textures.crateBump,
    bumpScale: 0.04,
    roughness: 0.82,
    metalness: 0.04,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
  mesh.position.y = size / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createRampMesh(
  width: number,
  height: number,
  length: number,
  color = 0x94a3b8,
): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(length, 0);
  shape.lineTo(length, height);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: false,
  });
  // Center along width (Z -> X) and orient climb along -Z
  geo.translate(-length / 2, 0, -width / 2);
  geo.rotateY(Math.PI / 2);

  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness: 0.18,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildArenaWorld(
  mapId: ArenaMapId,
  textures: ProceduralTextureSet,
): BuiltWorld {
  const spec = ARENA_MAPS[mapId];
  const group = new THREE.Group();
  const colliders: AABB2D[] = [];
  const ramps: RampSurface[] = [];
  const barrels: DestructibleBarrel[] = [];
  const raycastTargets: THREE.Object3D[] = [];
  const arenaRadius = 56;
  let barrelIdCounter = 1;
  let radarDish: THREE.Object3D | undefined;

  // Extended ground plane (320x320) so world never ends in an abrupt floating edge
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.groundMap,
    bumpMap: textures.groundBump,
    bumpScale: 0.06,
    roughness: 0.9,
    metalness: 0.02,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  raycastTargets.push(ground);

  const addBoxObstacle = (
    x: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mesh: THREE.Object3D,
    baseY = 0,
  ) => {
    mesh.position.set(x, baseY, z);
    group.add(mesh);
    raycastTargets.push(mesh);
    colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      bottomY: baseY,
      topY: baseY + h,
    });
  };

  const addBarrel = (x: number, z: number) => {
    const mesh = createBarrelMesh();
    mesh.position.set(x, 0, z);
    group.add(mesh);
    raycastTargets.push(mesh);
    const colliderIdx = colliders.length;
    colliders.push({
      minX: x - 0.5,
      maxX: x + 0.5,
      minZ: z - 0.5,
      maxZ: z + 0.5,
      bottomY: 0,
      topY: 1.2,
    });
    const barrel: DestructibleBarrel = {
      id: barrelIdCounter++,
      mesh,
      x,
      y: 0,
      z,
      hp: 35,
      alive: true,
      colliderIdx,
    };
    mesh.traverse((child) => {
      child.userData.barrelId = barrel.id;
    });
    barrels.push(barrel);
  };

  const addRamp = (x: number, z: number, w: number, h: number, l: number, dir: RampSurface['dir']) => {
    const mesh = createRampMesh(w, h, l, mapId === 'desert' ? 0xd97706 : 0x64748b);
    mesh.position.set(x, 0, z);
    if (dir === 'south') mesh.rotation.y = Math.PI;
    else if (dir === 'east') mesh.rotation.y = -Math.PI / 2;
    else if (dir === 'west') mesh.rotation.y = Math.PI / 2;
    group.add(mesh);
    raycastTargets.push(mesh);
    const spanX = dir === 'east' || dir === 'west' ? l : w;
    const spanZ = dir === 'east' || dir === 'west' ? w : l;
    ramps.push({
      minX: x - spanX / 2,
      maxX: x + spanX / 2,
      minZ: z - spanZ / 2,
      maxZ: z + spanZ / 2,
      lowY: 0,
      highY: h,
      dir,
    });
  };

  // Perimeter low tactical boundary + natural outer hills/trees
  const perimeterMat = new THREE.MeshStandardMaterial({
    color: mapId === 'farm' ? 0x78350f : mapId === 'city' ? 0x334155 : 0x92400e,
    roughness: 0.85,
  });
  const borderWallGeoNS = new THREE.BoxGeometry(arenaRadius * 2 + 2, 1.5, 1.2);
  const borderWallGeoEW = new THREE.BoxGeometry(1.2, 1.5, arenaRadius * 2 + 2);
  const northFence = new THREE.Mesh(borderWallGeoNS, perimeterMat);
  northFence.position.set(0, 0.75, -arenaRadius);
  const southFence = new THREE.Mesh(borderWallGeoNS, perimeterMat);
  southFence.position.set(0, 0.75, arenaRadius);
  const westFence = new THREE.Mesh(borderWallGeoEW, perimeterMat);
  westFence.position.set(-arenaRadius, 0.75, 0);
  const eastFence = new THREE.Mesh(borderWallGeoEW, perimeterMat);
  eastFence.position.set(arenaRadius, 0.75, 0);
  group.add(northFence, southFence, westFence, eastFence);

  // Outer natural silhouette ring (hills / distant skyline / mesas) outside the fence
  const outerCount = 36;
  const hillGeo =
    mapId === 'city'
      ? new THREE.BoxGeometry(10, 24, 10)
      : new THREE.ConeGeometry(10, 16, 6);
  const hillMat = new THREE.MeshStandardMaterial({
    color: mapId === 'farm' ? 0x3f6212 : mapId === 'city' ? 0x1e293b : 0xb45309,
    roughness: 0.9,
  });
  const outerInstanced = new THREE.InstancedMesh(hillGeo, hillMat, outerCount);
  const dummy = new THREE.Object3D();
  const tintColor = new THREE.Color();
  for (let i = 0; i < outerCount; i++) {
    const a = (i / outerCount) * Math.PI * 2;
    const dist = arenaRadius + 16 + (i % 3) * 14;
    const scaleY = 0.75 + ((i * 37) % 10) * 0.12;
    dummy.position.set(Math.cos(a) * dist, (mapId === 'city' ? 12 : 7) * scaleY, Math.sin(a) * dist);
    dummy.rotation.y = a;
    dummy.scale.set(1 + (i % 2) * 0.35, scaleY, 1 + ((i + 1) % 2) * 0.35);
    dummy.updateMatrix();
    outerInstanced.setMatrixAt(i, dummy.matrix);
    tintColor.setHex(mapId === 'farm' ? 0x3f6212 : mapId === 'city' ? 0x334155 : 0xb45309);
    tintColor.offsetHSL(0, 0, ((i % 5) - 2) * 0.03);
    outerInstanced.setColorAt(i, tintColor);
  }
  outerInstanced.computeBoundingSphere();
  group.add(outerInstanced);

  // Map-Specific Hero Landmarks (positioned >= 16m away so spawn (0,0) faces an awesome open vista!)
  if (mapId === 'farm') {
    // Tall Iconic Red Barn facing spawn at (0, -28)
    const barn = new THREE.Group();
    const barnWallMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.78 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65, metalness: 0.25 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(12, 6.2, 10), barnWallMat);
    body.position.y = 3.1;
    body.castShadow = true;
    body.receiveShadow = true;

    const roof = new THREE.Mesh(new THREE.ConeGeometry(8.8, 4.4, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 8.4;
    roof.castShadow = true;

    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(4.2, 4.0, 0.3), trimMat);
    doorFrame.position.set(0, 2.0, 5.05);
    const doorInner = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.6, 0.35), barnWallMat);
    doorInner.position.set(0, 1.8, 5.08);
    const loftWindow = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.5, 0.3), trimMat);
    loftWindow.position.set(0, 5.0, 5.05);
    barn.add(body, roof, doorFrame, doorInner, loftWindow);
    addBoxObstacle(0, -29, 12, 10, 10, barn);

    // Tall Silver Grain Silo beside the barn
    const silo = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.32, metalness: 0.85 });
    const siloBody = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 11.5, 16), metalMat);
    siloBody.position.y = 5.75;
    siloBody.castShadow = true;
    const siloDome = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), metalMat);
    siloDome.position.y = 11.5;
    silo.add(siloBody, siloDome);
    addBoxObstacle(-9.5, -28, 5.2, 13, 5.2, silo);

    // Hay bale stacks & wooden watchtower
    const hayMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.92 });
    const hayPositions: [number, number][] = [
      [-14, -8],
      [15, -10],
      [-18, 16],
      [18, 14],
    ];
    for (const [hx, hz] of hayPositions) {
      const hay = new THREE.Group();
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.5, 1.8), hayMat);
      b1.position.y = 0.75;
      b1.castShadow = true;
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 1.7), hayMat);
      b2.position.set(0.2, 2.2, 0);
      b2.rotation.y = 0.15;
      hay.add(b1, b2);
      addBoxObstacle(hx, hz, 2.8, 3.0, 2.0, hay);
    }

    // Pine tree clusters (InstancedMesh)
    const treeCount = 24;
    const trunkGeo = new THREE.CylinderGeometry(0.32, 0.45, 2.4, 7);
    const leavesGeo = new THREE.ConeGeometry(2.1, 5.2, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85 });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const leaves = new THREE.InstancedMesh(leavesGeo, leafMat, treeCount);
    for (let i = 0; i < treeCount; i++) {
      const a = (i / treeCount) * Math.PI * 2;
      const r = 42 + (i % 3) * 5;
      const tx = Math.cos(a) * r;
      const tz = Math.sin(a) * r;
      const s = 0.85 + (i % 4) * 0.12;
      dummy.position.set(tx, 1.2 * s, tz);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      dummy.position.set(tx, 4.4 * s, tz);
      dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix);
      tintColor.setHex(0x15803d).offsetHSL(0, 0, ((i % 3) - 1) * 0.04);
      leaves.setColorAt(i, tintColor);
    }
    trunks.computeBoundingSphere();
    leaves.computeBoundingSphere();
    group.add(trunks, leaves);
  } else if (mapId === 'city') {
    // Tall Central Clock / Skyscraper Landmark at (0, -30)
    const tower = new THREE.Group();
    const bMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.concreteMap,
      roughness: 0.72,
      metalness: 0.12,
    });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.15, metalness: 0.8 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(10, 14, 10), bMat);
    base.position.y = 7;
    base.castShadow = true;
    const crown = new THREE.Mesh(new THREE.BoxGeometry(7.5, 4, 7.5), glassMat);
    crown.position.y = 16;
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.45, 5, 8), bMat);
    spire.position.y = 20.5;
    tower.add(base, crown, spire);
    addBoxObstacle(0, -30, 10, 18, 10, tower);

    // Corner apartment blocks
    const blocks: [number, number, number, number, number][] = [
      [-24, -18, 8, 9, 8],
      [24, -18, 8, 11, 8],
      [-24, 20, 8, 8, 8],
      [24, 20, 8, 10, 8],
    ];
    for (const [bx, bz, bw, bh, bd] of blocks) {
      const blk = new THREE.Group();
      const main = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), bMat);
      main.position.y = bh / 2;
      main.castShadow = true;
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(bw + 0.2, 0.8, bd + 0.2),
        new THREE.MeshStandardMaterial({ color: spec.accentColor, roughness: 0.4 }),
      );
      band.position.y = bh - 0.6;
      blk.add(main, band);
      addBoxObstacle(bx, bz, bw, bh, bd, blk);
    }
  } else {
    // Desert Base: Tall Radar Tower Landmark at (0, -28)
    const radarBase = new THREE.Group();
    const bunkerMat = new THREE.MeshStandardMaterial({
      color: 0xd6c7b2,
      map: textures.concreteMap,
      roughness: 0.85,
    });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.35, metalness: 0.8 });
    const bunker = new THREE.Mesh(new THREE.BoxGeometry(10, 5.5, 8), bunkerMat);
    bunker.position.y = 2.75;
    bunker.castShadow = true;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.8, 7.5, 8), steelMat);
    mast.position.y = 9.2;

    const dishGroup = new THREE.Group();
    dishGroup.position.y = 13.2;
    const dish = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.4, 12, 1, true), steelMat);
    dish.rotation.x = Math.PI / 2;
    dishGroup.add(dish);
    radarDish = dishGroup;

    radarBase.add(bunker, mast, dishGroup);
    addBoxObstacle(0, -28, 10, 13, 8, radarBase);

    // Sandstone mesas / shipping containers
    const containerMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.55, metalness: 0.45 });
    const containerCoords: [number, number, number][] = [
      [-18, -12, 0.2],
      [18, -14, -0.15],
      [-20, 16, 0],
      [20, 16, 0.3],
    ];
    for (const [cx, cz, ry] of containerCoords) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(6.5, 3.0, 2.8), containerMat);
      c.position.y = 1.5;
      c.rotation.y = ry;
      c.castShadow = true;
      addBoxObstacle(cx, cz, 6.2, 3.0, 3.0, c);
    }
  }

  // Tactical Crates, Ramps & Explosive Barrels across the mid-arena (leaving central 8m spawn clear!)
  const cratePositions: [number, number][] = [
    [-9, -9],
    [-10.9, -9],
    [9, -9],
    [9, -10.9],
    [-12, 7],
    [12, 7],
    [0, 18],
    [-2.0, 18],
    [-22, 0],
    [22, 0],
  ];
  for (const [cx, cz] of cratePositions) {
    const crate = createCrateMesh(textures, 1.85);
    addBoxObstacle(cx, cz, 1.85, 1.85, 1.85, crate);
  }

  // Elevated crate on top of a couple stacks
  const topCrate = createCrateMesh(textures, 1.85);
  addBoxObstacle(-9, -9, 1.85, 1.85, 1.85, topCrate, 1.85);

  // Jump / Elevation Ramps
  addRamp(-14, -18, 4.0, 2.2, 6.5, 'north');
  addRamp(14, -18, 4.0, 2.2, 6.5, 'north');
  addRamp(0, 24, 4.5, 2.0, 6.0, 'south');

  // Explosive Red TNT Barrels near cover
  const barrelSpots: [number, number][] = [
    [-6.5, -10],
    [6.8, -10],
    [-14, 9],
    [14, 9],
    [0, -17],
    [-18, -22],
    [18, -22],
  ];
  for (const [bx, bz] of barrelSpots) {
    addBarrel(bx, bz);
  }

  // Ground road/path marking strips (offset Y >= 0.02 to prevent Z-fighting)
  const pathMat = new THREE.MeshStandardMaterial({
    color: mapId === 'farm' ? 0x92704a : mapId === 'city' ? 0x1e293b : 0xa16207,
    roughness: 0.92,
  });
  const centralPath = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 42), pathMat);
  centralPath.rotation.x = -Math.PI / 2;
  centralPath.position.set(0, 0.025, -4);
  centralPath.receiveShadow = true;
  group.add(centralPath);

  // Keep subtle sky color reference
  void spec;

  return {
    group,
    colliders,
    ramps,
    barrels,
    raycastTargets,
    radarDish,
    arenaRadius,
  };
}
