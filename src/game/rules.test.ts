import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDamage,
  calculateKillReward,
  computeWaveConfig,
  purchaseCosmetic,
  resolveCircleAABB,
  stepEnemyPolicy,
} from './rules';
import { PlayerCustomization } from './types';

test('resolveCircleAABB slides actor smoothly out of obstacle', () => {
  const box = { minX: -2, maxX: 2, minZ: -2, maxZ: 2, topY: 3, bottomY: 0 };
  const pos = { x: 2.3, z: 0 };
  const hit = resolveCircleAABB(pos, 0.7, 0, 1.8, box);
  assert.equal(hit, true);
  assert.ok(pos.x >= 2.69, `Expected pos.x >= 2.7, got ${pos.x}`);
  assert.equal(pos.z, 0);

  // Above obstacle topY -> no collision
  const highPos = { x: 0, z: 0 };
  const hitAbove = resolveCircleAABB(highPos, 0.7, 3.0, 4.8, box);
  assert.equal(hitAbove, false);
});

test('computeWaveConfig scales enemy budget, speed, HP, and spawns boss every 3 waves', () => {
  const w1 = computeWaveConfig(1);
  const w3 = computeWaveConfig(3);
  const w6 = computeWaveConfig(6);

  assert.equal(w1.hasBoss, false);
  assert.equal(w1.weights.bomber, 0);
  assert.equal(w3.hasBoss, true);
  assert.equal(w6.hasBoss, true);
  assert.ok(w3.totalEnemies > w1.totalEnemies);
  assert.ok(w3.speedMultiplier > w1.speedMultiplier);
  assert.ok(w6.hpMultiplier > w3.hpMultiplier);
});

test('stepEnemyPolicy differentiates kiter, swarmer, and bomber behaviors with windup telegraphs', () => {
  // Kiter at close range backpedals and starts windup when holding token
  const kiterOut = stepEnemyPolicy(
    {
      archetype: 'kiter',
      dx: 6,
      dz: 0,
      dist: 6,
      baseSpeed: 5,
      strafeSign: 1,
      attackCooldown: 0,
      windupTimer: 0,
      hasAttackToken: true,
    },
    0.016,
  );
  assert.ok(kiterOut.moveX < 0, 'Kiter should backpedal when player is too close');
  assert.equal(kiterOut.shouldStartWindup, true);
  assert.ok(kiterOut.nextWindupTimer > 0.25);

  // Bomber triggers detonation windup near player and finishes after dt
  const bomberWindup = stepEnemyPolicy(
    {
      archetype: 'bomber',
      dx: 2.5,
      dz: 0,
      dist: 2.5,
      baseSpeed: 6,
      strafeSign: 1,
      attackCooldown: 0,
      windupTimer: 0,
      hasAttackToken: false,
    },
    0.016,
  );
  assert.equal(bomberWindup.shouldStartWindup, true);
  assert.equal(bomberWindup.shouldTriggerAttack, false);

  const bomberExplode = stepEnemyPolicy(
    {
      archetype: 'bomber',
      dx: 2.5,
      dz: 0,
      dist: 2.5,
      baseSpeed: 6,
      strafeSign: 1,
      attackCooldown: 0,
      windupTimer: 0.02,
      hasAttackToken: false,
    },
    0.05,
  );
  assert.equal(bomberExplode.shouldTriggerAttack, true);
});

test('calculateDamage and calculateKillReward handle crits, falloff, armor, and combo multipliers', () => {
  const closeBody = calculateDamage(100, 5, 50, false, 0);
  const closeHead = calculateDamage(100, 5, 50, true, 0);
  const farBody = calculateDamage(100, 50, 50, false, 0);
  const armored = calculateDamage(100, 5, 50, false, 0.5);

  assert.equal(closeBody, 100);
  assert.equal(closeHead, 155);
  assert.ok(farBody < closeBody);
  assert.equal(armored, 50);

  const r1 = calculateKillReward(100, 0, false);
  const r2 = calculateKillReward(100, r1.nextCombo, true);
  assert.equal(r1.points, 100);
  assert.equal(r2.nextCombo, 2);
  assert.ok(r2.points > 150);
  assert.ok(r2.coins > r1.coins);
});

test('purchaseCosmetic validates funds and equips unlocked cosmetics', () => {
  const base: PlayerCustomization = {
    skin: 'classic',
    hat: 'helmet',
    visor: 'none',
    unlockedSkins: ['classic'],
    unlockedHats: ['none', 'helmet'],
    unlockedVisors: ['none', 'shades'],
    unlockedWeapons: ['ak_galo', 'shotgun', 'bazooka', 'pan'],
  };

  const fail = purchaseCosmetic(base, 50, 'hat', 'crown', 180);
  assert.equal(fail.ok, false);
  assert.equal(fail.nextCoins, 50);

  const success = purchaseCosmetic(base, 250, 'hat', 'crown', 180);
  assert.equal(success.ok, true);
  assert.equal(success.nextCoins, 70);
  assert.equal(success.nextCustomization.hat, 'crown');
  assert.ok(success.nextCustomization.unlockedHats.includes('crown'));

  // Equipping already unlocked item costs 0
  const equipFree = purchaseCosmetic(success.nextCustomization, 70, 'hat', 'helmet', 0);
  assert.equal(equipFree.ok, true);
  assert.equal(equipFree.nextCoins, 70);
  assert.equal(equipFree.nextCustomization.hat, 'helmet');
});

import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  roomCodeToPeerId,
} from './rules';

test('room code generation, normalization, and validation work deterministically', () => {
  const code = generateRoomCode(5);
  assert.equal(code.length, 5);
  assert.equal(isValidRoomCode(code), true);

  assert.equal(normalizeRoomCode(' galo-k7m2p '), 'K7M2P');
  assert.equal(normalizeRoomCode('ab-12'), 'AB12');
  assert.equal(isValidRoomCode('12'), false);
  assert.equal(roomCodeToPeerId('galo-k7m2p'), 'galostrike-v1-K7M2P');
});

