import { useCallback, useEffect, useRef, useState } from 'react';
import { ArmoryModal } from './components/ArmoryModal';
import { GameHud } from './components/GameHud';
import { MobileControls } from './components/MobileControls';
import { OnlineRoomModal } from './components/OnlineRoomModal';
import { StatusModal } from './components/StatusModal';
import { TitleScreen } from './components/TitleScreen';
import { GaloStrikeEngine } from './game/engine';
import { OnlineRoomManager } from './game/network';
import { purchaseCosmetic } from './game/rules';
import {
  ArenaMapId,
  BuildPropType,
  GameMode,
  GameScreenState,
  HudSnapshot,
  OnlineRoomMode,
  PlayerCustomization,
  RoomSessionState,
  WEAPONS,
  WeaponId,
} from './game/types';

const SAVE_KEY = 'galo_strike_save_v1';

interface SavedProfile {
  coins: number;
  bestScore: number;
  playerName?: string;
  customization: PlayerCustomization;
}

const DEFAULT_CUSTOMIZATION: PlayerCustomization = {
  skin: 'classic',
  hat: 'helmet',
  visor: 'shades',
  unlockedSkins: ['classic'],
  unlockedHats: ['none', 'helmet'],
  unlockedVisors: ['none', 'shades'],
  unlockedWeapons: ['ak_galo', 'shotgun', 'bazooka', 'pan'],
};

function loadSavedProfile(): SavedProfile {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedProfile>;
      return {
        coins: typeof parsed.coins === 'number' ? parsed.coins : 200,
        bestScore: typeof parsed.bestScore === 'number' ? parsed.bestScore : 0,
        playerName: typeof parsed.playerName === 'string' ? parsed.playerName : 'Galo Bravo',
        customization: {
          ...DEFAULT_CUSTOMIZATION,
          ...(parsed.customization ?? {}),
        },
      };
    }
  } catch {
    // Ignore storage errors
  }
  return {
    coins: 200,
    bestScore: 0,
    playerName: 'Galo Bravo',
    customization: DEFAULT_CUSTOMIZATION,
  };
}

const INITIAL_HUD: HudSnapshot = {
  hp: 100,
  maxHp: 100,
  jetpack: 100,
  maxJetpack: 100,
  score: 0,
  bestScore: 0,
  coins: 200,
  kills: 0,
  combo: 0,
  comboTimer: 0,
  wave: 1,
  waveEnemiesRemaining: 0,
  waveBanner: null,
  activeWeapon: 'ak_galo',
  ammo: {
    ak_galo: WEAPONS.ak_galo.magSize,
    shotgun: WEAPONS.shotgun.magSize,
    bazooka: WEAPONS.bazooka.magSize,
    laser: WEAPONS.laser.magSize,
    pan: WEAPONS.pan.magSize,
  },
  reloadingWeapon: null,
  reloadProgress: 0,
  grenadeCooldown: 0,
  grenadeMaxCooldown: 4.5,
  buildMode: false,
  selectedBuildProp: 'crate',
  inVehicle: false,
  nearVehicle: false,
  vehicleSpeed: 0,
  firstPerson: false,
  pointerLocked: false,
  hitmarkerKind: 'none',
  bossName: null,
  bossHp: 0,
  bossMaxHp: 0,
  playerX: 0,
  playerZ: 10,
  playerYaw: 0,
  blips: [],
  outcome: 'none',
  elapsedSeconds: 0,
  damageTaken: 0,
};

const INITIAL_ROOM_SESSION: RoomSessionState = {
  status: 'idle',
  role: 'none',
  roomCode: '',
  localId: '',
  mapId: 'farm',
  roomMode: 'pvp',
  players: [],
  error: null,
};

