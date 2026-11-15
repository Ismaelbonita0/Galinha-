import {
  ChickenSkinId,
  EnemyArchetype,
  HatId,
  PlayerCustomization,
  VisorId,
  WeaponId,
} from './types';

export interface AABB2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  topY: number;
  bottomY: number;
}

export interface CirclePos {
  x: number;
  z: number;
}

/**
 * Resolves circle vs AABB collisions in XZ plane when the actor vertically overlaps the box.
 */
export function resolveCircleAABB(
  pos: CirclePos,
  radius: number,
  actorMinY: number,
  actorMaxY: number,
  box: AABB2D,
): boolean {
  if (actorMaxY <= box.bottomY + 0.05 || actorMinY >= box.topY - 0.15) {
    return false;
  }

  const closestX = Math.max(box.minX, Math.min(pos.x, box.maxX));
  const closestZ = Math.max(box.minZ, Math.min(pos.z, box.maxZ));

  const dx = pos.x - closestX;
  const dz = pos.z - closestZ;
  const distSq = dx * dx + dz * dz;

  if (distSq >= radius * radius) {
    return false;
  }

  if (distSq > 1e-6) {
    const dist = Math.sqrt(distSq);
    const push = radius - dist;
    pos.x += (dx / dist) * push;
    pos.z += (dz / dist) * push;
  } else {
    // Center is inside the box; push out along shallowest axis
    const leftPen = pos.x - box.minX;
    const rightPen = box.maxX - pos.x;
    const topPen = pos.z - box.minZ;
    const bottomPen = box.maxZ - pos.z;
    const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);
    if (minPen === leftPen) pos.x = box.minX - radius;
    else if (minPen === rightPen) pos.x = box.maxX + radius;
    else if (minPen === topPen) pos.z = box.minZ - radius;
    else pos.z = box.maxZ + radius;
  }

  return true;
}

export interface WaveConfig {
  wave: number;
  totalEnemies: number;
  maxConcurrent: number;
  spawnInterval: number;
  speedMultiplier: number;
  hpMultiplier: number;
  hasBoss: boolean;
  weights: Record<EnemyArchetype, number>;
}

/**
 * Multi-knob difficulty ramp across waves:
 * Scales enemy budget, concurrent cap, speed/HP multipliers, and archetype mix.
 */
export function computeWaveConfig(wave: number): WaveConfig {
  const safeWave = Math.max(1, Math.floor(wave));
  const hasBoss = safeWave % 3 === 0;
  const totalEnemies = Math.min(34, 5 + safeWave * 3);
  const maxConcurrent = Math.min(12, 4 + Math.floor(safeWave * 1.1));
  const spawnInterval = Math.max(0.55, 1.75 - safeWave * 0.12);
  const speedMultiplier = Math.min(1.48, 1 + (safeWave - 1) * 0.06);
  const hpMultiplier = Math.min(2.4, 1 + (safeWave - 1) * 0.14);

  const weights: Record<EnemyArchetype, number> = {
    swarmer: safeWave === 1 ? 0.72 : Math.max(0.32, 0.65 - safeWave * 0.04),
    kiter: safeWave === 1 ? 0.28 : Math.min(0.4, 0.25 + safeWave * 0.025),
    bomber: safeWave >= 2 ? Math.min(0.28, 0.1 + (safeWave - 2) * 0.03) : 0,
    tank_boss: 0,
  };

  return {
    wave: safeWave,
    totalEnemies,
    maxConcurrent,
    spawnInterval,
    speedMultiplier,
    hpMultiplier,
    hasBoss,
    weights,
  };
}

export interface EnemyPolicyInput {
  archetype: EnemyArchetype;
  dx: number;
  dz: number;
  dist: number;
  baseSpeed: number;
  strafeSign: number;
  attackCooldown: number;
  windupTimer: number;
  hasAttackToken: boolean;
}

export interface EnemyPolicyOutput {
  moveX: number;
  moveZ: number;
  shouldStartWindup: boolean;
  shouldTriggerAttack: boolean;
  nextWindupTimer: number;
}

