import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { gameAudio } from './audio';
import {
  BuggyRig,
  ChickenRig,
  createBuggyModel,
  createChickenModel,
  createTurretModel,
  createWeaponMesh,
} from './models';
import {
  AABB2D,
  calculateDamage,
  calculateKillReward,
  computeWaveConfig,
  resolveCircleAABB,
  stepEnemyPolicy,
} from './rules';
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import { RemoteFireEvent } from './network';
import {
  ARENA_MAPS,
  ArenaMapId,
  BUILD_PROPS,
  BuildPropType,
  ChickenSkinId,
  EnemyArchetype,
  GameMode,
  GameScreenState,
  HatId,
  HudSnapshot,
  MinimapBlip,
  OnlinePeerPlayer,
  OnlineRoomMode,
  PlayerCustomization,
  VisorId,
  WEAPON_ORDER,
  WEAPONS,
  WeaponId,
} from './types';
import {
  BuiltWorld,
  buildArenaWorld,
  createBarrelMesh,
  createCrateMesh,
  createRampMesh,
} from './worldBuilder';

// Module-scoped zero-GC scratch objects
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  gravity: number;
  rotSpeed: number;
  color: number;
}

interface Projectile {
  fromPlayer: boolean;
  kind: 'bullet' | 'rocket' | 'egg_grenade' | 'enemy_bolt';
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
  explosionRadius: number;
  knockback: number;
  life: number;
  weaponId: WeaponId;
}

interface EnemyActor {
  id: number;
  archetype: EnemyArchetype;
  rig: ChickenRig;
  shadow: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  armor: number;
  points: number;
  strafeSign: number;
  attackCooldown: number;
  windupTimer: number;
  hitFlashTimer: number;
  koTimer: number;
  koSpinDir: number;
  walkPhase: number;
  hasTelegraphed: boolean;
}

interface PickupItem {
  kind: 'medkit' | 'ammo' | 'coin';
  mesh: THREE.Group;
  shadow: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  life: number;
}

interface PlacedTurret {
  root: THREE.Group;
  head: THREE.Group;
  x: number;
  y: number;
  z: number;
  cooldown: number;
}

interface BeamEffect {
  mesh: THREE.Mesh;
  life: number;
}

interface ShockwaveEffect {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  maxRadius: number;
}

interface RemoteChickenActor {
  id: string;
  name: string;
  rig: ChickenRig;
  shadow: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  yaw: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  targetYaw: number;
  hp: number;
  skin: ChickenSkinId;
  hat: HatId;
  visor: VisorId;
  weapon: WeaponId;
  hitFlashTimer: number;
  walkPhase: number;
}

export interface EngineCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onGameOver: (snapshot: HudSnapshot) => void;
  onStateChange: (state: GameScreenState) => void;
  onSpendCoins: (amount: number) => boolean;
  onEarnCoins: (amount: number) => void;
  onNetworkSync?: (state: Omit<OnlinePeerPlayer, 'id' | 'name' | 'isHost'>) => void;
  onNetworkFire?: (ev: Omit<RemoteFireEvent, 'senderId'>) => void;
  onNetworkHit?: (targetId: string, damage: number) => void;
}

