import React, { useEffect, useState } from 'react';
import {
  BUILD_PROPS,
  BuildPropType,
  GameMode,
  HudSnapshot,
  PlayerCustomization,
  WEAPON_ORDER,
  WEAPONS,
  WeaponId,
} from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  mode: GameMode;
  customization: PlayerCustomization;
  muted: boolean;
  isFullscreen: boolean;
  touchEnabled: boolean;
  roomCode?: string;
  roomPlayerCount?: number;
  onSelectWeapon: (id: WeaponId) => void;
  onToggleBuildMode: () => void;
  onSelectBuildProp: (prop: BuildPropType) => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleFullscreen: () => void;
  onToggleTouch: () => void;
  onPause: () => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  mode,
  customization,
  muted,
  isFullscreen,
  touchEnabled,
  roomCode,
  roomPlayerCount,
  onSelectWeapon,
  onToggleBuildMode,
  onSelectBuildProp,
  onToggleMute,
  onToggleCamera,
  onToggleFullscreen,
  onToggleTouch,
  onPause,
}) => {
  const [ghostHp, setGhostHp] = useState(hud.hp);

  useEffect(() => {
    if (hud.hp < ghostHp) {
      const t = window.setTimeout(() => setGhostHp(hud.hp), 280);
      return () => window.clearTimeout(t);
    }
    setGhostHp(hud.hp);
  }, [hud.hp, ghostHp]);

  const hpPct = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));
  const ghostPct = Math.max(hpPct, Math.min(100, (ghostHp / hud.maxHp) * 100));
  const jetPct = Math.max(0, Math.min(100, (hud.jetpack / hud.maxJetpack) * 100));
  const lowHp = hud.hp <= 30;
  const activeSpec = WEAPONS[hud.activeWeapon];

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none">
      {/* Critical low-HP peripheral vignette */}
      {lowHp && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 90px rgba(220, 38, 38, 0.55)',
          }}
        />
      )}

      {/* Exact Center (50%, 50%) Reticle & Hitmarker */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
          {/* Outer reticle */}
          <line x1="22" y1="6" x2="22" y2="14" stroke="#f8fafc" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="22" y1="30" x2="22" y2="38" stroke="#f8fafc" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="6" y1="22" x2="14" y2="22" stroke="#f8fafc" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="30" y1="22" x2="38" y2="22" stroke="#f8fafc" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="22" cy="22" r="2" fill="#f59e0b" />

          {/* Hitmarker X */}
          {hud.hitmarkerKind !== 'none' && (
            <g
              stroke={hud.hitmarkerKind === 'kill' ? '#ef4444' : '#ffffff'}
              strokeWidth={hud.hitmarkerKind === 'kill' ? '3' : '2.2'}
              strokeLinecap="round"
            >
              <line x1="12" y1="12" x2="17" y2="17" />
              <line x1="32" y1="12" x2="27" y2="17" />
              <line x1="12" y1="32" x2="17" y2="27" />
              <line x1="32" y1="32" x2="27" y2="27" />
            </g>
          )}
        </svg>

        {hud.reloadingWeapon && (
          <div className="mt-1 text-center text-[11px] font-mono-num font-bold text-amber-300 hud-stroke">
            RECARREGANDO {Math.round(hud.reloadProgress * 100)}%
          </div>
        )}
      </div>

      {/* Top-Left Cluster: Wave / Score / Kills / Coins */}
      <div className="fixed top-3 left-3 sm:top-4 sm:left-4 flex items-start gap-3 sm:gap-4 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-slate-950/80 border border-slate-700/80 shadow-lg">
        <div>
          <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
            {roomCode ? `SALA ${roomCode} · ${roomPlayerCount ?? 1}P` : mode === 'sandbox' ? 'SANDBOX' : `ONDA ${hud.wave}`}
          </div>
          <div className="font-display text-2xl sm:text-3xl font-extrabold text-white font-mono-num leading-none hud-stroke">
            {hud.score}
          </div>
        </div>
        <div className="h-8 sm:h-9 w-px bg-slate-700/80 self-center" />
        <div className="flex items-center gap-3 sm:gap-4 text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Abates</div>
            <div className="text-base sm:text-lg font-bold text-slate-100 font-mono-num leading-tight">{hud.kills}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">MilhoCoins</div>
            <div className="text-base sm:text-lg font-bold text-amber-400 font-mono-num leading-tight">{hud.coins}</div>
          </div>
          {hud.combo > 1 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-amber-300">Combo</div>
              <div className="text-base sm:text-lg font-extrabold text-amber-400 font-mono-num leading-tight">
                x{hud.combo}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top-Center: Boss Bar or Wave Banner */}
      {(hud.bossName || hud.waveBanner) && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none">
          {hud.waveBanner && (
            <div className="px-5 py-1.5 rounded-md bg-amber-500 text-slate-950 font-display text-xl font-extrabold tracking-wider shadow-lg">
              {hud.waveBanner}
            </div>
          )}
          {hud.bossName && (
            <div className="w-72 px-3 py-2 rounded-lg bg-slate-950/88 border border-rose-500/60 shadow-lg">
              <div className="flex justify-between text-[11px] font-bold text-rose-300 mb-1">
                <span>{hud.bossName}</span>
                <span className="font-mono-num">
                  {hud.bossHp}/{hud.bossMaxHp}
                </span>
              </div>
              <div className="h-2.5 w-full rounded bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-rose-500 transition-transform origin-left"
                  style={{
                    transform: `scaleX(${Math.max(0, hud.bossHp / Math.max(1, hud.bossMaxHp))})`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top-Right Cluster: Utility Square Icon Buttons + Circular Radar Minimap */}
      <div className="fixed top-3 right-3 sm:top-4 sm:right-4 flex items-start gap-2.5 sm:gap-3">
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            tabIndex={-1}
            data-touch-toggle="true"
            aria-label={touchEnabled ? 'Ocultar controles touch' : 'Ativar controles touch'}
            title="Controles Touch (Celular)"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleTouch();
            }}
            className={`w-11 h-11 rounded-lg border flex items-center justify-center text-[11px] font-bold transition-colors ${
              touchEnabled
                ? 'bg-amber-500 text-slate-950 border-amber-300'
                : 'bg-slate-950/85 hover:bg-slate-800 border-slate-700 text-slate-200'
            }`}
          >
            PAD
          </button>

          <button
            type="button"
            tabIndex={-1}
            data-fullscreen-btn="true"
            aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia e girar tela'}
            title="Tela cheia e girar para paisagem"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleFullscreen();
            }}
            className={`w-11 h-11 rounded-lg border flex items-center justify-center transition-colors ${
              isFullscreen
                ? 'bg-sky-500 text-slate-950 border-sky-300'
                : 'bg-slate-950/85 hover:bg-slate-800 border-slate-700 text-slate-200'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              {isFullscreen ? (
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              ) : (
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              )}
            </svg>
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label={muted ? 'Ativar áudio' : 'Silenciar áudio'}
            title="Áudio [M]"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="w-11 h-11 rounded-lg bg-slate-950/85 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
              {muted ? (
                <>
                  <line x1="22" y1="9" x2="16" y2="15" stroke="#ef4444" strokeWidth="2.4" />
                  <line x1="16" y1="9" x2="22" y2="15" stroke="#ef4444" strokeWidth="2.4" />
                </>
              ) : (
                <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
              )}
            </svg>
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Alternar câmera 1ª/3ª pessoa"
            title="Câmera [V]"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleCamera();
            }}
            className="w-11 h-11 rounded-lg bg-slate-950/85 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 text-xs font-mono-num font-bold transition-colors"
          >
            {hud.firstPerson ? '1P' : '3P'}
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Pausar jogo"
            title="Pausar [P / Esc]"
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            className="w-11 h-11 rounded-lg bg-slate-950/85 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          </button>
        </div>

        {/* Circular Radar Minimap */}
        <svg
          width="88"
          height="88"
          viewBox="-56 -56 112 112"
          className="rounded-full bg-slate-950/85 border-2 border-slate-700 shadow-lg hidden md:block"
          aria-label="Radar da Arena"
        >
          <circle cx="0" cy="0" r="54" fill="none" stroke="rgba(148,163,184,0.22)" strokeWidth="1" />
          <circle cx="0" cy="0" r="28" fill="none" stroke="rgba(148,163,184,0.16)" strokeWidth="1" />
          <line x1="-54" y1="0" x2="54" y2="0" stroke="rgba(148,163,184,0.14)" strokeWidth="1" />
          <line x1="0" y1="-54" x2="0" y2="54" stroke="rgba(148,163,184,0.14)" strokeWidth="1" />

          {hud.blips.map((b, idx) => {
            const dx = b.x - hud.playerX;
            const dz = b.z - hud.playerZ;
            const rx = Math.max(-48, Math.min(48, dx));
            const rz = Math.max(-48, Math.min(48, dz));
            const fill =
              b.kind === 'boss'
                ? '#f43f5e'
                : b.kind === 'enemy'
                  ? '#ef4444'
                  : b.kind === 'remote'
                    ? '#a855f7'
                    : b.kind === 'vehicle'
                      ? '#facc15'
                      : '#38bdf8';
            const r = b.kind === 'boss' ? 5.2 : b.kind === 'vehicle' || b.kind === 'remote' ? 4.2 : 3.2;
            return <circle key={idx} cx={rx} cy={rz} r={r} fill={fill} />;
          })}

          {/* Player arrow rotated by yaw */}
          <g transform={`rotate(${(-hud.playerYaw * 180) / Math.PI})`}>
            <polygon points="0,-7 5,5 0,2 -5,5" fill="#22c55e" />
          </g>
        </svg>
      </div>

      {/* Vitality Cluster: Below Score on <lg (so bottom corners stay free for weapon bar & touch stick), Bottom-Left on Desktop */}
      <div className="fixed top-20 left-3 sm:top-24 sm:left-4 lg:top-auto lg:bottom-4 space-y-1.5 w-44 sm:w-52 lg:w-64">
        {(hud.nearVehicle || hud.inVehicle) && (
          <div className="px-3 py-1 rounded-md bg-amber-500 text-slate-950 text-[11px] sm:text-xs font-bold inline-block shadow">
            {hud.inVehicle
              ? `Buggy · ${hud.vehicleSpeed} km/h · [E] Sair`
              : '[E] Dirigir Buggy'}
          </div>
        )}

        <div className="px-3 py-2 rounded-lg bg-slate-950/85 border border-slate-700/80 shadow-lg space-y-1.5">
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Vida
              </span>
              <span className="font-mono-num text-base sm:text-lg font-extrabold text-white leading-none">
                {hud.hp}
              </span>
            </div>
            <div className="relative h-2.5 sm:h-3 w-full rounded bg-slate-800 overflow-hidden">
              {/* Delayed damage ghost bar */}
              <div
                className="absolute inset-y-0 left-0 bg-amber-300/80 transition-all duration-300"
                style={{ width: `${ghostPct}%` }}
              />
              {/* Active vitality fill */}
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-100 ${
                  lowHp ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${hpPct}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                Jetpack
              </span>
              <span className="font-mono-num text-[11px] sm:text-xs font-bold text-sky-200">{hud.jetpack}%</span>
            </div>
            <div className="h-1.5 w-full rounded bg-slate-800 overflow-hidden">
              <div className="h-full bg-sky-400" style={{ width: `${jetPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom-Center Cluster: 5 Weapon Slots + Grenade + Sandbox Builder */}
      <div className="fixed bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 max-w-[calc(100vw-16px)] flex flex-col items-center gap-1.5">
        {hud.buildMode && (
          <div className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950/90 border border-sky-400/70 shadow-lg overflow-x-auto max-w-full">
            <span className="text-[11px] font-bold text-sky-300 mr-1 whitespace-nowrap">
              Construir [Q]:
            </span>
            {BUILD_PROPS.map((p) => (
              <button
                key={p.id}
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onSelectBuildProp(p.id);
                }}
                className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap transition-colors ${
                  hud.selectedBuildProp === p.id
                    ? 'bg-sky-400 text-slate-950'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {p.name}
                {p.cost > 0 ? ` (${p.cost})` : ''}
              </button>
            ))}
          </div>
        )}

        <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 rounded-xl bg-slate-950/88 border border-slate-700/80 shadow-xl max-w-full overflow-x-auto">
          {WEAPON_ORDER.map((wId) => {
            const spec = WEAPONS[wId];
            const unlocked = customization.unlockedWeapons.includes(wId);
            const active = hud.activeWeapon === wId && !hud.buildMode;
            const ammoVal = hud.ammo[wId];

            return (
              <button
                key={wId}
                type="button"
                tabIndex={-1}
                disabled={!unlocked}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onSelectWeapon(wId);
                }}
                className={`px-2.5 py-1.5 rounded-lg border text-left transition-colors min-w-[82px] ${
                  active
                    ? 'bg-amber-500 text-slate-950 border-amber-300'
                    : unlocked
                      ? 'bg-slate-900 text-slate-200 border-slate-700/70 hover:border-slate-500'
                      : 'bg-slate-900/50 text-slate-500 border-slate-800 opacity-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono-num font-bold opacity-80">[{spec.key}]</span>
                  <span className="text-xs font-mono-num font-bold">
                    {spec.isMelee ? '∞' : `${ammoVal}/${spec.magSize}`}
                  </span>
                </div>
                <div className="text-[11px] font-bold truncate mt-0.5">{spec.name}</div>
              </button>
            );
          })}

          <div className="h-8 w-px bg-slate-700 mx-0.5" />

          {/* Egg Grenade status */}
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700/70 text-slate-200 min-w-[78px]">
            <div className="flex items-center justify-between gap-2 text-[10px] font-mono-num">
              <span>[G]</span>
              <span className={hud.grenadeCooldown > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                {hud.grenadeCooldown > 0 ? `${hud.grenadeCooldown.toFixed(1)}s` : 'Pronta'}
              </span>
            </div>
            <div className="text-[11px] font-bold truncate mt-0.5">Ovo TNT</div>
          </div>

          {/* Sandbox Builder toggle */}
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleBuildMode();
            }}
            className={`px-2.5 py-1.5 rounded-lg border text-left transition-colors min-w-[76px] ${
              hud.buildMode
                ? 'bg-sky-400 text-slate-950 border-sky-200'
                : 'bg-slate-900 text-slate-200 border-slate-700/70 hover:border-slate-500'
            }`}
          >
            <div className="text-[10px] font-mono-num font-bold">[B]</div>
            <div className="text-[11px] font-bold truncate mt-0.5">Construir</div>
          </button>
        </div>

        {/* Active weapon concise role clue */}
        <div className="text-[11px] text-slate-200/90 hud-stroke font-medium">
          {activeSpec.name} · {activeSpec.role}
        </div>
      </div>
    </div>
  );
};