/**
 * Pure enemy movement & attack telegraph decision policy.
 * Guarantees >= 4 distinct behaviors:
 * - swarmer: closes directly and sprints when close, needs token to lunge
 * - kiter: maintains mid-range (11-17m), strafes laterally, fires ranged shot after windup
 * - bomber: sprints toward player, enters 0.65s glowing telegraph windup within 4.2m before exploding
 * - tank_boss: steady advance with heavy burst volley telegraph
 */
export function stepEnemyPolicy(
  input: EnemyPolicyInput,
  dt: number,
): EnemyPolicyOutput {
  const { archetype, dx, dz, dist, baseSpeed, strafeSign, attackCooldown, windupTimer, hasAttackToken } =
    input;
  const nx = dist > 1e-4 ? dx / dist : 0;
  const nz = dist > 1e-4 ? dz / dist : 1;
  // Perpendicular vector for strafing
  const px = -nz * strafeSign;
  const pz = nx * strafeSign;

  let moveX = 0;
  let moveZ = 0;
  let shouldStartWindup = false;
  let shouldTriggerAttack = false;
  let nextWindupTimer = windupTimer;

  if (windupTimer > 0) {
    nextWindupTimer = Math.max(0, windupTimer - dt);
    if (nextWindupTimer === 0) {
      shouldTriggerAttack = true;
    }
    // Bombers freeze/crouch during detonation telegraph; kiters slow down to aim
    const windupMoveFactor = archetype === 'bomber' ? 0.15 : archetype === 'kiter' ? 0.3 : 0.45;
    moveX = nx * baseSpeed * windupMoveFactor;
    moveZ = nz * baseSpeed * windupMoveFactor;
    return { moveX, moveZ, shouldStartWindup, shouldTriggerAttack, nextWindupTimer };
  }

  switch (archetype) {
    case 'swarmer': {
      const surge = dist < 8 ? 1.15 : 1.0;
      moveX = (nx * 0.92 + px * 0.24) * baseSpeed * surge;
      moveZ = (nz * 0.92 + pz * 0.24) * baseSpeed * surge;
      if (dist <= 2.35 && attackCooldown <= 0 && hasAttackToken) {
        shouldStartWindup = true;
        nextWindupTimer = 0.28;
      }
      break;
    }
    case 'kiter': {
      if (dist > 17) {
        moveX = (nx * 0.85 + px * 0.4) * baseSpeed;
        moveZ = (nz * 0.85 + pz * 0.4) * baseSpeed;
      } else if (dist < 10) {
        // Backpedal while strafing
        moveX = (-nx * 0.75 + px * 0.65) * baseSpeed;
        moveZ = (-nz * 0.75 + pz * 0.65) * baseSpeed;
      } else {
        // Pure lateral strafe at optimal combat band
        moveX = px * baseSpeed * 0.9;
        moveZ = pz * baseSpeed * 0.9;
      }
      if (dist <= 28 && attackCooldown <= 0 && hasAttackToken) {
        shouldStartWindup = true;
        nextWindupTimer = 0.42;
      }
      break;
    }
    case 'bomber': {
      moveX = nx * baseSpeed * 1.12;
      moveZ = nz * baseSpeed * 1.12;
      if (dist <= 4.0) {
        shouldStartWindup = true;
        nextWindupTimer = 0.65;
      }
      break;
    }
    case 'tank_boss': {
      const forwardBias = dist > 12 ? 0.9 : 0.35;
      moveX = (nx * forwardBias + px * 0.45) * baseSpeed;
      moveZ = (nz * forwardBias + pz * 0.45) * baseSpeed;
      if (dist <= 32 && attackCooldown <= 0 && hasAttackToken) {
        shouldStartWindup = true;
        nextWindupTimer = 0.55;
      }
      break;
    }
  }

  return { moveX, moveZ, shouldStartWindup, shouldTriggerAttack, nextWindupTimer };
}

