export type GameScreenState = 'title' | 'playing' | 'paused' | 'gameover';

export type GameMode = 'survival' | 'sandbox';

export type OnlineRoomMode = 'pvp' | 'coop';

export type ArenaMapId = 'farm' | 'city' | 'desert';

export interface OnlinePeerPlayer {
  id: string;
  name: string;
  isHost: boolean;
  skin: ChickenSkinId;
  hat: HatId;
  visor: VisorId;
  weapon: WeaponId;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  kills: number;
}

export interface RoomSessionState {
  status: 'idle' | 'creating' | 'joining' | 'lobby' | 'playing' | 'error';
  role: 'none' | 'host' | 'guest';
  roomCode: string;
  localId: string;
  mapId: ArenaMapId;
  roomMode: OnlineRoomMode;
  players: OnlinePeerPlayer[];
  error: string | null;
}

export type WeaponId = 'ak_galo' | 'shotgun' | 'bazooka' | 'laser' | 'pan';

export type ChickenSkinId = 'classic' | 'gold' | 'ninja' | 'cyber' | 'crimson';

export type HatId = 'none' | 'helmet' | 'crown' | 'sombrero' | 'mohawk' | 'tophat';

export type VisorId = 'none' | 'shades' | 'tactical';

export type BuildPropType = 'crate' | 'ramp' | 'barrel' | 'turret';

export type EnemyArchetype = 'swarmer' | 'kiter' | 'bomber' | 'tank_boss';

export interface WeaponSpec {
  id: WeaponId;
  key: string;
  name: string;
  role: string;
  damage: number;
  fireInterval: number;
  range: number;
  pellets: number;
  spread: number;
  projectileSpeed: number;
  explosionRadius: number;
  knockback: number;
  magSize: number;
  reloadTime: number;
  unlockCost: number;
  isMelee?: boolean;
  isBeam?: boolean;
}

export interface CosmeticItem<T extends string> {
  id: T;
  name: string;
  cost: number;
  colorHex?: string;
}

export interface PlayerCustomization {
  skin: ChickenSkinId;
  hat: HatId;
  visor: VisorId;
  unlockedSkins: ChickenSkinId[];
  unlockedHats: HatId[];
  unlockedVisors: VisorId[];
  unlockedWeapons: WeaponId[];
}

export interface ArenaMapSpec {
  id: ArenaMapId;
  name: string;
  subtitle: string;
  skyTop: number;
  skyHorizon: number;
  fogColor: number;
  groundTint: number;
  accentColor: number;
}

export interface MinimapBlip {
  x: number;
  z: number;
  kind: 'enemy' | 'boss' | 'vehicle' | 'pickup' | 'turret' | 'remote';
}

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  jetpack: number;
  maxJetpack: number;
  score: number;
  bestScore: number;
  coins: number;
  kills: number;
  combo: number;
  comboTimer: number;
  wave: number;
  waveEnemiesRemaining: number;
  waveBanner: string | null;
  activeWeapon: WeaponId;
  ammo: Record<WeaponId, number>;
  reloadingWeapon: WeaponId | null;
  reloadProgress: number;
  grenadeCooldown: number;
  grenadeMaxCooldown: number;
  buildMode: boolean;
  selectedBuildProp: BuildPropType;
  inVehicle: boolean;
  nearVehicle: boolean;
  vehicleSpeed: number;
  firstPerson: boolean;
  pointerLocked: boolean;
  hitmarkerKind: 'none' | 'hit' | 'kill';
  bossName: string | null;
  bossHp: number;
  bossMaxHp: number;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  blips: MinimapBlip[];
  outcome: 'none' | 'victory' | 'defeat';
  elapsedSeconds: number;
  damageTaken: number;
}

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  ak_galo: {
    id: 'ak_galo',
    key: '1',
    name: 'AK-Galo 47',
    role: 'Assalto Rápido',
    damage: 24,
    fireInterval: 0.11,
    range: 75,
    pellets: 1,
    spread: 0.022,
    projectileSpeed: 95,
    explosionRadius: 0,
    knockback: 3.5,
    magSize: 30,
    reloadTime: 1.15,
    unlockCost: 0,
  },
  shotgun: {
    id: 'shotgun',
    key: '2',
    name: 'Escopeta Penosa',
    role: 'Impacto Curto',
    damage: 16,
    fireInterval: 0.58,
    range: 28,
    pellets: 6,
    spread: 0.11,
    projectileSpeed: 82,
    explosionRadius: 0,
    knockback: 11,
    magSize: 8,
    reloadTime: 1.3,
    unlockCost: 0,
  },
  bazooka: {
    id: 'bazooka',
    key: '3',
    name: 'Bazuca Ovo-Míssil',
    role: 'Explosão em Área',
    damage: 98,
    fireInterval: 0.95,
    range: 90,
    pellets: 1,
    spread: 0.006,
    projectileSpeed: 42,
    explosionRadius: 6.5,
    knockback: 18,
    magSize: 4,
    reloadTime: 1.6,
    unlockCost: 0,
  },
  laser: {
    id: 'laser',
    key: '4',
    name: 'Canhão Prisma',
    role: 'Feixe Instantâneo',
    damage: 46,
    fireInterval: 0.34,
    range: 95,
    pellets: 1,
    spread: 0.002,
    projectileSpeed: 180,
    explosionRadius: 0,
    knockback: 5,
    magSize: 16,
    reloadTime: 1.25,
    unlockCost: 150,
    isBeam: true,
  },
  pan: {
    id: 'pan',
    key: '5',
    name: 'Frigideira Dourada',
    role: 'Corpo-a-Corpo Brutal',
    damage: 85,
    fireInterval: 0.38,
    range: 4.2,
    pellets: 1,
    spread: 0,
    projectileSpeed: 0,
    explosionRadius: 0,
    knockback: 22,
    magSize: 999,
    reloadTime: 0,
    unlockCost: 0,
    isMelee: true,
  },
};