export class GaloStrikeEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private resizeObserver: ResizeObserver;

  private textures: ProceduralTextureSet | null = null;
  private world: BuiltWorld | null = null;
  private skyMesh: THREE.Mesh | null = null;
  private keyLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;

  // Player state
  private playerRig: ChickenRig | null = null;
  private playerShadow: THREE.Mesh;
  private playerX = 0;
  private playerY = 0;
  private playerZ = 0;
  private playerVx = 0;
  private playerVy = 0;
  private playerVz = 0;
  private playerYaw = 0;
  private playerPitch = -0.08;
  private playerOnGround = true;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private walkPhase = 0;
  private squashX = 1;
  private squashY = 1;
  private hp = 100;
  private maxHp = 100;
  private jetpack = 100;
  private maxJetpack = 100;
  private damageTaken = 0;

  // Vehicle
  private buggy: BuggyRig | null = null;
  private buggyX = -10;
  private buggyZ = 12;
  private buggyYaw = 0.4;
  private buggySpeed = 0;
  private inVehicle = false;

  // Combat & inventory
  private customization: PlayerCustomization;
  private activeWeapon: WeaponId = 'ak_galo';
  private ammo: Record<WeaponId, number> = {
    ak_galo: WEAPONS.ak_galo.magSize,
    shotgun: WEAPONS.shotgun.magSize,
    bazooka: WEAPONS.bazooka.magSize,
    laser: WEAPONS.laser.magSize,
    pan: WEAPONS.pan.magSize,
  };
  private fireCooldown = 0;
  private reloadingWeapon: WeaponId | null = null;
  private reloadTimer = 0;
  private grenadeCooldown = 0;
  private readonly grenadeMaxCooldown = 4.5;
  private buildMode = false;
  private selectedBuildProp: BuildPropType = 'crate';
  private firstPerson = false;
  private recoilOffset = 0;
  private panSwingTimer = 0;
  private hitmarkerKind: 'none' | 'hit' | 'kill' = 'none';
  private hitmarkerTimer = 0;

  // Camera & Juice
  private camPos = new THREE.Vector3(0, 3.2, 16);
  private camLook = new THREE.Vector3(0, 1.2, 0);
  private trauma = 0;
  private hitstopTimer = 0;
  private fovKick = 0;
  private cursorNormX = 0;
  private cursorNormY = 0;
  private titleOrbitAngle = 0;

  // Mode, waves & progression
  private screenState: GameScreenState = 'title';
  private gameMode: GameMode = 'survival';
  private mapId: ArenaMapId = 'farm';
  private score = 0;
  private bestScore = 0;
  private coins = 0;
  private kills = 0;
  private combo = 0;
  private comboTimer = 0;
  private elapsedSeconds = 0;
  private wave = 1;
  private waveRemainingToSpawn = 0;
  private waveSpawnTimer = 0;
  private waveBanner: string | null = null;
  private waveBannerTimer = 0;
  private waveClearDelay = 0;
  private outcome: 'none' | 'victory' | 'defeat' = 'none';
  private nextEnemyId = 1;

  // Entities & Pools
  private enemies: EnemyActor[] = [];
  private projectiles: Projectile[] = [];
  private pickups: PickupItem[] = [];
  private turrets: PlacedTurret[] = [];
  private beams: BeamEffect[] = [];
  private shockwaves: ShockwaveEffect[] = [];
  private buildGhost: THREE.Mesh | null = null;

  private readonly particleCapacity = 240;
  private particles: ParticleSlot[] = [];
  private particleCursor = 0;
  private particleInstanced: THREE.InstancedMesh;

  // Input state
  private keysHeld = new Set<string>();
  private keysJustPressed = new Set<string>();
  private mouseDown = false;
  private mouseJustPressed = false;
  private pointerLocked = false;
  private isDraggingLook = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // Touch input state
  private touchMoveX = 0;
  private touchMoveY = 0;
  private touchFireActive = false;
  private touchFireJustPressed = false;
  private touchJumpHeld = false;
  private touchJumpJustPressed = false;

  // Online multiplayer state
  private onlineRoomMode: OnlineRoomMode | null = null;
  private remotePlayers = new Map<string, RemoteChickenActor>();
  private netSyncTimer = 0;

  // Loop & throttling
  private frameId = 0;
  private lastTime = performance.now();
  private hudSyncTimer = 0;
  private disposed = false;
  private raycaster = new THREE.Raycaster();

  // Shared geometries
  private bulletGeo = new THREE.SphereGeometry(0.11, 6, 6);
  private rocketGeo = new THREE.SphereGeometry(0.18, 8, 8);
  private eggGeo = new THREE.SphereGeometry(0.22, 10, 10);
  private shadowGeo = new THREE.CircleGeometry(0.75, 16);

  constructor(
    container: HTMLElement,
    initialCustomization: PlayerCustomization,
    initialCoins: number,
    initialBestScore: number,
    callbacks: EngineCallbacks,
  ) {
    this.container = container;
    this.customization = initialCustomization;
    this.coins = initialCoins;
    this.bestScore = initialBestScore;
    this.callbacks = callbacks;

    // 1. Software WebGL probe
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: this.isSoftwareGl,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    this.renderer.setSize(w, h);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    // 3. Scene, Camera & Studio RoomEnvironment
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(65, w / h, 0.1, 300);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // 4. Warm/Cool 3-point outdoor lighting rig
    this.hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x78553a, 0.85);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff1d6, 1.85);
    this.keyLight.position.set(28, 44, 26);
    if (!this.isSoftwareGl) {
      this.keyLight.castShadow = true;
      this.keyLight.shadow.mapSize.set(1024, 1024);
      const d = 48;
      this.keyLight.shadow.camera.left = -d;
      this.keyLight.shadow.camera.right = d;
      this.keyLight.shadow.camera.top = d;
      this.keyLight.shadow.camera.bottom = -d;
      this.keyLight.shadow.camera.near = 2;
      this.keyLight.shadow.camera.far = 120;
      this.keyLight.shadow.bias = -0.0005;
      this.keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(this.keyLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.45);
    rimLight.position.set(-25, 18, -30);
    this.scene.add(rimLight);

    // 5. Particle Ring Buffer (InstancedMesh)
    const pGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleInstanced = new THREE.InstancedMesh(pGeo, pMat, this.particleCapacity);
    this.particleInstanced.frustumCulled = false;
    for (let i = 0; i < this.particleCapacity; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 0.1,
        gravity: 12,
        rotSpeed: 4,
        color: 0xffffff,
      });
      _mat4.makeScale(0, 0, 0);
      this.particleInstanced.setMatrixAt(i, _mat4);
      this.particleInstanced.setColorAt(i, _color.setHex(0xffffff));
    }
    this.particleInstanced.instanceMatrix.needsUpdate = true;
    this.scene.add(this.particleInstanced);

    // 6. Player contact shadow placeholder
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    this.playerShadow = new THREE.Mesh(this.shadowGeo, shadowMat);
    this.playerShadow.rotation.x = -Math.PI / 2;
    this.playerShadow.position.y = 0.015;
    this.scene.add(this.playerShadow);

    // 7. Build initial map & showcase chicken
    this.loadMap(this.mapId);
    this.rebuildPlayerModel();
    this.camera.position.set(0.25, 1.48, 3.5);
    this.camera.lookAt(-0.9, 1.0, 0);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // 8. Listeners & ResizeObserver
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
    this.bindEvents();

    // 9. Initial draw + start loop
    this.renderer.render(this.scene, this.camera);
    this.lastTime = performance.now();
    this.scheduleNextTick(false);
    this.emitHudSnapshot();
  }

  private scheduleNextTick(immediate = false) {
    if (this.disposed) return;
    if (immediate) {
      this.frameId = requestAnimationFrame(this.tick);
      return;
    }
    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick(performance.now()));
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private handleResize() {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.render(this.scene, this.camera);
  }

  private bindEvents() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);

    const dom = this.renderer.domElement;
    dom.addEventListener('mousedown', this.onCanvasMouseDown);
    window.addEventListener('mouseup', this.onWindowMouseUp);
    window.addEventListener('mousemove', this.onWindowMouseMove);
    dom.addEventListener('contextmenu', this.onContextMenu);
  }

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private onWindowBlur = () => {
    this.keysHeld.clear();
    this.mouseDown = false;
    this.isDraggingLook = false;
  };

  private onVisibilityChange = () => {
    if (document.hidden) {
      this.keysHeld.clear();
      this.mouseDown = false;
      this.isDraggingLook = false;
    }
  };

  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.emitHudSnapshot();
  };

  private onCanvasMouseDown = (e: MouseEvent) => {
    gameAudio.unlock();
    if (this.screenState !== 'playing') return;
    if (e.button === 0) {
      this.mouseDown = true;
      this.mouseJustPressed = true;
      if (!this.pointerLocked && !this.isSoftwareGl && document.pointerLockElement !== this.renderer.domElement) {
        try {
          this.renderer.domElement.requestPointerLock?.();
        } catch {
          // Ignore in restricted environments
        }
      }
    } else if (e.button === 2) {
      this.isDraggingLook = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    }
  };

  private onWindowMouseUp = () => {
    this.mouseDown = false;
    this.isDraggingLook = false;
  };

  private onWindowMouseMove = (e: MouseEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.cursorNormX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.cursorNormY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    }

    if (this.screenState !== 'playing') return;

    if (this.pointerLocked) {
      this.playerYaw -= e.movementX * 0.0024;
      this.playerPitch = THREE.MathUtils.clamp(this.playerPitch - e.movementY * 0.002, -0.75, 0.72);
    } else if (this.isDraggingLook) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.playerYaw -= dx * 0.005;
      this.playerPitch = THREE.MathUtils.clamp(this.playerPitch - dy * 0.004, -0.75, 0.72);
    }
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const code = e.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
      if (this.screenState === 'playing') e.preventDefault();
    }
    if (!this.keysHeld.has(code)) {
      this.keysJustPressed.add(code);
    }
    this.keysHeld.add(code);

    if (this.screenState === 'playing') {
      if (code === 'Escape' || code === 'KeyP') {
        this.setPaused(true);
        return;
      }
      if (code === 'Digit1') this.selectWeapon('ak_galo');
      if (code === 'Digit2') this.selectWeapon('shotgun');
      if (code === 'Digit3') this.selectWeapon('bazooka');
      if (code === 'Digit4') this.selectWeapon('laser');
      if (code === 'Digit5') this.selectWeapon('pan');
      if (code === 'KeyR') this.startReload();
      if (code === 'KeyG') this.throwEggGrenade();
      if (code === 'KeyB') this.toggleBuildMode();
      if (code === 'KeyQ' && this.buildMode) this.cycleBuildProp();
      if (code === 'KeyE') this.toggleVehicle();
      if (code === 'KeyV') {
        this.firstPerson = !this.firstPerson;
        if (this.playerRig) {
          this.playerRig.headGroup.visible = !this.firstPerson;
        }
        this.emitHudSnapshot();
      }
    } else if (this.screenState === 'paused') {
      if (code === 'Escape' || code === 'KeyP') {
        this.setPaused(false);
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysHeld.delete(e.code);
    // Variable jump cut when Space released early while ascending
    if (e.code === 'Space' && this.screenState === 'playing' && this.playerVy > 3.5 && !this.inVehicle) {
      this.playerVy *= 0.45;
    }
  };

  public setMap(mapId: ArenaMapId) {
    if (this.mapId === mapId && this.world) return;
    this.mapId = mapId;
    this.loadMap(mapId);
  }

  public setMode(mode: GameMode) {
    this.gameMode = mode;
  }

  public setCustomization(customization: PlayerCustomization, coins: number) {
    this.customization = customization;
    this.coins = coins;
    this.rebuildPlayerModel();
    this.emitHudSnapshot();
  }

  public selectWeapon(weaponId: WeaponId) {
    if (!this.customization.unlockedWeapons.includes(weaponId)) return;
    if (this.activeWeapon === weaponId) return;
    this.activeWeapon = weaponId;
    this.reloadingWeapon = null;
    this.reloadTimer = 0;
    this.buildMode = false;
    this.updateBuildGhostVisibility();
    this.playerRig?.setWeapon(weaponId);
    this.emitHudSnapshot();
  }

  public toggleBuildMode() {
    this.buildMode = !this.buildMode;
    this.updateBuildGhostVisibility();
    this.emitHudSnapshot();
  }

  public cycleBuildProp(prop?: BuildPropType) {
    if (prop) {
      this.selectedBuildProp = prop;
    } else {
      const idx = BUILD_PROPS.findIndex((p) => p.id === this.selectedBuildProp);
      this.selectedBuildProp = BUILD_PROPS[(idx + 1) % BUILD_PROPS.length].id;
    }
    this.rebuildBuildGhost();
    this.emitHudSnapshot();
  }

  public setMuted(muted: boolean) {
    gameAudio.setMuted(muted);
  }

  public setTouchMove(x: number, y: number) {
    this.touchMoveX = THREE.MathUtils.clamp(x, -1, 1);
    this.touchMoveY = THREE.MathUtils.clamp(y, -1, 1);
  }

  public addTouchAimDelta(dx: number, dy: number) {
    if (this.screenState !== 'playing') return;
    this.playerYaw -= dx * 0.0055;
    this.playerPitch = THREE.MathUtils.clamp(this.playerPitch - dy * 0.0045, -0.75, 0.72);
  }

  public setTouchFire(active: boolean) {
    if (active && !this.touchFireActive) {
      this.touchFireJustPressed = true;
      gameAudio.unlock();
    }
    this.touchFireActive = active;
  }

  public setTouchJump(active: boolean) {
    if (active && !this.touchJumpHeld) {
      this.touchJumpJustPressed = true;
      gameAudio.unlock();
    }
    if (!active && this.touchJumpHeld && this.screenState === 'playing' && this.playerVy > 3.5 && !this.inVehicle) {
      this.playerVy *= 0.45;
    }
    this.touchJumpHeld = active;
  }

  public triggerGrenade() {
    if (this.screenState === 'playing') this.throwEggGrenade();
  }

  public triggerVehicleToggle() {
    if (this.screenState === 'playing') this.toggleVehicle();
  }

  public triggerReload() {
    if (this.screenState === 'playing') this.startReload();
  }

  public toggleFirstPerson() {
    this.firstPerson = !this.firstPerson;
    if (this.playerRig) {
      this.playerRig.headGroup.visible = !this.firstPerson;
    }
    this.emitHudSnapshot();
  }

  public syncRemotePlayers(players: OnlinePeerPlayer[]) {
    if (!this.textures) return;
    const activeIds = new Set(players.map((p) => p.id));

    for (const [id, actor] of this.remotePlayers.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(actor.rig.root);
        this.scene.remove(actor.shadow);
        this.remotePlayers.delete(id);
      }
    }

    for (const p of players) {
      const existing = this.remotePlayers.get(p.id);
      if (
        existing &&
        existing.skin === p.skin &&
        existing.hat === p.hat &&
        existing.visor === p.visor
      ) {
        existing.targetX = p.x;
        existing.targetY = p.y;
        existing.targetZ = p.z;
        existing.targetYaw = p.yaw;
        existing.hp = p.hp;
        if (existing.weapon !== p.weapon) {
          existing.weapon = p.weapon;
          existing.rig.setWeapon(p.weapon);
        }
        existing.rig.root.visible = p.hp > 0;
        existing.shadow.visible = p.hp > 0;
      } else {
        if (existing) {
          this.scene.remove(existing.rig.root);
          this.scene.remove(existing.shadow);
        }
        const rig = createChickenModel({
          skin: p.skin,
          hat: p.hat,
          visor: p.visor,
          scale: 1,
          withJetpack: true,
        });
        rig.setWeapon(p.weapon);
        rig.root.position.set(p.x, p.y, p.z);
        rig.root.rotation.y = p.yaw + Math.PI;
        rig.root.visible = p.hp > 0;
        this.scene.add(rig.root);

        const shadow = new THREE.Mesh(
          this.shadowGeo,
          new THREE.MeshBasicMaterial({
            map: this.textures.contactShadowMap,
            transparent: true,
            opacity: 0.45,
            depthWrite: false,
          }),
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.set(p.x, 0.015, p.z);
        shadow.visible = p.hp > 0;
        this.scene.add(shadow);

        this.remotePlayers.set(p.id, {
          id: p.id,
          name: p.name,
          rig,
          shadow,
          x: p.x,
          y: p.y,
          z: p.z,
          yaw: p.yaw,
          targetX: p.x,
          targetY: p.y,
          targetZ: p.z,
          targetYaw: p.yaw,
          hp: p.hp,
          skin: p.skin,
          hat: p.hat,
          visor: p.visor,
          weapon: p.weapon,
          hitFlashTimer: 0,
          walkPhase: 0,
        });
      }
    }
  }

  public spawnRemoteFire(ev: RemoteFireEvent) {
    if (this.screenState !== 'playing') return;
    const spec = WEAPONS[ev.weaponId] ?? WEAPONS.ak_galo;
    if (spec.isMelee) return;

    if (spec.isBeam) {
      const endX = ev.x + ev.dx * spec.range;
      const endY = ev.y + ev.dy * spec.range;
      const endZ = ev.z + ev.dz * spec.range;
      const beamGeo = new THREE.CylinderGeometry(0.08, 0.08, spec.range, 6);
      beamGeo.rotateX(Math.PI / 2);
      const beamMesh = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
      beamMesh.position.set((ev.x + endX) / 2, (ev.y + endY) / 2, (ev.z + endZ) / 2);
      beamMesh.lookAt(endX, endY, endZ);
      this.scene.add(beamMesh);
      this.beams.push({ mesh: beamMesh, life: 0.14 });
      return;
    }

    const isRocket = spec.id === 'bazooka';
    const mesh = new THREE.Mesh(
      isRocket ? this.rocketGeo : this.bulletGeo,
      new THREE.MeshBasicMaterial({ color: isRocket ? 0xfef3c7 : 0x38bdf8 }),
    );
    mesh.position.set(ev.x, ev.y, ev.z);
    this.scene.add(mesh);

    this.projectiles.push({
      fromPlayer: false,
      kind: isRocket ? 'rocket' : 'bullet',
      mesh,
      x: ev.x,
      y: ev.y,
      z: ev.z,
      vx: ev.dx * spec.projectileSpeed,
      vy: ev.dy * spec.projectileSpeed,
      vz: ev.dz * spec.projectileSpeed,
      damage: 0, // Damage is validated by attacker hit_event
      explosionRadius: 0,
      knockback: 0,
      life: spec.range / Math.max(1, spec.projectileSpeed),
      weaponId: spec.id,
    });
  }

  public applyRemoteDamage(damage: number) {
    if (this.screenState !== 'playing' || this.onlineRoomMode !== 'pvp') return;
    this.damagePlayer(damage);
  }

  private loadMap(mapId: ArenaMapId) {
    if (this.world) {
      this.scene.remove(this.world.group);
    }
    if (this.textures) {
      this.textures.dispose();
    }
    if (this.skyMesh) {
      this.scene.remove(this.skyMesh);
    }

    const spec = ARENA_MAPS[mapId];
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(mapId, maxAniso);

    // Update contact shadow texture
    (this.playerShadow.material as THREE.MeshBasicMaterial).map = this.textures.contactShadowMap;
    (this.playerShadow.material as THREE.MeshBasicMaterial).needsUpdate = true;

    // Sky dome gradient matching fogColor at horizon
    const skyGeo = new THREE.SphereGeometry(220, 20, 14);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(spec.skyTop) },
        bottomColor: { value: new THREE.Color(spec.skyHorizon) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPos;
        void main() {
          float h = clamp(normalize(vWorldPos).y * 1.45, 0.0, 1.0);
          gl_FragColor = vec4(mix(bottomColor, topColor, pow(h, 0.72)), 1.0);
        }
      `,
    });
    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyMesh);

    this.scene.background = new THREE.Color(spec.fogColor);
    this.scene.fog = new THREE.FogExp2(spec.fogColor, 0.0085);

    this.world = buildArenaWorld(mapId, this.textures);
    this.scene.add(this.world.group);

    // Ensure Buggy sits in open arena
    if (this.buggy) {
      this.scene.remove(this.buggy.root);
    }
    this.buggy = createBuggyModel();
    this.buggyX = -9.5;
    this.buggyZ = 8.5;
    this.buggyYaw = 0.35;
    this.buggy.root.position.set(this.buggyX, 0, this.buggyZ);
    this.buggy.root.rotation.y = this.buggyYaw;
    this.scene.add(this.buggy.root);

    this.rebuildBuildGhost();
  }

  private rebuildPlayerModel() {
    if (this.playerRig) {
      this.scene.remove(this.playerRig.root);
    }
    this.playerRig = createChickenModel({
      skin: this.customization.skin,
      hat: this.customization.hat,
      visor: this.customization.visor,
      scale: 1,
      withJetpack: true,
    });
    this.playerRig.setWeapon(this.activeWeapon);
    this.playerRig.root.position.set(this.playerX, this.playerY, this.playerZ);
    this.playerRig.headGroup.visible = !this.firstPerson;
    this.scene.add(this.playerRig.root);
  }

  private rebuildBuildGhost() {
    if (!this.textures) return;
    if (this.buildGhost) {
      this.scene.remove(this.buildGhost);
    }
    const ghostMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.42,
      wireframe: false,
    });
    let geo: THREE.BufferGeometry;
    if (this.selectedBuildProp === 'crate') geo = new THREE.BoxGeometry(1.85, 1.85, 1.85);
    else if (this.selectedBuildProp === 'ramp') geo = new THREE.BoxGeometry(3.4, 1.4, 4.5);
    else if (this.selectedBuildProp === 'barrel') geo = new THREE.CylinderGeometry(0.45, 0.45, 1.15, 10);
    else geo = new THREE.CylinderGeometry(0.55, 0.55, 1.2, 8);

    this.buildGhost = new THREE.Mesh(geo, ghostMat);
    this.buildGhost.visible = this.buildMode && this.screenState === 'playing';
    this.scene.add(this.buildGhost);
  }

  private updateBuildGhostVisibility() {
    if (this.buildGhost) {
      this.buildGhost.visible = this.buildMode && this.screenState === 'playing';
    }
  }

  public startGame(
    mode?: GameMode,
    mapId?: ArenaMapId,
    onlineMode: OnlineRoomMode | null = null,
    spawnIndex = 0,
  ) {
    gameAudio.unlock();
    if (mode) this.gameMode = mode;
    if (mapId) this.setMap(mapId);
    this.onlineRoomMode = onlineMode;

    this.clearDynamicEntities();
    this.loadMap(this.mapId);

    this.screenState = 'playing';
    this.outcome = 'none';
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.elapsedSeconds = 0;
    this.damageTaken = 0;

    this.hp = this.maxHp;
    this.jetpack = this.maxJetpack;
    if (onlineMode && spawnIndex > 0) {
      const ang = spawnIndex * 2.1;
      this.playerX = Math.sin(ang) * 14;
      this.playerZ = Math.cos(ang) * 14;
      this.playerYaw = ang;
    } else {
      this.playerX = 0;
      this.playerZ = 10;
      this.playerYaw = 0; // faces -Z toward tall landmark!
    }
    this.playerY = 0;
    this.playerVx = 0;
    this.playerVy = 0;
    this.playerVz = 0;
    this.playerPitch = -0.05;
    this.playerOnGround = true;
    this.inVehicle = false;
    this.buggySpeed = 0;
    this.buildMode = false;
    this.updateBuildGhostVisibility();

    if (!this.customization.unlockedWeapons.includes(this.activeWeapon)) {
      this.activeWeapon = 'ak_galo';
    }
    for (const w of WEAPON_ORDER) {
      this.ammo[w] = WEAPONS[w].magSize;
    }
    this.reloadingWeapon = null;
    this.reloadTimer = 0;
    this.grenadeCooldown = 0;
    this.keysHeld.clear();
    this.keysJustPressed.clear();
    this.mouseDown = false;
    this.mouseJustPressed = false;
    this.touchMoveX = 0;
    this.touchMoveY = 0;
    this.touchFireActive = false;
    this.touchFireJustPressed = false;
    this.touchJumpHeld = false;
    this.touchJumpJustPressed = false;
    this.netSyncTimer = 0;

    this.rebuildPlayerModel();
    if (this.playerRig) {
      this.playerRig.root.visible = true;
      this.playerRig.root.position.set(this.playerX, this.playerY, this.playerZ);
      this.playerRig.root.rotation.y = this.playerYaw + Math.PI;
    }

    // Immediate snap of camera behind player
    const camBackX = Math.sin(this.playerYaw) * 6.2;
    const camBackZ = Math.cos(this.playerYaw) * 6.2;
    this.camPos.set(this.playerX + camBackX, 3.0, this.playerZ + camBackZ);
    this.camLook.set(this.playerX - Math.sin(this.playerYaw) * 12, 1.4, this.playerZ - Math.cos(this.playerYaw) * 12);

    if (this.onlineRoomMode === 'pvp') {
      this.wave = 1;
      this.waveRemainingToSpawn = 0;
      this.waveBanner = 'DUELO ONLINE PVP';
      this.waveBannerTimer = 2.6;
    } else {
      this.wave = 1;
      this.startWave(1);
    }

    // Spawn 2 starter pickups in sight
    this.spawnPickup('ammo', -4.5, -2);
    this.spawnPickup('medkit', 4.5, -2);

    document.body.dataset.state = 'playing';
    this.callbacks.onStateChange('playing');
    this.emitHudSnapshot();
  }

  public setPaused(paused: boolean) {
    if (this.screenState === 'title' || this.screenState === 'gameover') return;
    if (paused) {
      this.screenState = 'paused';
      this.keysHeld.clear();
      this.mouseDown = false;
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
      document.body.dataset.state = 'paused';
      this.callbacks.onStateChange('paused');
    } else {
      this.screenState = 'playing';
      this.keysHeld.clear();
      this.lastTime = performance.now();
      document.body.dataset.state = 'playing';
      this.callbacks.onStateChange('playing');
    }
    this.emitHudSnapshot();
  }

  public returnToTitle() {
    this.clearDynamicEntities();
    this.clearRemotePlayers();
    this.onlineRoomMode = null;
    this.screenState = 'title';
    this.inVehicle = false;
    this.buildMode = false;
    this.updateBuildGhostVisibility();
    this.playerX = 0;
    this.playerY = 0;
    this.playerZ = 0;
    this.playerYaw = 0;
    this.rebuildPlayerModel();
    if (this.playerRig) {
      this.playerRig.root.visible = true;
      this.playerRig.root.rotation.set(0, 0, 0);
    }
    this.playerShadow.position.set(0, 0.015, 0);
    this.playerShadow.scale.setScalar(1);
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    document.body.dataset.state = 'title';
    this.callbacks.onStateChange('title');
    this.emitHudSnapshot();
  }

  private clearRemotePlayers() {
    for (const actor of this.remotePlayers.values()) {
      this.scene.remove(actor.rig.root);
      this.scene.remove(actor.shadow);
    }
    this.remotePlayers.clear();
  }

  private clearDynamicEntities() {
    for (const e of this.enemies) {
      this.scene.remove(e.rig.root);
      this.scene.remove(e.shadow);
    }
    this.enemies = [];

    for (const p of this.projectiles) {
      this.scene.remove(p.mesh);
    }
    this.projectiles = [];

    for (const pk of this.pickups) {
      this.scene.remove(pk.mesh);
      this.scene.remove(pk.shadow);
    }
    this.pickups = [];

    for (const t of this.turrets) {
      this.scene.remove(t.root);
    }
    this.turrets = [];

    for (const b of this.beams) {
      this.scene.remove(b.mesh);
    }
    this.beams = [];

    for (const s of this.shockwaves) {
      this.scene.remove(s.mesh);
    }
    this.shockwaves = [];
  }

  private startWave(waveNum: number) {
    this.wave = waveNum;
    const cfg = computeWaveConfig(waveNum);
    this.waveRemainingToSpawn = cfg.totalEnemies;
    this.waveSpawnTimer = 0.6;
    this.waveBanner =
      this.gameMode === 'sandbox'
        ? 'CAOS SANDBOX LIBERADO'
        : cfg.hasBoss
          ? `ONDA ${waveNum} · CHEFE TANQUE-GALO!`
          : `ONDA ${waveNum}`;
    this.waveBannerTimer = 2.4;

    if (cfg.hasBoss && this.gameMode === 'survival') {
      this.spawnEnemy('tank_boss');
    }
  }

  private spawnEnemy(forceArchetype?: EnemyArchetype) {
    if (!this.world || !this.textures) return;
    const cfg = computeWaveConfig(this.wave);

    let archetype: EnemyArchetype = forceArchetype ?? 'swarmer';
    if (!forceArchetype) {
      const r = Math.random();
      const wSwarm = cfg.weights.swarmer;
      const wKiter = cfg.weights.kiter;
      if (r < wSwarm) archetype = 'swarmer';
      else if (r < wSwarm + wKiter) archetype = 'kiter';
      else archetype = 'bomber';
    }

    // Spawn first enemies in the forward vista arc so player spots them right away, later ones surround
    let sx = 0;
    let sz = -20;
    for (let attempt = 0; attempt < 8; attempt++) {
      const angle =
        this.enemies.length < 2 && this.wave === 1
          ? -Math.PI / 2 + (Math.random() - 0.5) * 0.9
          : Math.random() * Math.PI * 2;
      const dist = this.enemies.length < 2 && this.wave === 1 ? 18 + Math.random() * 8 : 24 + Math.random() * 18;
      sx = this.playerX + Math.cos(angle) * dist;
      sz = this.playerZ + Math.sin(angle) * dist;
      const lim = this.world.arenaRadius - 4;
      sx = THREE.MathUtils.clamp(sx, -lim, lim);
      sz = THREE.MathUtils.clamp(sz, -lim, lim);
      const dx = sx - this.playerX;
      const dz = sz - this.playerZ;
      if (dx * dx + dz * dz > 14 * 14) break;
    }

    const skin =
      archetype === 'swarmer'
        ? 'crimson'
        : archetype === 'kiter'
          ? 'cyber'
          : archetype === 'bomber'
            ? 'gold'
            : 'ninja';
    const hat =
      archetype === 'tank_boss'
        ? 'crown'
        : archetype === 'kiter'
          ? 'helmet'
          : archetype === 'swarmer'
            ? 'mohawk'
            : 'none';

    const scale = archetype === 'tank_boss' ? 1.95 : archetype === 'bomber' ? 1.1 : 1.0;
    const rig = createChickenModel({
      skin,
      hat,
      visor: archetype === 'kiter' || archetype === 'tank_boss' ? 'tactical' : 'none',
      scale,
      archetype,
    });
    if (archetype === 'kiter') rig.setWeapon('ak_galo');
    else if (archetype === 'tank_boss') rig.setWeapon('bazooka');
    else if (archetype === 'swarmer') rig.setWeapon('pan');

    rig.root.position.set(sx, 0, sz);
    this.scene.add(rig.root);

    const shadow = new THREE.Mesh(
      this.shadowGeo,
      new THREE.MeshBasicMaterial({
        map: this.textures.contactShadowMap,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.setScalar(scale);
    shadow.position.set(sx, 0.015, sz);
    this.scene.add(shadow);

    const baseHp =
      archetype === 'tank_boss'
        ? 460
        : archetype === 'kiter'
          ? 75
          : archetype === 'bomber'
            ? 65
            : 58;
    const baseSpeed =
      archetype === 'tank_boss'
        ? 4.0
        : archetype === 'bomber'
          ? 7.2
          : archetype === 'kiter'
            ? 5.2
            : 6.4;

    const maxHp = Math.round(baseHp * cfg.hpMultiplier);
    this.enemies.push({
      id: this.nextEnemyId++,
      archetype,
      rig,
      shadow,
      x: sx,
      y: 0,
      z: sz,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      hp: maxHp,
      maxHp,
      speed: baseSpeed * cfg.speedMultiplier,
      radius: 0.65 * scale,
      armor: archetype === 'tank_boss' ? 0.25 : 0,
      points: archetype === 'tank_boss' ? 500 : archetype === 'bomber' ? 130 : 100,
      strafeSign: Math.random() > 0.5 ? 1 : -1,
      attackCooldown: 0.6 + Math.random() * 0.8,
      windupTimer: 0,
      hitFlashTimer: 0,
      koTimer: 0,
      koSpinDir: Math.random() > 0.5 ? 1 : -1,
      walkPhase: Math.random() * 6,
      hasTelegraphed: false,
    });
  }

  private spawnPickup(kind: PickupItem['kind'], x: number, z: number) {
    if (!this.textures) return;
    const group = new THREE.Group();
    const color = kind === 'medkit' ? 0x22c55e : kind === 'ammo' ? 0x38bdf8 : 0xfacc15;
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.35,
      roughness: 0.3,
      metalness: 0.4,
    });
    const box = new THREE.Mesh(
      kind === 'coin' ? new THREE.CylinderGeometry(0.32, 0.32, 0.12, 12) : new THREE.BoxGeometry(0.55, 0.42, 0.55),
      mat,
    );
    if (kind === 'coin') box.rotation.x = Math.PI / 2;
    group.add(box);
    group.position.set(x, 0.5, z);
    this.scene.add(group);

    const shadow = new THREE.Mesh(
      this.shadowGeo,
      new THREE.MeshBasicMaterial({
        map: this.textures.contactShadowMap,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.setScalar(0.65);
    shadow.position.set(x, 0.015, z);
    this.scene.add(shadow);

    this.pickups.push({ kind, mesh: group, shadow, x, y: 0.5, z, life: 22 });
  }

  private spawnParticles(
    x: number,
    y: number,
    z: number,
    count: number,
    colorHex: number,
    speed = 7,
    size = 0.14,
    gravity = 12,
  ) {
    for (let i = 0; i < count; i++) {
      const slot = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % this.particleCapacity;
      const theta = Math.random() * Math.PI * 2;
      const up = 0.3 + Math.random() * 0.9;
      const spd = speed * (0.45 + Math.random() * 0.8);
      slot.active = true;
      slot.x = x;
      slot.y = y;
      slot.z = z;
      slot.vx = Math.cos(theta) * spd;
      slot.vy = up * spd;
      slot.vz = Math.sin(theta) * spd;
      slot.maxLife = 0.35 + Math.random() * 0.45;
      slot.life = slot.maxLife;
      slot.size = size * (0.7 + Math.random() * 0.6);
      slot.gravity = gravity;
      slot.rotSpeed = (Math.random() - 0.5) * 12;
      slot.color = colorHex;
    }
  }

  private spawnShockwave(x: number, y: number, z: number, maxRadius: number, colorHex = 0xf97316) {
    const geo = new THREE.RingGeometry(0.4, 0.85, 24);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + 0.08, z);
    this.scene.add(mesh);
    this.shockwaves.push({ mesh, life: 0.36, maxLife: 0.36, maxRadius });
  }

  private startReload() {
    if (this.reloadingWeapon) return;
    const spec = WEAPONS[this.activeWeapon];
    if (spec.isMelee || this.ammo[this.activeWeapon] >= spec.magSize) return;
    this.reloadingWeapon = this.activeWeapon;
    this.reloadTimer = spec.reloadTime;
    this.emitHudSnapshot();
  }

  private throwEggGrenade() {
    if (this.grenadeCooldown > 0) return;
    this.grenadeCooldown = this.grenadeMaxCooldown;
    gameAudio.playCluck(false);

    const aimDir = this.getAimDirection(_dir);
    const mat = new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.3, emissive: 0xfacc15, emissiveIntensity: 0.25 });
    const mesh = new THREE.Mesh(this.eggGeo, mat);
    const sx = this.playerX + aimDir.x * 0.8;
    const sy = this.playerY + 1.35;
    const sz = this.playerZ + aimDir.z * 0.8;
    mesh.position.set(sx, sy, sz);
    this.scene.add(mesh);

    this.projectiles.push({
      fromPlayer: true,
      kind: 'egg_grenade',
      mesh,
      x: sx,
      y: sy,
      z: sz,
      vx: aimDir.x * 22,
      vy: aimDir.y * 18 + 6.5,
      vz: aimDir.z * 22,
      damage: 120,
      explosionRadius: 7.2,
      knockback: 22,
      life: 1.45,
      weaponId: 'bazooka',
    });
    this.emitHudSnapshot();
  }

  private toggleVehicle() {
    if (!this.buggy) return;
    if (this.inVehicle) {
      this.inVehicle = false;
      this.playerX = this.buggyX + Math.cos(this.buggyYaw) * 2.2;
      this.playerZ = this.buggyZ - Math.sin(this.buggyYaw) * 2.2;
      this.playerY = 0;
      if (this.playerRig) this.playerRig.root.visible = true;
      gameAudio.playJump(false);
    } else {
      const dx = this.playerX - this.buggyX;
      const dz = this.playerZ - this.buggyZ;
      if (dx * dx + dz * dz <= 4.6 * 4.6) {
        this.inVehicle = true;
        this.buildMode = false;
        this.updateBuildGhostVisibility();
        if (this.playerRig) this.playerRig.root.visible = false;
        gameAudio.playCluck(true);
      }
    }
    this.emitHudSnapshot();
  }

  private tryPlaceBuildProp() {
    if (!this.world || !this.textures) return;
    const spec = BUILD_PROPS.find((p) => p.id === this.selectedBuildProp)!;
    if (spec.cost > 0 && !this.callbacks.onSpendCoins(spec.cost)) {
      return;
    }

    const forwardX = -Math.sin(this.playerYaw);
    const forwardZ = -Math.cos(this.playerYaw);
    const px = this.playerX + forwardX * 3.4;
    const pz = this.playerZ + forwardZ * 3.4;

    if (this.selectedBuildProp === 'crate') {
      const crate = createCrateMesh(this.textures, 1.85);
      crate.position.set(px, 0, pz);
      this.world.group.add(crate);
      this.world.raycastTargets.push(crate);
      this.world.colliders.push({
        minX: px - 0.925,
        maxX: px + 0.925,
        minZ: pz - 0.925,
        maxZ: pz + 0.925,
        bottomY: 0,
        topY: 1.85,
      });
    } else if (this.selectedBuildProp === 'ramp') {
      const ramp = createRampMesh(3.4, 1.6, 4.5, 0x38bdf8);
      ramp.position.set(px, 0, pz);
      this.world.group.add(ramp);
      this.world.raycastTargets.push(ramp);
      this.world.ramps.push({
        minX: px - 1.7,
        maxX: px + 1.7,
        minZ: pz - 2.25,
        maxZ: pz + 2.25,
        lowY: 0,
        highY: 1.6,
        dir: 'north',
      });
    } else if (this.selectedBuildProp === 'barrel') {
      const barrelMesh = createBarrelMesh();
      barrelMesh.position.set(px, 0, pz);
      this.world.group.add(barrelMesh);
      this.world.raycastTargets.push(barrelMesh);
      const id = 1000 + this.world.barrels.length;
      const colliderIdx = this.world.colliders.length;
      this.world.colliders.push({
        minX: px - 0.5,
        maxX: px + 0.5,
        minZ: pz - 0.5,
        maxZ: pz + 0.5,
        bottomY: 0,
        topY: 1.2,
      });
      barrelMesh.traverse((c) => (c.userData.barrelId = id));
      this.world.barrels.push({ id, mesh: barrelMesh, x: px, y: 0, z: pz, hp: 35, alive: true, colliderIdx });
    } else if (this.selectedBuildProp === 'turret') {
      const { root, head } = createTurretModel();
      root.position.set(px, 0, pz);
      this.scene.add(root);
      this.turrets.push({ root, head, x: px, y: 0, z: pz, cooldown: 0.4 });
    }

    this.spawnParticles(px, 0.7, pz, 8, 0x38bdf8, 5, 0.14, 10);
    gameAudio.playBuild();
  }

  private getAimDirection(out: THREE.Vector3): THREE.Vector3 {
    const cosPitch = Math.cos(this.playerPitch);
    out.set(
      -Math.sin(this.playerYaw) * cosPitch,
      Math.sin(this.playerPitch),
      -Math.cos(this.playerYaw) * cosPitch,
    );
    return out.normalize();
  }

  private fireActiveWeapon() {
    if (this.buildMode) {
      if (this.mouseJustPressed) this.tryPlaceBuildProp();
      return;
    }

    if (this.fireCooldown > 0 || this.reloadingWeapon) return;
    const spec = WEAPONS[this.activeWeapon];

    if (!spec.isMelee && this.ammo[this.activeWeapon] <= 0) {
      this.startReload();
      return;
    }

    this.fireCooldown = spec.fireInterval;
    if (!spec.isMelee) {
      this.ammo[this.activeWeapon] -= 1;
      if (this.ammo[this.activeWeapon] <= 0) {
        this.startReload();
      }
    }

    gameAudio.playWeaponFire(this.activeWeapon);
    this.recoilOffset = spec.id === 'bazooka' ? 0.32 : spec.id === 'shotgun' ? 0.24 : 0.1;

    const aimDir = this.getAimDirection(_dir);
    const muzzleX = this.playerX + aimDir.x * 0.9;
    const muzzleY = this.playerY + 1.25 + aimDir.y * 0.5;
    const muzzleZ = this.playerZ + aimDir.z * 0.9;

    if (this.onlineRoomMode !== null) {
      this.callbacks.onNetworkFire?.({
        x: muzzleX,
        y: muzzleY,
        z: muzzleZ,
        dx: aimDir.x,
        dy: aimDir.y,
        dz: aimDir.z,
        weaponId: this.activeWeapon,
      });
    }

    if (spec.isMelee) {
      this.panSwingTimer = 0.24;
      let hitAny = false;
      for (const e of this.enemies) {
        if (e.koTimer > 0) continue;
        const dx = e.x - this.playerX;
        const dz = e.z - this.playerZ;
        const dist = Math.hypot(dx, dz);
        if (dist <= spec.range + e.radius) {
          this.damageEnemy(e, spec.damage, dx / (dist || 1), dz / (dist || 1), spec.knockback, true);
          hitAny = true;
        }
      }
      if (this.onlineRoomMode === 'pvp') {
        for (const rp of this.remotePlayers.values()) {
          if (rp.hp <= 0) continue;
          const dist = Math.hypot(rp.x - this.playerX, rp.z - this.playerZ);
          if (dist <= spec.range + 0.7) {
            this.hitRemotePlayer(rp, spec.damage);
            hitAny = true;
          }
        }
      }
      if (hitAny) {
        gameAudio.playPanHit();
        this.hitstopTimer = 0.055;
        this.trauma = Math.min(1, this.trauma + 0.45);
      }
      this.emitHudSnapshot();
      return;
    }

    if (spec.isBeam) {
      // Instant piercing laser beam
      const endX = muzzleX + aimDir.x * spec.range;
      const endY = muzzleY + aimDir.y * spec.range;
      const endZ = muzzleZ + aimDir.z * spec.range;
      const beamLen = spec.range;
      const beamGeo = new THREE.CylinderGeometry(0.08, 0.08, beamLen, 6);
      beamGeo.rotateX(Math.PI / 2);
      const beamMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
      const beamMesh = new THREE.Mesh(beamGeo, beamMat);
      beamMesh.position.set((muzzleX + endX) / 2, (muzzleY + endY) / 2, (muzzleZ + endZ) / 2);
      beamMesh.lookAt(endX, endY, endZ);
      this.scene.add(beamMesh);
      this.beams.push({ mesh: beamMesh, life: 0.14 });

      // Check hits along beam ray
      for (const e of this.enemies) {
        if (e.koTimer > 0) continue;
        _v1.set(e.x - muzzleX, e.y + 0.9 - muzzleY, e.z - muzzleZ);
        const proj = _v1.dot(aimDir);
        if (proj > 0 && proj < spec.range) {
          _v2.copy(aimDir).multiplyScalar(proj);
          const perpSq = _v1.distanceToSquared(_v2);
          const hitR = e.radius + 0.45;
          if (perpSq <= hitR * hitR) {
            const dmg = calculateDamage(spec.damage, proj, spec.range, false, e.armor);
            this.damageEnemy(e, dmg, aimDir.x, aimDir.z, spec.knockback, false);
          }
        }
      }
      if (this.onlineRoomMode === 'pvp') {
        for (const rp of this.remotePlayers.values()) {
          if (rp.hp <= 0) continue;
          _v1.set(rp.x - muzzleX, rp.y + 0.9 - muzzleY, rp.z - muzzleZ);
          const proj = _v1.dot(aimDir);
          if (proj > 0 && proj < spec.range) {
            _v2.copy(aimDir).multiplyScalar(proj);
            const perpSq = _v1.distanceToSquared(_v2);
            if (perpSq <= 1.15 * 1.15) {
              const dmg = calculateDamage(spec.damage, proj, spec.range, false, 0);
              this.hitRemotePlayer(rp, dmg);
            }
          }
        }
      }
      this.spawnParticles(muzzleX, muzzleY, muzzleZ, 5, 0x38bdf8, 6, 0.12, 2);
      this.emitHudSnapshot();
      return;
    }

    // Projectile weapons (AK-Galo, Shotgun, Bazooka)
    this.spawnParticles(muzzleX, muzzleY, muzzleZ, spec.id === 'shotgun' ? 8 : 4, 0xfef08a, 5, 0.1, 2);

    for (let i = 0; i < spec.pellets; i++) {
      const sx = aimDir.x + (Math.random() - 0.5) * spec.spread;
      const sy = aimDir.y + (Math.random() - 0.5) * spec.spread;
      const sz = aimDir.z + (Math.random() - 0.5) * spec.spread;
      const len = Math.hypot(sx, sy, sz) || 1;

      const isRocket = spec.id === 'bazooka';
      const mesh = new THREE.Mesh(
        isRocket ? this.rocketGeo : this.bulletGeo,
        new THREE.MeshBasicMaterial({ color: isRocket ? 0xfef3c7 : 0xfacc15 }),
      );
      mesh.position.set(muzzleX, muzzleY, muzzleZ);
      this.scene.add(mesh);

      this.projectiles.push({
        fromPlayer: true,
        kind: isRocket ? 'rocket' : 'bullet',
        mesh,
        x: muzzleX,
        y: muzzleY,
        z: muzzleZ,
        vx: (sx / len) * spec.projectileSpeed,
        vy: (sy / len) * spec.projectileSpeed,
        vz: (sz / len) * spec.projectileSpeed,
        damage: spec.damage,
        explosionRadius: spec.explosionRadius,
        knockback: spec.knockback,
        life: spec.range / spec.projectileSpeed,
        weaponId: spec.id,
      });
    }

    if (spec.id === 'bazooka') {
      this.trauma = Math.min(1, this.trauma + 0.25);
    }
    this.emitHudSnapshot();
  }

  private damageEnemy(
    e: EnemyActor,
    amount: number,
    dirX: number,
    dirZ: number,
    knockback: number,
    isHeadshot: boolean,
  ) {
    if (e.koTimer > 0) return;
    e.hp -= amount;
    e.hitFlashTimer = 0.06;
    e.vx += dirX * knockback;
    e.vz += dirZ * knockback;
    e.vy = Math.max(e.vy, 2.2);

    this.spawnParticles(e.x, e.y + 1.0, e.z, 6, 0xf8fafc, 6, 0.14, 14);

    if (e.hp <= 0) {
      e.hp = 0;
      e.koTimer = 0.34;
      e.vy = 6.5;
      e.vx += dirX * (knockback + 6);
      e.vz += dirZ * (knockback + 6);
      this.hitmarkerKind = 'kill';
      this.hitmarkerTimer = 0.22;
      gameAudio.playHitmarker(true);
      gameAudio.playCluck(true);
      this.hitstopTimer = Math.max(this.hitstopTimer, 0.04);
      this.trauma = Math.min(1, this.trauma + 0.28);

      const reward = calculateKillReward(e.points, this.combo, isHeadshot);
      this.score += reward.points;
      if (this.score > this.bestScore) this.bestScore = this.score;
      this.kills += 1;
      this.combo = reward.nextCombo;
      this.comboTimer = 4.2;
      this.coins += reward.coins;
      this.callbacks.onEarnCoins(reward.coins);
      this.spawnParticles(e.x, e.y + 1.1, e.z, 18, 0xffffff, 9, 0.18, 13);

      // Drop pickup chance
      const r = Math.random();
      if (r < 0.28) this.spawnPickup('medkit', e.x, e.z);
      else if (r < 0.55) this.spawnPickup('ammo', e.x, e.z);
      else if (r < 0.8) this.spawnPickup('coin', e.x, e.z);
    } else {
      this.hitmarkerKind = 'hit';
      this.hitmarkerTimer = 0.14;
      gameAudio.playHitmarker(false);
    }
  }

  private triggerExplosion(x: number, y: number, z: number, radius: number, maxDamage: number, knockback: number) {
    gameAudio.playExplosion(1);
    this.spawnParticles(x, y + 0.6, z, 26, 0xf97316, 12, 0.26, 9);
    this.spawnParticles(x, y + 0.8, z, 14, 0xfef08a, 9, 0.2, 6);
    this.spawnShockwave(x, Math.max(0.05, y), z, radius);
    this.hitstopTimer = Math.max(this.hitstopTimer, 0.048);
    this.trauma = Math.min(1, this.trauma + 0.55);

    for (const e of this.enemies) {
      if (e.koTimer > 0) continue;
      const dx = e.x - x;
      const dz = e.z - z;
      const dist = Math.hypot(dx, dz);
      if (dist <= radius + e.radius) {
        const falloff = 1 - Math.min(0.75, dist / (radius + 0.5));
        const dmg = Math.round(maxDamage * falloff);
        this.damageEnemy(e, dmg, dx / (dist || 1), dz / (dist || 1), knockback * falloff, false);
      }
    }

    if (this.onlineRoomMode === 'pvp') {
      for (const rp of this.remotePlayers.values()) {
        if (rp.hp <= 0) continue;
        const dist = Math.hypot(rp.x - x, rp.z - z);
        if (dist <= radius + 0.7) {
          const falloff = 1 - Math.min(0.75, dist / (radius + 0.5));
          const dmg = Math.round(maxDamage * falloff);
          this.hitRemotePlayer(rp, dmg);
        }
      }
    }

    // Chain-detonate nearby explosive barrels!
    if (this.world) {
      for (const b of this.world.barrels) {
        if (!b.alive) continue;
        const dist = Math.hypot(b.x - x, b.z - z);
        if (dist <= radius) {
          this.detonateBarrel(b);
        }
      }
    }

    // Splash damage to player if close (never insta-kill from 100%, fair falloff)
    const pdx = this.playerX - x;
    const pdz = this.playerZ - z;
    const pDist = Math.hypot(pdx, pdz);
    if (pDist < radius * 0.72) {
      const dmg = Math.round(18 * (1 - pDist / (radius * 0.72)));
      if (dmg > 0) this.damagePlayer(dmg);
    }
  }

  private hitRemotePlayer(rp: RemoteChickenActor, damage: number) {
    if (damage <= 0) return;
    rp.hitFlashTimer = 0.08;
    const wouldKill = rp.hp - damage <= 0;
    this.hitmarkerKind = wouldKill ? 'kill' : 'hit';
    this.hitmarkerTimer = wouldKill ? 0.22 : 0.14;
    gameAudio.playHitmarker(wouldKill);
    this.spawnParticles(rp.x, rp.y + 1.0, rp.z, 8, 0xf8fafc, 6, 0.14, 14);
    if (wouldKill) {
      this.kills += 1;
      const reward = calculateKillReward(150, this.combo, false);
      this.score += reward.points;
      if (this.score > this.bestScore) this.bestScore = this.score;
      this.combo = reward.nextCombo;
      this.comboTimer = 4.2;
      this.coins += reward.coins;
      this.callbacks.onEarnCoins(reward.coins);
    }
    this.callbacks.onNetworkHit?.(rp.id, damage);
  }

  private detonateBarrel(b: { alive: boolean; mesh: THREE.Group; x: number; y: number; z: number; colliderIdx: number }) {
    if (!b.alive || !this.world) return;
    b.alive = false;
    b.mesh.visible = false;
    const col = this.world.colliders[b.colliderIdx];
    if (col) {
      col.topY = -10;
    }
    this.triggerExplosion(b.x, b.y + 0.6, b.z, 7.5, 130, 22);
  }

  private damagePlayer(amount: number) {
    if (this.screenState !== 'playing' || this.outcome !== 'none') return;
    this.hp = Math.max(0, this.hp - amount);
    this.damageTaken += amount;
    this.trauma = Math.min(1, this.trauma + 0.35);
    gameAudio.playHurt();

    if (this.hp <= 0) {
      this.outcome = 'defeat';
      this.screenState = 'gameover';
      if (document.pointerLockElement) document.exitPointerLock?.();
      document.body.dataset.state = 'gameover';
      this.callbacks.onStateChange('gameover');
      const snap = this.buildSnapshot();
      this.callbacks.onGameOver(snap);
    }
    this.emitHudSnapshot();
  }

  private sampleGroundY(x: number, z: number, curY: number): number {
    let groundY = 0;
    if (!this.world) return groundY;

    for (const r of this.world.ramps) {
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
        let t = 0;
        if (r.dir === 'north') t = (r.maxZ - z) / (r.maxZ - r.minZ);
        else if (r.dir === 'south') t = (z - r.minZ) / (r.maxZ - r.minZ);
        else if (r.dir === 'east') t = (x - r.minX) / (r.maxX - r.minX);
        else t = (r.maxX - x) / (r.maxX - r.minX);
        groundY = Math.max(groundY, r.lowY + THREE.MathUtils.clamp(t, 0, 1) * (r.highY - r.lowY));
      }
    }

    for (const box of this.world.colliders) {
      if (x >= box.minX - 0.35 && x <= box.maxX + 0.35 && z >= box.minZ - 0.35 && z <= box.maxZ + 0.35) {
        if (curY >= box.topY - 0.35) {
          groundY = Math.max(groundY, box.topY);
        }
      }
    }
    return groundY;
  }

  private resolveArenaCollisions(pos: { x: number; z: number }, radius: number, minY: number, maxY: number) {
    if (!this.world) return;
    const lim = this.world.arenaRadius - 1.2;
    pos.x = THREE.MathUtils.clamp(pos.x, -lim, lim);
    pos.z = THREE.MathUtils.clamp(pos.z, -lim, lim);
    for (const box of this.world.colliders) {
      resolveCircleAABB(pos, radius, minY, maxY, box);
    }
  }

  private tick = (now: number) => {
    if (this.disposed) return;

    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    if (this.screenState === 'title') {
      this.updateTitleShowcase(dt);
    } else if (this.screenState === 'playing') {
      this.updateGameplay(dt);
    }

    // Rotate desert radar dish if present
    if (this.world?.radarDish) {
      this.world.radarDish.rotation.y += dt * 0.7;
    }

    this.renderer.render(this.scene, this.camera);
    this.keysJustPressed.clear();
    this.mouseJustPressed = false;
    this.touchFireJustPressed = false;
    this.touchJumpJustPressed = false;

    this.scheduleNextTick(false);
  };

  private updateTitleShowcase(dt: number) {
    this.titleOrbitAngle += dt * 0.28;
    const radius = 3.5;
    const sway = Math.sin(this.titleOrbitAngle) * 0.65;
    const targetCamX = sway + this.cursorNormX * 0.3;
    const targetCamY = 1.48 - this.cursorNormY * 0.18;
    const targetCamZ = Math.cos(sway * 0.6) * radius;

    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetCamX, 5, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetCamY, 5, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetCamZ, 5, dt);
    // Offset lookAt left (-0.9) so hero chicken at (0,0,0) stands prominently in right-center negative space
    this.camera.lookAt(-0.9, 1.0, 0);

    if (this.playerRig) {
      const bob = Math.sin(this.titleOrbitAngle * 5) * 0.03;
      this.playerRig.bodyGroup.position.y = 0.55 + bob;
      this.playerRig.headGroup.rotation.y = THREE.MathUtils.damp(
        this.playerRig.headGroup.rotation.y,
        this.cursorNormX * 0.45,
        6,
        dt,
      );
      this.playerRig.headGroup.rotation.x = THREE.MathUtils.damp(
        this.playerRig.headGroup.rotation.x,
        this.cursorNormY * 0.2,
        6,
        dt,
      );
      this.playerRig.root.rotation.y = Math.sin(this.titleOrbitAngle * 0.8) * 0.2;
    }
  }

  private updateGameplay(dt: number) {
    // Camera shake & hit flash decay even during hitstop
    this.trauma = Math.max(0, this.trauma - dt * 1.9);
    this.fovKick = THREE.MathUtils.damp(this.fovKick, 0, 8, dt);

    if (this.hitmarkerTimer > 0) {
      this.hitmarkerTimer -= dt;
      if (this.hitmarkerTimer <= 0) this.hitmarkerKind = 'none';
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      this.updateCameraRig(dt);
      return;
    }

    this.elapsedSeconds += dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    if (this.waveBannerTimer > 0) {
      this.waveBannerTimer -= dt;
      if (this.waveBannerTimer <= 0) this.waveBanner = null;
    }

    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.grenadeCooldown = Math.max(0, this.grenadeCooldown - dt);
    if (this.reloadingWeapon) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.ammo[this.reloadingWeapon] = WEAPONS[this.reloadingWeapon].magSize;
        this.reloadingWeapon = null;
        this.emitHudSnapshot();
      }
    }

    // Arrow keys also allow smooth yaw rotation (useful without PointerLock)
    if (this.keysHeld.has('ArrowLeft')) this.playerYaw += 2.2 * dt;
    if (this.keysHeld.has('ArrowRight')) this.playerYaw -= 2.2 * dt;

    if (this.inVehicle) {
      this.updateVehicleMovement(dt);
    } else {
      this.updatePlayerMovement(dt);
    }

    // Firing via Mouse, 'F' key, or Touch button
    if (
      this.mouseDown ||
      this.mouseJustPressed ||
      this.keysHeld.has('KeyF') ||
      this.keysJustPressed.has('KeyF') ||
      this.touchFireActive ||
      this.touchFireJustPressed
    ) {
      this.fireActiveWeapon();
    }

    // Update build ghost position
    if (this.buildMode && this.buildGhost) {
      const fx = -Math.sin(this.playerYaw);
      const fz = -Math.cos(this.playerYaw);
      this.buildGhost.position.set(this.playerX + fx * 3.4, 0.85, this.playerZ + fz * 3.4);
      this.buildGhost.rotation.y = this.playerYaw;
    }

    if (this.onlineRoomMode !== 'pvp') {
      this.updateWavesAndEnemies(dt);
    }
    this.updateRemotePlayers(dt);
    this.updateTurrets(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.updateEffects(dt);
    this.updateParticles(dt);
    this.updateCameraRig(dt);

    if (this.onlineRoomMode !== null) {
      this.netSyncTimer += dt;
      if (this.netSyncTimer >= 0.066) {
        this.netSyncTimer = 0;
        this.callbacks.onNetworkSync?.({
          skin: this.customization.skin,
          hat: this.customization.hat,
          visor: this.customization.visor,
          weapon: this.activeWeapon,
          x: Math.round(this.playerX * 100) / 100,
          y: Math.round(this.playerY * 100) / 100,
          z: Math.round(this.playerZ * 100) / 100,
          yaw: Math.round(this.playerYaw * 1000) / 1000,
          hp: Math.round(this.hp),
          kills: this.kills,
        });
      }
    }

    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.085) {
      this.hudSyncTimer = 0;
      this.emitHudSnapshot();
    }
  }

  private updateRemotePlayers(dt: number) {
    for (const rp of this.remotePlayers.values()) {
      const prevX = rp.x;
      const prevZ = rp.z;
      rp.x = THREE.MathUtils.damp(rp.x, rp.targetX, 14, dt);
      rp.y = THREE.MathUtils.damp(rp.y, rp.targetY, 14, dt);
      rp.z = THREE.MathUtils.damp(rp.z, rp.targetZ, 14, dt);

      // Shortest angular interpolation for yaw
      let diff = rp.targetYaw - rp.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      rp.yaw += diff * Math.min(1, dt * 14);

      if (rp.hitFlashTimer > 0) {
        rp.hitFlashTimer -= dt;
        for (const m of rp.rig.hitMeshes) {
          (m.material as THREE.MeshStandardMaterial).emissive.setHex(
            rp.hitFlashTimer > 0 ? 0xffffff : 0x000000,
          );
          (m.material as THREE.MeshStandardMaterial).emissiveIntensity = rp.hitFlashTimer > 0 ? 0.8 : 0;
        }
      }

      const moved = Math.hypot(rp.x - prevX, rp.z - prevZ) / Math.max(0.001, dt);
      rp.walkPhase += moved * dt * 1.45;
      const stride = rp.y <= 0.15 ? Math.sin(rp.walkPhase) * Math.min(1, moved / 7) : 0.4;

      rp.rig.root.position.set(rp.x, rp.y, rp.z);
      rp.rig.root.rotation.y = rp.yaw + Math.PI;
      rp.rig.leftLeg.rotation.x = stride * 0.7;
      rp.rig.rightLeg.rotation.x = -stride * 0.7;
      rp.shadow.position.set(rp.x, 0.015, rp.z);
    }
  }

  private updatePlayerMovement(dt: number) {
    let moveForward = this.touchMoveY;
    let moveRight = this.touchMoveX;
    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) moveForward += 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) moveForward -= 1;
    if (this.keysHeld.has('KeyD')) moveRight += 1;
    if (this.keysHeld.has('KeyA')) moveRight -= 1;

    const len = Math.hypot(moveForward, moveRight);
    if (len > 1) {
      moveForward /= len;
      moveRight /= len;
    }

    const sprinting = this.keysHeld.has('ShiftLeft') || this.keysHeld.has('ShiftRight');
    const speed = sprinting ? 13.0 : 9.0;
    if (sprinting && len > 0) {
      this.fovKick = THREE.MathUtils.damp(this.fovKick, 6, 8, dt);
    }

    const sinY = Math.sin(this.playerYaw);
    const cosY = Math.cos(this.playerYaw);
    const targetVx = (-sinY * moveForward + cosY * moveRight) * speed;
    const targetVz = (-cosY * moveForward - sinY * moveRight) * speed;

    const accel = this.playerOnGround ? 14 : 6;
    this.playerVx = THREE.MathUtils.damp(this.playerVx, targetVx, accel, dt);
    this.playerVz = THREE.MathUtils.damp(this.playerVz, targetVz, accel, dt);

    // Coyote time & jump buffer
    if (this.playerOnGround) {
      this.coyoteTimer = 0.11;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    if (this.keysJustPressed.has('Space') || this.touchJumpJustPressed) {
      this.jumpBufferTimer = 0.12;
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }

    let jetpackActive = false;
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.playerVy = 11.2;
      this.playerOnGround = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.squashX = 0.84;
      this.squashY = 1.2;
      gameAudio.playJump(false);
    } else if (!this.playerOnGround && (this.keysHeld.has('Space') || this.touchJumpHeld) && this.jetpack > 2) {
      // Jetpack thrust!
      this.playerVy = Math.min(9.5, this.playerVy + 30 * dt);
      this.jetpack = Math.max(0, this.jetpack - 36 * dt);
      jetpackActive = true;
      if (Math.random() < 0.45) {
        this.spawnParticles(this.playerX, this.playerY + 0.4, this.playerZ, 1, 0xf97316, 3, 0.15, 2);
      }
      if (this.keysJustPressed.has('Space') || this.touchJumpJustPressed) gameAudio.playJump(true);
    } else if (this.playerOnGround) {
      this.jetpack = Math.min(this.maxJetpack, this.jetpack + 32 * dt);
    }

    this.playerVy -= 26 * dt;

    const pos = { x: this.playerX + this.playerVx * dt, z: this.playerZ + this.playerVz * dt };
    this.resolveArenaCollisions(pos, 0.55, this.playerY, this.playerY + 1.65);
    this.playerX = pos.x;
    this.playerZ = pos.z;

    const wasGrounded = this.playerOnGround;
    const prevVy = this.playerVy;
    this.playerY += this.playerVy * dt;

    const groundY = this.sampleGroundY(this.playerX, this.playerZ, this.playerY);
    if (this.playerY <= groundY) {
      this.playerY = groundY;
      this.playerVy = 0;
      this.playerOnGround = true;
      if (!wasGrounded && prevVy < -6) {
        this.squashX = 1.22;
        this.squashY = 0.78;
      }
    } else {
      this.playerOnGround = false;
    }

    // Animate player chicken rig
    this.squashX = THREE.MathUtils.damp(this.squashX, 1, 14, dt);
    this.squashY = THREE.MathUtils.damp(this.squashY, 1, 14, dt);
    this.recoilOffset = THREE.MathUtils.damp(this.recoilOffset, 0, 16, dt);
    if (this.panSwingTimer > 0) this.panSwingTimer = Math.max(0, this.panSwingTimer - dt);

    if (this.playerRig) {
      const horizSpeed = Math.hypot(this.playerVx, this.playerVz);
      this.walkPhase += horizSpeed * dt * 1.45;
      const stride = this.playerOnGround ? Math.sin(this.walkPhase) * Math.min(1, horizSpeed / 7) : 0.4;

      this.playerRig.root.position.set(this.playerX, this.playerY, this.playerZ);
      this.playerRig.root.rotation.y = this.playerYaw + Math.PI;
      this.playerRig.root.scale.set(this.squashX, this.squashY, this.squashX);
      this.playerRig.leftLeg.rotation.x = stride * 0.7;
      this.playerRig.rightLeg.rotation.x = -stride * 0.7;
      this.playerRig.rightWing.rotation.z = this.playerOnGround ? 0.1 + Math.abs(stride) * 0.15 : 0.65;
      this.playerRig.leftWing.rotation.x =
        this.panSwingTimer > 0 ? -Math.sin((this.panSwingTimer / 0.24) * Math.PI) * 1.4 : -this.playerPitch * 0.6;
      this.playerRig.weaponMount.position.z = 0.34 - this.recoilOffset;
      this.playerRig.setJetpackActive(jetpackActive);
    }

    this.playerShadow.position.set(this.playerX, groundY + 0.015, this.playerZ);
    const shadowScale = Math.max(0.35, 1 - (this.playerY - groundY) * 0.12);
    this.playerShadow.scale.setScalar(shadowScale);
  }

  private updateVehicleMovement(dt: number) {
    if (!this.buggy) return;
    let throttle = this.touchMoveY;
    let steer = -this.touchMoveX;
    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) throttle += 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) throttle -= 1;
    if (this.keysHeld.has('KeyA')) steer += 1;
    if (this.keysHeld.has('KeyD')) steer -= 1;
    throttle = THREE.MathUtils.clamp(throttle, -1, 1);
    steer = THREE.MathUtils.clamp(steer, -1, 1);

    const turbo = this.keysHeld.has('ShiftLeft') || this.keysHeld.has('ShiftRight') ? 1.45 : 1;
    const targetSpeed = throttle * 20 * turbo;
    this.buggySpeed = THREE.MathUtils.damp(this.buggySpeed, targetSpeed, throttle !== 0 ? 4.5 : 3.2, dt);

    if (Math.abs(this.buggySpeed) > 0.6) {
      const dirSign = this.buggySpeed >= 0 ? 1 : -1;
      this.buggyYaw += steer * 2.1 * dirSign * dt;
    }

    const vx = Math.sin(this.buggyYaw) * this.buggySpeed;
    const vz = Math.cos(this.buggyYaw) * this.buggySpeed;
    const pos = { x: this.buggyX + vx * dt, z: this.buggyZ + vz * dt };
    this.resolveArenaCollisions(pos, 1.85, 0, 2.0);
    this.buggyX = pos.x;
    this.buggyZ = pos.z;

    this.playerX = this.buggyX;
    this.playerZ = this.buggyZ;
    this.playerY = 0.8;
    this.playerYaw = this.buggyYaw + Math.PI;

    this.buggy.root.position.set(this.buggyX, 0, this.buggyZ);
    this.buggy.root.rotation.y = this.buggyYaw;
    for (const w of this.buggy.wheels) {
      w.rotation.x += this.buggySpeed * dt * 1.4;
    }
    this.playerShadow.position.set(this.buggyX, 0.02, this.buggyZ);
    this.playerShadow.scale.setScalar(2.4);

    // Roadkill enemies!
    if (Math.abs(this.buggySpeed) > 7.5) {
      for (const e of this.enemies) {
        if (e.koTimer > 0) continue;
        const dx = e.x - this.buggyX;
        const dz = e.z - this.buggyZ;
        if (dx * dx + dz * dz < (2.1 + e.radius) * (2.1 + e.radius)) {
          this.damageEnemy(e, 95, dx, dz, 18, false);
        }
      }
    }
  }

  private updateWavesAndEnemies(dt: number) {
    const cfg = computeWaveConfig(this.wave);

    // Spawner
    if (this.gameMode === 'sandbox') {
      if (this.enemies.length < 6) {
        this.waveSpawnTimer -= dt;
        if (this.waveSpawnTimer <= 0) {
          this.waveSpawnTimer = 1.6;
          this.spawnEnemy();
        }
      }
    } else {
      if (this.waveRemainingToSpawn > 0 && this.enemies.length < cfg.maxConcurrent) {
        this.waveSpawnTimer -= dt;
        if (this.waveSpawnTimer <= 0) {
          this.waveSpawnTimer = cfg.spawnInterval;
          this.waveRemainingToSpawn -= 1;
          this.spawnEnemy();
        }
      } else if (this.waveRemainingToSpawn === 0 && this.enemies.length === 0) {
        this.waveClearDelay += dt;
        if (this.waveClearDelay >= 1.4) {
          this.waveClearDelay = 0;
          this.startWave(this.wave + 1);
          this.hp = Math.min(this.maxHp, this.hp + 25);
        }
      }
    }

    // Attack token pool (max 4 concurrent attackers)
    let activeWindups = 0;
    for (const e of this.enemies) {
      if (e.windupTimer > 0) activeWindups++;
    }
    const maxTokens = 4;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      // Hit flash visual feedback
      if (e.hitFlashTimer > 0) {
        e.hitFlashTimer -= dt;
        for (const m of e.rig.hitMeshes) {
          (m.material as THREE.MeshStandardMaterial).emissive.setHex(
            e.hitFlashTimer > 0 ? 0xffffff : 0x000000,
          );
          (m.material as THREE.MeshStandardMaterial).emissiveIntensity = e.hitFlashTimer > 0 ? 0.85 : 0;
        }
      }

      // KO topple transition before removal
      if (e.koTimer > 0) {
        e.koTimer -= dt;
        e.vy -= 24 * dt;
        e.x += e.vx * dt;
        e.z += e.vz * dt;
        e.y = Math.max(0, e.y + e.vy * dt);
        e.rig.root.position.set(e.x, e.y, e.z);
        e.rig.root.rotation.x += dt * 9;
        e.rig.root.rotation.z += dt * 7 * e.koSpinDir;
        e.shadow.position.set(e.x, 0.015, e.z);
        if (e.koTimer <= 0) {
          this.scene.remove(e.rig.root);
          this.scene.remove(e.shadow);
          this.enemies.splice(i, 1);
        }
        continue;
      }

      e.attackCooldown = Math.max(0, e.attackCooldown - dt);
      const dx = this.playerX - e.x;
      const dz = this.playerZ - e.z;
      const dist = Math.hypot(dx, dz);

      const hasToken = activeWindups < maxTokens;
      const policy = stepEnemyPolicy(
        {
          archetype: e.archetype,
          dx,
          dz,
          dist,
          baseSpeed: e.speed,
          strafeSign: e.strafeSign,
          attackCooldown: e.attackCooldown,
          windupTimer: e.windupTimer,
          hasAttackToken: hasToken,
        },
        dt,
      );

      if (policy.shouldStartWindup) {
        activeWindups++;
        e.hasTelegraphed = true;
        if (e.archetype === 'bomber' || e.archetype === 'tank_boss') {
          gameAudio.playTelegraph();
        }
      }
      e.windupTimer = policy.nextWindupTimer;

      // Glowing telegraph cue during windup
      if (e.windupTimer > 0) {
        const pulse = (Math.sin(this.elapsedSeconds * 30) + 1) * 0.5;
        for (const m of e.rig.hitMeshes) {
          (m.material as THREE.MeshStandardMaterial).emissive.setHex(
            e.archetype === 'bomber' ? 0xef4444 : 0xf59e0b,
          );
          (m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.35 + pulse * 0.55;
        }
      } else if (e.hitFlashTimer <= 0 && e.hasTelegraphed) {
        e.hasTelegraphed = false;
        for (const m of e.rig.hitMeshes) {
          (m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
        }
      }

      if (policy.shouldTriggerAttack) {
        this.executeEnemyAttack(e, dx, dz, dist);
      }

      // Movement + soft separation between enemies
      e.vx = THREE.MathUtils.damp(e.vx, policy.moveX, 9, dt);
      e.vz = THREE.MathUtils.damp(e.vz, policy.moveZ, 9, dt);
      e.vy -= 26 * dt;

      const pos = { x: e.x + e.vx * dt, z: e.z + e.vz * dt };
      for (let j = 0; j < this.enemies.length; j++) {
        if (i === j) continue;
        const other = this.enemies[j];
        if (other.koTimer > 0) continue;
        const sdx = pos.x - other.x;
        const sdz = pos.z - other.z;
        const minSep = e.radius + other.radius;
        const sdSq = sdx * sdx + sdz * sdz;
        if (sdSq > 1e-4 && sdSq < minSep * minSep) {
          const sd = Math.sqrt(sdSq);
          const push = (minSep - sd) * 0.35;
          pos.x += (sdx / sd) * push;
          pos.z += (sdz / sd) * push;
        }
      }

      this.resolveArenaCollisions(pos, e.radius, e.y, e.y + 1.6);
      e.x = pos.x;
      e.z = pos.z;
      e.y += e.vy * dt;
      const gy = this.sampleGroundY(e.x, e.z, e.y);
      if (e.y <= gy) {
        e.y = gy;
        e.vy = 0;
      }

      const targetYaw = Math.atan2(dx, dz);
      e.yaw = targetYaw;
      e.rig.root.position.set(e.x, e.y, e.z);
      e.rig.root.rotation.y = e.yaw;
      e.walkPhase += Math.hypot(e.vx, e.vz) * dt * 1.4;
      const legSwing = Math.sin(e.walkPhase) * 0.65;
      e.rig.leftLeg.rotation.x = legSwing;
      e.rig.rightLeg.rotation.x = -legSwing;
      e.shadow.position.set(e.x, gy + 0.015, e.z);
    }
  }

  private executeEnemyAttack(e: EnemyActor, dx: number, dz: number, dist: number) {
    if (e.archetype === 'swarmer') {
      e.attackCooldown = 1.05;
      if (dist <= 3.0) {
        this.damagePlayer(10);
      }
    } else if (e.archetype === 'bomber') {
      e.koTimer = 0.1;
      e.hp = 0;
      this.spawnParticles(e.x, e.y + 1, e.z, 22, 0xef4444, 11, 0.24, 10);
      this.spawnShockwave(e.x, e.y, e.z, 5.2, 0xef4444);
      gameAudio.playExplosion(0.8);
      if (dist <= 5.2) {
        this.damagePlayer(Math.round(22 * (1 - dist / 6.2)));
      }
    } else {
      // Kiter or Tank Boss fires ranged projectile(s)
      e.attackCooldown = e.archetype === 'tank_boss' ? 1.5 : 1.75;
      const count = e.archetype === 'tank_boss' ? 3 : 1;
      const baseAngle = Math.atan2(dx, dz);
      for (let k = 0; k < count; k++) {
        const offset = count === 3 ? (k - 1) * 0.2 : 0;
        const ang = baseAngle + offset;
        const speed = e.archetype === 'tank_boss' ? 24 : 21;
        const mesh = new THREE.Mesh(
          this.bulletGeo,
          new THREE.MeshBasicMaterial({ color: 0xf97316 }),
        );
        const sx = e.x + Math.sin(ang) * 0.9;
        const sy = e.y + 1.2;
        const sz = e.z + Math.cos(ang) * 0.9;
        mesh.position.set(sx, sy, sz);
        this.scene.add(mesh);
        this.projectiles.push({
          fromPlayer: false,
          kind: 'enemy_bolt',
          mesh,
          x: sx,
          y: sy,
          z: sz,
          vx: Math.sin(ang) * speed,
          vy: (this.playerY + 0.9 - sy) / Math.max(0.25, dist / speed),
          vz: Math.cos(ang) * speed,
          damage: e.archetype === 'tank_boss' ? 15 : 9,
          explosionRadius: 0,
          knockback: 4,
          life: 2.5,
          weaponId: 'ak_galo',
        });
      }
    }
  }

  private updateTurrets(dt: number) {
    for (const t of this.turrets) {
      t.cooldown = Math.max(0, t.cooldown - dt);
      let nearest: EnemyActor | null = null;
      let bestDistSq = 28 * 28;
      for (const e of this.enemies) {
        if (e.koTimer > 0) continue;
        const dSq = (e.x - t.x) ** 2 + (e.z - t.z) ** 2;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          nearest = e;
        }
      }
      if (nearest) {
        const targetYaw = Math.atan2(nearest.x - t.x, nearest.z - t.z);
        t.head.rotation.y = targetYaw;
        if (t.cooldown <= 0) {
          t.cooldown = 0.42;
          const d = Math.sqrt(bestDistSq) || 1;
          const vx = ((nearest.x - t.x) / d) * 65;
          const vz = ((nearest.z - t.z) / d) * 65;
          const mesh = new THREE.Mesh(this.bulletGeo, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
          mesh.position.set(t.x, 1.05, t.z);
          this.scene.add(mesh);
          this.projectiles.push({
            fromPlayer: true,
            kind: 'bullet',
            mesh,
            x: t.x,
            y: 1.05,
            z: t.z,
            vx,
            vy: 0,
            vz,
            damage: 20,
            explosionRadius: 0,
            knockback: 2.5,
            life: 0.7,
            weaponId: 'ak_galo',
          });
        }
      }
    }
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;

      if (p.kind === 'egg_grenade') {
        p.vy -= 22 * dt;
      }

      const nextX = p.x + p.vx * dt;
      const nextY = p.y + p.vy * dt;
      const nextZ = p.z + p.vz * dt;

      let remove = p.life <= 0;

      // Ground bounce or impact
      if (nextY <= 0.15) {
        if (p.kind === 'egg_grenade') {
          p.y = 0.16;
          p.vy = Math.abs(p.vy) * 0.48;
          p.vx *= 0.72;
          p.vz *= 0.72;
        } else if (p.kind === 'rocket') {
          this.triggerExplosion(nextX, 0.2, nextZ, p.explosionRadius, p.damage, p.knockback);
          remove = true;
        } else {
          this.spawnParticles(nextX, 0.2, nextZ, 3, 0xfef08a, 4, 0.08, 12);
          remove = true;
        }
      }

      p.x = nextX;
      p.y = p.kind === 'egg_grenade' && nextY <= 0.15 ? 0.16 : nextY;
      p.z = nextZ;
      p.mesh.position.set(p.x, p.y, p.z);
      if (p.kind === 'egg_grenade') {
        p.mesh.rotation.x += dt * 8;
        p.mesh.rotation.z += dt * 6;
      }

      if (!remove && p.fromPlayer && p.kind !== 'egg_grenade') {
        // Check enemies
        for (const e of this.enemies) {
          if (e.koTimer > 0) continue;
          const dx = p.x - e.x;
          const dz = p.z - e.z;
          const dy = p.y - (e.y + 0.9);
          const r = e.radius + 0.35;
          if (dx * dx + dz * dz <= r * r && Math.abs(dy) < 1.15) {
            if (p.kind === 'rocket') {
              this.triggerExplosion(p.x, p.y, p.z, p.explosionRadius, p.damage, p.knockback);
            } else {
              const isHead = p.y > e.y + 1.18;
              const spec = WEAPONS[p.weaponId];
              const dist = Math.hypot(e.x - this.playerX, e.z - this.playerZ);
              const dmg = calculateDamage(p.damage, dist, spec.range, isHead, e.armor);
              const spd = Math.hypot(p.vx, p.vz) || 1;
              this.damageEnemy(e, dmg, p.vx / spd, p.vz / spd, p.knockback, isHead);
            }
            remove = true;
            break;
          }
        }

        // Check remote players in PvP mode
        if (!remove && this.onlineRoomMode === 'pvp') {
          for (const rp of this.remotePlayers.values()) {
            if (rp.hp <= 0) continue;
            const dx = p.x - rp.x;
            const dz = p.z - rp.z;
            const dy = p.y - (rp.y + 0.9);
            const r = 1.0;
            if (dx * dx + dz * dz <= r * r && Math.abs(dy) < 1.15) {
              if (p.kind === 'rocket') {
                this.triggerExplosion(p.x, p.y, p.z, p.explosionRadius, p.damage, p.knockback);
              } else {
                const isHead = p.y > rp.y + 1.18;
                const spec = WEAPONS[p.weaponId];
                const dist = Math.hypot(rp.x - this.playerX, rp.z - this.playerZ);
                const dmg = calculateDamage(p.damage, dist, spec.range, isHead, 0);
                this.hitRemotePlayer(rp, dmg);
              }
              remove = true;
              break;
            }
          }
        }

        // Check explosive barrels
        if (!remove && this.world) {
          for (const b of this.world.barrels) {
            if (!b.alive) continue;
            if (Math.hypot(p.x - b.x, p.z - b.z) < 0.75 && p.y < 1.4) {
              b.hp -= p.damage;
              if (b.hp <= 0 || p.kind === 'rocket') {
                this.detonateBarrel(b);
              }
              remove = true;
              break;
            }
          }
        }
      } else if (!remove && !p.fromPlayer) {
        const dx = p.x - this.playerX;
        const dz = p.z - this.playerZ;
        const dy = p.y - (this.playerY + 0.9);
        if (dx * dx + dz * dz < 0.75 * 0.75 && Math.abs(dy) < 1.0) {
          this.damagePlayer(p.damage);
          remove = true;
        }
      }

      if (remove) {
        if (p.kind === 'egg_grenade' && p.life <= 0) {
          this.triggerExplosion(p.x, p.y, p.z, p.explosionRadius, p.damage, p.knockback);
        }
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updatePickups(dt: number) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.life -= dt;
      pk.mesh.rotation.y += dt * 2.5;
      pk.mesh.position.y = 0.55 + Math.sin(this.elapsedSeconds * 4 + i) * 0.14;

      const dist = Math.hypot(pk.x - this.playerX, pk.z - this.playerZ);
      if (dist < 1.8) {
        if (pk.kind === 'medkit') {
          this.hp = Math.min(this.maxHp, this.hp + 30);
        } else if (pk.kind === 'ammo') {
          for (const w of WEAPON_ORDER) {
            this.ammo[w] = WEAPONS[w].magSize;
          }
          this.reloadingWeapon = null;
        } else {
          this.coins += 25;
          this.callbacks.onEarnCoins(25);
        }
        gameAudio.playPickup();
        this.spawnParticles(pk.x, 0.7, pk.z, 8, 0xfacc15, 5, 0.12, 8);
        this.scene.remove(pk.mesh);
        this.scene.remove(pk.shadow);
        this.pickups.splice(i, 1);
        this.emitHudSnapshot();
        continue;
      }

      if (pk.life <= 0) {
        this.scene.remove(pk.mesh);
        this.scene.remove(pk.shadow);
        this.pickups.splice(i, 1);
      }
    }
  }

  private updateEffects(dt: number) {
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.life -= dt;
      if (b.life <= 0) {
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        this.beams.splice(i, 1);
      }
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.life -= dt;
      const t = 1 - Math.max(0, s.life / s.maxLife);
      s.mesh.scale.setScalar(1 + t * s.maxRadius);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.85;
      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        this.shockwaves.splice(i, 1);
      }
    }
  }

  private updateParticles(dt: number) {
    let anyActive = false;
    for (let i = 0; i < this.particleCapacity; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyActive = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _mat4.makeScale(0, 0, 0);
        this.particleInstanced.setMatrixAt(i, _mat4);
        continue;
      }
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y = Math.max(0.05, p.y + p.vy * dt);
      p.z += p.vz * dt;

      const s = p.size * (p.life / p.maxLife);
      _v1.set(p.x, p.y, p.z);
      _quat.setFromEuler(new THREE.Euler(p.life * p.rotSpeed, p.life * p.rotSpeed, 0));
      _scale.set(s, s, s);
      _mat4.compose(_v1, _quat, _scale);
      this.particleInstanced.setMatrixAt(i, _mat4);
      this.particleInstanced.setColorAt(i, _color.setHex(p.color));
    }

    if (anyActive) {
      this.particleInstanced.instanceMatrix.needsUpdate = true;
      if (this.particleInstanced.instanceColor) {
        this.particleInstanced.instanceColor.needsUpdate = true;
      }
    }
  }

  private updateCameraRig(dt: number) {
    const aimDir = this.getAimDirection(_dir);
    let desiredX: number;
    let desiredY: number;
    let desiredZ: number;
    let lookX: number;
    let lookY: number;
    let lookZ: number;

    if (this.firstPerson && !this.inVehicle) {
      desiredX = this.playerX;
      desiredY = this.playerY + 1.48;
      desiredZ = this.playerZ;
      lookX = desiredX + aimDir.x * 16;
      lookY = desiredY + aimDir.y * 16;
      lookZ = desiredZ + aimDir.z * 16;
    } else {
      const dist = this.inVehicle ? 8.2 : 5.4;
      const height = this.inVehicle ? 3.1 : 2.35;
      const shoulder = this.inVehicle ? 0 : 0.75;
      const rightX = Math.cos(this.playerYaw) * shoulder;
      const rightZ = -Math.sin(this.playerYaw) * shoulder;

      const anchorX = this.playerX + rightX;
      const anchorY = this.playerY + 1.35;
      const anchorZ = this.playerZ + rightZ;

      desiredX = anchorX - aimDir.x * dist;
      desiredY = Math.max(0.65, anchorY - aimDir.y * dist + (height - 1.35));
      desiredZ = anchorZ - aimDir.z * dist;

      // Wall pull-in raycast against arena world obstacles
      if (this.world) {
        _rayOrigin.set(anchorX, anchorY, anchorZ);
        _v2.set(desiredX - anchorX, desiredY - anchorY, desiredZ - anchorZ);
        const fullDist = _v2.length();
        if (fullDist > 0.1) {
          _v2.divideScalar(fullDist);
          this.raycaster.set(_rayOrigin, _v2);
          this.raycaster.far = fullDist;
          const hits = this.raycaster.intersectObjects(this.world.raycastTargets, true);
          if (hits.length > 0 && hits[0].distance > 0.8 && hits[0].distance < fullDist) {
            const safeDist = Math.max(1.2, hits[0].distance - 0.35);
            desiredX = anchorX + _v2.x * safeDist;
            desiredY = Math.max(0.65, anchorY + _v2.y * safeDist);
            desiredZ = anchorZ + _v2.z * safeDist;
          }
        }
      }

      lookX = anchorX + aimDir.x * 18;
      lookY = anchorY + aimDir.y * 18;
      lookZ = anchorZ + aimDir.z * 18;
    }

    const dampK = this.firstPerson ? 26 : 14;
    this.camPos.x = THREE.MathUtils.damp(this.camPos.x, desiredX, dampK, dt);
    this.camPos.y = THREE.MathUtils.damp(this.camPos.y, desiredY, dampK, dt);
    this.camPos.z = THREE.MathUtils.damp(this.camPos.z, desiredZ, dampK, dt);

    this.camLook.x = THREE.MathUtils.damp(this.camLook.x, lookX, 18, dt);
    this.camLook.y = THREE.MathUtils.damp(this.camLook.y, lookY, 18, dt);
    this.camLook.z = THREE.MathUtils.damp(this.camLook.z, lookZ, 18, dt);

    const shake = this.trauma * this.trauma * 0.32;
    this.camera.position.set(
      this.camPos.x + (Math.random() - 0.5) * shake,
      this.camPos.y + (Math.random() - 0.5) * shake,
      this.camPos.z + (Math.random() - 0.5) * shake,
    );
    this.camera.lookAt(this.camLook);

    const targetFov = 65 + this.fovKick + (this.inVehicle ? Math.min(8, Math.abs(this.buggySpeed) * 0.35) : 0);
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }
  }

  private buildSnapshot(): HudSnapshot {
    const blips: MinimapBlip[] = [];
    let bossName: string | null = null;
    let bossHp = 0;
    let bossMaxHp = 0;

    for (const e of this.enemies) {
      if (e.koTimer > 0) continue;
      blips.push({ x: e.x, z: e.z, kind: e.archetype === 'tank_boss' ? 'boss' : 'enemy' });
      if (e.archetype === 'tank_boss') {
        bossName = 'CHEFE TANQUE-GALO';
        bossHp = e.hp;
        bossMaxHp = e.maxHp;
      }
    }
    if (this.buggy) {
      blips.push({ x: this.buggyX, z: this.buggyZ, kind: 'vehicle' });
    }
    for (const t of this.turrets) {
      blips.push({ x: t.x, z: t.z, kind: 'turret' });
    }
    for (const rp of this.remotePlayers.values()) {
      if (rp.hp > 0) {
        blips.push({ x: rp.x, z: rp.z, kind: 'remote' });
      }
    }

    const nearVehicle =
      !this.inVehicle && Math.hypot(this.playerX - this.buggyX, this.playerZ - this.buggyZ) <= 4.6;

    const reloadSpec = this.reloadingWeapon ? WEAPONS[this.reloadingWeapon] : null;
    const reloadProgress =
      reloadSpec && reloadSpec.reloadTime > 0
        ? 1 - Math.max(0, this.reloadTimer) / reloadSpec.reloadTime
        : 0;

    return {
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      jetpack: Math.round(this.jetpack),
      maxJetpack: this.maxJetpack,
      score: Math.round(this.score),
      bestScore: Math.round(this.bestScore),
      coins: Math.round(this.coins),
      kills: this.kills,
      combo: this.combo,
      comboTimer: this.comboTimer,
      wave: this.wave,
      waveEnemiesRemaining: this.enemies.length + this.waveRemainingToSpawn,
      waveBanner: this.waveBanner,
      activeWeapon: this.activeWeapon,
      ammo: { ...this.ammo },
      reloadingWeapon: this.reloadingWeapon,
      reloadProgress,
      grenadeCooldown: this.grenadeCooldown,
      grenadeMaxCooldown: this.grenadeMaxCooldown,
      buildMode: this.buildMode,
      selectedBuildProp: this.selectedBuildProp,
      inVehicle: this.inVehicle,
      nearVehicle,
      vehicleSpeed: Math.round(Math.abs(this.buggySpeed) * 3.6),
      firstPerson: this.firstPerson,
      pointerLocked: this.pointerLocked,
      hitmarkerKind: this.hitmarkerKind,
      bossName,
      bossHp: Math.round(bossHp),
      bossMaxHp: Math.round(bossMaxHp),
      playerX: this.playerX,
      playerZ: this.playerZ,
      playerYaw: this.playerYaw,
      blips,
      outcome: this.outcome,
      elapsedSeconds: Math.round(this.elapsedSeconds),
      damageTaken: Math.round(this.damageTaken),
    };
  }

  private emitHudSnapshot() {
    this.callbacks.onHudUpdate(this.buildSnapshot());
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.domElement.removeEventListener('mousedown', this.onCanvasMouseDown);
    window.removeEventListener('mouseup', this.onWindowMouseUp);
    window.removeEventListener('mousemove', this.onWindowMouseMove);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);

    if (this.textures) this.textures.dispose();
    this.bulletGeo.dispose();
    this.rocketGeo.dispose();
    this.eggGeo.dispose();
    this.shadowGeo.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