export default function App() {
  const initialSave = useRef<SavedProfile>(loadSavedProfile());
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GaloStrikeEngine | null>(null);
  const roomManagerRef = useRef<OnlineRoomManager | null>(null);

  const [screenState, setScreenState] = useState<GameScreenState>('title');
  const [mode, setMode] = useState<GameMode>('survival');
  const [mapId, setMapId] = useState<ArenaMapId>('farm');
  const [armoryOpen, setArmoryOpen] = useState(false);
  const [onlineOpen, setOnlineOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [touchEnabled, setTouchEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia?.('(pointer: coarse)')?.matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0
    );
  });

  const [playerName, setPlayerName] = useState(initialSave.current.playerName ?? 'Galo Bravo');
  const [roomSession, setRoomSession] = useState<RoomSessionState>(INITIAL_ROOM_SESSION);
  const [coins, setCoins] = useState(initialSave.current.coins);
  const [bestScore, setBestScore] = useState(initialSave.current.bestScore);
  const [customization, setCustomization] = useState<PlayerCustomization>(
    initialSave.current.customization,
  );
  const [hud, setHud] = useState<HudSnapshot>({
    ...INITIAL_HUD,
    coins: initialSave.current.coins,
    bestScore: initialSave.current.bestScore,
  });

  // Refs so Three.js mount effect never tears down on state changes
  const coinsRef = useRef(coins);
  const bestScoreRef = useRef(bestScore);
  const customizationRef = useRef(customization);
  const playerNameRef = useRef(playerName);
  const screenStateRef = useRef(screenState);
  const armoryOpenRef = useRef(armoryOpen);
  const onlineOpenRef = useRef(onlineOpen);
  const roomSessionRef = useRef(roomSession);

  coinsRef.current = coins;
  bestScoreRef.current = bestScore;
  customizationRef.current = customization;
  playerNameRef.current = playerName;
  screenStateRef.current = screenState;
  armoryOpenRef.current = armoryOpen;
  onlineOpenRef.current = onlineOpen;
  roomSessionRef.current = roomSession;

  const persistSave = useCallback(
    (nextCoins: number, nextBest: number, nextCust: PlayerCustomization, nextName?: string) => {
      try {
        localStorage.setItem(
          SAVE_KEY,
          JSON.stringify({
            coins: nextCoins,
            bestScore: nextBest,
            playerName: nextName ?? playerNameRef.current,
            customization: nextCust,
          }),
        );
      } catch {
        // Ignore storage quota errors
      }
    },
    [],
  );

  // Sync fullscreen state listener
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (mode: string) => Promise<void>;
        };
        await orientation?.lock?.('landscape').catch(() => {});
      } else {
        await document.exitFullscreen?.();
        screen.orientation?.unlock?.();
      }
    } catch {
      // Ignore in restricted iframe/desktop environments without orientation lock support
    }
  }, []);

  // Mount Three.js engine & OnlineRoomManager once
  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    document.body.dataset.state = 'title';

    const roomMgr = new OnlineRoomManager({
      onSessionChange: (nextSession) => {
        setRoomSession(nextSession);
      },
      onMatchStart: (matchMap, matchMode) => {
        setOnlineOpen(false);
        setArmoryOpen(false);
        setMapId(matchMap);
        setMode('survival');
        const current = roomMgr.getState();
        const idx = Math.max(
          0,
          current.players.findIndex((p) => p.id === current.localId),
        );
        engineRef.current?.startGame('survival', matchMap, matchMode, idx);
      },
      onRemotePlayersUpdate: (remoteList) => {
        engineRef.current?.syncRemotePlayers(remoteList);
      },
      onRemoteFire: (ev) => {
        engineRef.current?.spawnRemoteFire(ev);
      },
      onLocalDamaged: (damage) => {
        engineRef.current?.applyRemoteDamage(damage);
      },
    });
    roomManagerRef.current = roomMgr;

    const engine = new GaloStrikeEngine(
      mountEl,
      customizationRef.current,
      coinsRef.current,
      bestScoreRef.current,
      {
        onHudUpdate: (snap) => {
          setHud(snap);
        },
        onGameOver: (snap) => {
          setHud(snap);
          if (snap.bestScore > bestScoreRef.current) {
            setBestScore(snap.bestScore);
            persistSave(coinsRef.current, snap.bestScore, customizationRef.current);
          }
        },
        onStateChange: (next) => {
          setScreenState(next);
          document.body.dataset.state = next;
        },
        onSpendCoins: (amount) => {
          if (coinsRef.current < amount) return false;
          const next = coinsRef.current - amount;
          coinsRef.current = next;
          setCoins(next);
          persistSave(next, bestScoreRef.current, customizationRef.current);
          return true;
        },
        onEarnCoins: (amount) => {
          const next = coinsRef.current + amount;
          coinsRef.current = next;
          setCoins(next);
          persistSave(next, bestScoreRef.current, customizationRef.current);
        },
        onNetworkSync: (localState) => {
          roomMgr.sendLocalState(localState);
        },
        onNetworkFire: (fireEv) => {
          roomMgr.sendFireEvent(fireEv);
        },
        onNetworkHit: (targetId, damage) => {
          roomMgr.sendHitEvent(targetId, damage);
        },
      },
    );

    engineRef.current = engine;

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.startGame();
    }

    return () => {
      roomMgr.leaveRoom();
      roomManagerRef.current = null;
      engine.dispose();
      engineRef.current = null;
    };
  }, [persistSave]);

  const handleStartGame = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setArmoryOpen(false);
    setOnlineOpen(false);
    const activeOnline =
      roomSessionRef.current.status === 'playing' ? roomSessionRef.current.roomMode : null;
    const spawnIdx = activeOnline
      ? Math.max(
          0,
          roomSessionRef.current.players.findIndex((p) => p.id === roomSessionRef.current.localId),
        )
      : 0;
    engineRef.current?.startGame(mode, mapId, activeOnline, spawnIdx);
  }, [mode, mapId]);

  const handleSelectMode = useCallback((nextMode: GameMode) => {
    setMode(nextMode);
    engineRef.current?.setMode(nextMode);
  }, []);

  const handleSelectMap = useCallback((nextMap: ArenaMapId) => {
    setMapId(nextMap);
    engineRef.current?.setMap(nextMap);
  }, []);

  const handlePurchaseOrEquip = useCallback(
    (category: 'skin' | 'hat' | 'visor' | 'weapon', itemId: string, cost: number) => {
      const res = purchaseCosmetic(customizationRef.current, coinsRef.current, category, itemId, cost);
      if (!res.ok) return;
      coinsRef.current = res.nextCoins;
      customizationRef.current = res.nextCustomization;
      setCoins(res.nextCoins);
      setCustomization(res.nextCustomization);
      persistSave(res.nextCoins, bestScoreRef.current, res.nextCustomization);
      engineRef.current?.setCustomization(res.nextCustomization, res.nextCoins);
    },
    [persistSave],
  );

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      engineRef.current?.setMuted(next);
      return next;
    });
  }, []);

  // Global keyboard shortcuts (Title Enter/Space start, M mute)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      if (inInput) return;

      if (e.code === 'KeyM') {
        handleToggleMute();
        return;
      }
      if (
        screenStateRef.current === 'title' &&
        !armoryOpenRef.current &&
        !onlineOpenRef.current &&
        (e.code === 'Enter' || e.code === 'Space')
      ) {
        e.preventDefault();
        handleStartGame();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleStartGame, handleToggleMute]);

  const activeRoomCode = roomSession.status === 'playing' ? roomSession.roomCode : undefined;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-900">
      {/* Dedicated isolated WebGL canvas container */}
      <div
        ref={canvasMountRef}
        data-testid="game-canvas-container"
        className="fixed inset-0 w-full h-full"
      />

      {screenState === 'title' && (
        <TitleScreen
          mode={mode}
          mapId={mapId}
          coins={coins}
          bestScore={bestScore}
          isFullscreen={isFullscreen}
          onSelectMode={handleSelectMode}
          onSelectMap={handleSelectMap}
          onStart={handleStartGame}
          onOpenOnline={() => setOnlineOpen(true)}
          onOpenArmory={() => setArmoryOpen(true)}
          onToggleFullscreen={handleToggleFullscreen}
        />
      )}

      {screenState === 'title' && armoryOpen && (
        <ArmoryModal
          customization={customization}
          coins={coins}
          onPurchaseOrEquip={handlePurchaseOrEquip}
          onClose={() => setArmoryOpen(false)}
        />
      )}

      {screenState === 'title' && onlineOpen && (
        <OnlineRoomModal
          session={roomSession}
          playerName={playerName}
          defaultMapId={mapId}
          onChangeName={(name) => {
            setPlayerName(name);
            persistSave(coinsRef.current, bestScoreRef.current, customizationRef.current, name);
          }}
          onCreateRoom={(roomMap, roomMode) => {
            roomManagerRef.current?.createRoom(playerName, customizationRef.current, roomMap, roomMode);
          }}
          onJoinRoom={(code) => {
            roomManagerRef.current?.joinRoom(code, playerName, customizationRef.current);
          }}
          onUpdateSettings={(roomMap, roomMode) => {
            roomManagerRef.current?.updateRoomSettings(roomMap, roomMode);
          }}
          onStartMatch={() => {
            roomManagerRef.current?.startMatch();
          }}
          onLeaveRoom={() => {
            roomManagerRef.current?.leaveRoom();
          }}
          onClose={() => setOnlineOpen(false)}
        />
      )}

      {(screenState === 'playing' || screenState === 'paused') && (
        <GameHud
          hud={hud}
          mode={mode}
          customization={customization}
          muted={muted}
          isFullscreen={isFullscreen}
          touchEnabled={touchEnabled}
          roomCode={activeRoomCode}
          roomPlayerCount={roomSession.players.length}
          onSelectWeapon={(w: WeaponId) => engineRef.current?.selectWeapon(w)}
          onToggleBuildMode={() => engineRef.current?.toggleBuildMode()}
          onSelectBuildProp={(p: BuildPropType) => engineRef.current?.cycleBuildProp(p)}
          onToggleMute={handleToggleMute}
          onToggleCamera={() => engineRef.current?.toggleFirstPerson()}
          onToggleFullscreen={handleToggleFullscreen}
          onToggleTouch={() => setTouchEnabled((prev) => !prev)}
          onPause={() => engineRef.current?.setPaused(true)}
        />
      )}

      {screenState === 'playing' && touchEnabled && (
        <MobileControls
          nearVehicle={hud.nearVehicle}
          inVehicle={hud.inVehicle}
          grenadeCooldown={hud.grenadeCooldown}
          onMove={(x, y) => engineRef.current?.setTouchMove(x, y)}
          onAimDelta={(dx, dy) => engineRef.current?.addTouchAimDelta(dx, dy)}
          onFire={(active) => engineRef.current?.setTouchFire(active)}
          onJump={(active) => engineRef.current?.setTouchJump(active)}
          onGrenade={() => engineRef.current?.triggerGrenade()}
          onVehicleToggle={() => engineRef.current?.triggerVehicleToggle()}
          onReload={() => engineRef.current?.triggerReload()}
        />
      )}

      <StatusModal
        screenState={screenState}
        hud={hud}
        onResume={() => engineRef.current?.setPaused(false)}
        onRestart={handleStartGame}
        onReturnToTitle={() => {
          roomManagerRef.current?.leaveRoom();
          engineRef.current?.returnToTitle();
        }}
      />
    </main>
  );
}