export const WEAPON_ORDER: WeaponId[] = ['ak_galo', 'shotgun', 'bazooka', 'laser', 'pan'];

export const SKINS: CosmeticItem<ChickenSkinId>[] = [
  { id: 'classic', name: 'Branco Fazenda', cost: 0, colorHex: '#f8fafc' },
  { id: 'gold', name: 'Ouro Real', cost: 120, colorHex: '#f59e0b' },
  { id: 'ninja', name: 'Sombra Ninja', cost: 100, colorHex: '#1e293b' },
  { id: 'cyber', name: 'Azul Cobalto', cost: 140, colorHex: '#0284c7' },
  { id: 'crimson', name: 'Fúria Rubra', cost: 160, colorHex: '#dc2626' },
];

export const HATS: CosmeticItem<HatId>[] = [
  { id: 'none', name: 'Sem Chapéu', cost: 0 },
  { id: 'helmet', name: 'Capacete Tático', cost: 0 },
  { id: 'crown', name: 'Coroa Dourada', cost: 180 },
  { id: 'sombrero', name: 'Sombrero Fiesta', cost: 90 },
  { id: 'mohawk', name: 'Moicano Punk', cost: 110 },
  { id: 'tophat', name: 'Cartola Elegante', cost: 130 },
];

export const VISORS: CosmeticItem<VisorId>[] = [
  { id: 'none', name: 'Olhar Puro', cost: 0 },
  { id: 'shades', name: 'Óculos Escuros', cost: 0 },
  { id: 'tactical', name: 'Visor Balístico', cost: 120 },
];

export const ARENA_MAPS: Record<ArenaMapId, ArenaMapSpec> = {
  farm: {
    id: 'farm',
    name: 'Fazenda Tática',
    subtitle: 'Celeiro e silos',
    skyTop: 0x3b82f6,
    skyHorizon: 0xdbeafe,
    fogColor: 0xcbe2f7,
    groundTint: 0x4d7c3f,
    accentColor: 0xb91c1c,
  },
  city: {
    id: 'city',
    name: 'Distrito Central',
    subtitle: 'Asfalto e prédios',
    skyTop: 0x1e40af,
    skyHorizon: 0xcbd5e1,
    fogColor: 0xbecad8,
    groundTint: 0x475569,
    accentColor: 0xeab308,
  },
  desert: {
    id: 'desert',
    name: 'Base Cânion',
    subtitle: 'Dunas e radar',
    skyTop: 0x0284c7,
    skyHorizon: 0xfde68a,
    fogColor: 0xf4d8a8,
    groundTint: 0xc2935b,
    accentColor: 0xd97706,
  },
};

export const BUILD_PROPS: { id: BuildPropType; name: string; cost: number; hint: string }[] = [
  { id: 'crate', name: 'Caixote', cost: 0, hint: 'Cobertura tática' },
  { id: 'ramp', name: 'Rampa', cost: 0, hint: 'Subida e saltos' },
  { id: 'barrel', name: 'Barril TNT', cost: 15, hint: 'Explode ao tiro' },
  { id: 'turret', name: 'Torreta Aliada', cost: 45, hint: 'Atira em inimigos' },
];