export function calculateDamage(
  baseDamage: number,
  distance: number,
  maxRange: number,
  isHeadshot: boolean,
  armorRatio = 0,
): number {
  if (baseDamage <= 0) return 0;
  const clampedDist = Math.max(0, distance);
  const falloffStart = maxRange * 0.5;
  let falloff = 1;
  if (clampedDist > falloffStart && maxRange > falloffStart) {
    const t = Math.min(1, (clampedDist - falloffStart) / (maxRange - falloffStart));
    falloff = 1 - t * 0.42;
  }
  const critMult = isHeadshot ? 1.55 : 1.0;
  const armorMult = 1 - Math.max(0, Math.min(0.65, armorRatio));
  return Math.max(1, Math.round(baseDamage * falloff * critMult * armorMult));
}

export function calculateKillReward(
  basePoints: number,
  combo: number,
  isHeadshot: boolean,
): { points: number; coins: number; nextCombo: number } {
  const nextCombo = Math.min(12, Math.max(1, combo + 1));
  const multiplier = 1 + (nextCombo - 1) * 0.25;
  const headshotBonus = isHeadshot ? 1.25 : 1.0;
  const points = Math.round(basePoints * multiplier * headshotBonus);
  const coins = Math.max(5, Math.round(basePoints * 0.14 + (isHeadshot ? 4 : 0)));
  return { points, coins, nextCombo };
}

export function purchaseCosmetic(
  customization: PlayerCustomization,
  coins: number,
  category: 'skin' | 'hat' | 'visor' | 'weapon',
  itemId: string,
  cost: number,
): { ok: boolean; nextCoins: number; nextCustomization: PlayerCustomization } {
  const alreadyUnlocked =
    (category === 'skin' && customization.unlockedSkins.includes(itemId as ChickenSkinId)) ||
    (category === 'hat' && customization.unlockedHats.includes(itemId as HatId)) ||
    (category === 'visor' && customization.unlockedVisors.includes(itemId as VisorId)) ||
    (category === 'weapon' && customization.unlockedWeapons.includes(itemId as WeaponId));

  if (alreadyUnlocked) {
    const nextCustomization = { ...customization };
    if (category === 'skin') nextCustomization.skin = itemId as ChickenSkinId;
    if (category === 'hat') nextCustomization.hat = itemId as HatId;
    if (category === 'visor') nextCustomization.visor = itemId as VisorId;
    return { ok: true, nextCoins: coins, nextCustomization };
  }

  if (coins < cost) {
    return { ok: false, nextCoins: coins, nextCustomization: customization };
  }

  const nextCustomization: PlayerCustomization = {
    ...customization,
    unlockedSkins: [...customization.unlockedSkins],
    unlockedHats: [...customization.unlockedHats],
    unlockedVisors: [...customization.unlockedVisors],
    unlockedWeapons: [...customization.unlockedWeapons],
  };

  if (category === 'skin') {
    nextCustomization.unlockedSkins.push(itemId as ChickenSkinId);
    nextCustomization.skin = itemId as ChickenSkinId;
  } else if (category === 'hat') {
    nextCustomization.unlockedHats.push(itemId as HatId);
    nextCustomization.hat = itemId as HatId;
  } else if (category === 'visor') {
    nextCustomization.unlockedVisors.push(itemId as VisorId);
    nextCustomization.visor = itemId as VisorId;
  } else if (category === 'weapon') {
    nextCustomization.unlockedWeapons.push(itemId as WeaponId);
  }

  return {
    ok: true,
    nextCoins: coins - cost,
    nextCustomization,
  };
}

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(length = 5): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
  }
  return code;
}

export function normalizeRoomCode(raw: string): string {
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/^GALO[-_\s]*/i, '')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  return cleaned;
}

export function isValidRoomCode(raw: string): boolean {
  const code = normalizeRoomCode(raw);
  return code.length >= 4 && code.length <= 8;
}

export function roomCodeToPeerId(rawCode: string): string {
  return `galostrike-v1-${normalizeRoomCode(rawCode)}`;
}

