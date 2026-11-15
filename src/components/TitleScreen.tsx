import React from 'react';
import { ARENA_MAPS, ArenaMapId, GameMode } from '../game/types';

interface TitleScreenProps {
  mode: GameMode;
  mapId: ArenaMapId;
  coins: number;
  bestScore: number;
  isFullscreen: boolean;
  onSelectMode: (mode: GameMode) => void;
  onSelectMap: (mapId: ArenaMapId) => void;
  onStart: () => void;
  onOpenOnline: () => void;
  onOpenArmory: () => void;
  onToggleFullscreen: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  mode,
  mapId,
  coins,
  bestScore,
  isFullscreen,
  onSelectMode,
  onSelectMap,
  onStart,
  onOpenOnline,
  onOpenArmory,
  onToggleFullscreen,
}) => {
  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 sm:p-6 md:p-10 overflow-y-auto">
      {/* Subtle left scrim for crisp text legibility without obscuring the 3D chicken showcase */}
      <div
        className="pointer-events-none fixed inset-y-0 left-0 w-full md:w-[48%] -z-10"
        style={{
          background:
            'linear-gradient(90deg, rgba(15, 23, 42, 0.88) 0%, rgba(15, 23, 42, 0.62) 68%, rgba(15, 23, 42, 0) 100%)',
        }}
      />

      {/* Top row: minimal currency & best score readout + Fullscreen & Rotate button */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-slate-300 font-mono-num">
          <span>
            MilhoCoins: <strong className="text-amber-400">{coins}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Recorde: <strong className="text-white">{bestScore}</strong>
          </span>
        </div>

        <button
          type="button"
          data-fullscreen-btn="true"
          onClick={onToggleFullscreen}
          aria-label="Tela cheia e girar para paisagem"
          title="Tela cheia e girar tela para celular"
          className="pointer-events-auto min-h-[44px] px-3.5 py-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-600 text-slate-100 text-xs font-bold flex items-center gap-2 transition-colors whitespace-nowrap"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            {isFullscreen ? (
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            ) : (
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            )}
          </svg>
          <span>{isFullscreen ? 'Sair Tela Cheia' : 'Tela Cheia · Girar'}</span>
        </button>
      </div>

      {/* Main Left-Third Lockup & Primary Controls */}
      <div className="pointer-events-auto max-w-md space-y-4 sm:space-y-5 my-auto py-3">
        {/* Bespoke Inline SVG Title Emblem */}
        <div className="space-y-1.5">
          <svg
            viewBox="0 0 420 92"
            className="w-full max-w-[300px] sm:max-w-[380px] h-auto drop-shadow-[0_6px_18px_rgba(0,0,0,0.65)]"
            role="img"
            aria-label="Galo Strike Ultra"
          >
            {/* Tactical Chicken Crest Icon */}
            <g transform="translate(4, 8)">
              <polygon
                points="38,2 72,18 72,56 38,74 4,56 4,18"
                fill="#1e293b"
                stroke="#f59e0b"
                strokeWidth="3.5"
              />
              {/* Comb */}
              <path d="M26 20 L32 10 L38 18 L44 9 L49 20 Z" fill="#ef4444" />
              {/* Chicken head silhouette */}
              <rect x="24" y="20" width="25" height="26" rx="4" fill="#f8fafc" />
              {/* Shades */}
              <rect x="28" y="26" width="21" height="7" rx="1.5" fill="#0f172a" />
              {/* Beak */}
              <polygon points="49,33 62,38 49,43" fill="#f97316" />
              {/* Crosshair accent */}
              <circle cx="38" cy="57" r="7" fill="none" stroke="#f59e0b" strokeWidth="2.5" />
              <line x1="38" y1="47" x2="38" y2="67" stroke="#f59e0b" strokeWidth="2" />
              <line x1="28" y1="57" x2="48" y2="57" stroke="#f59e0b" strokeWidth="2" />
            </g>
            {/* Title Typography */}
            <text
              x="92"
              y="46"
              fill="#f8fafc"
              fontFamily="Barlow Condensed, sans-serif"
              fontWeight="800"
              fontSize="44"
              letterSpacing="1.5"
            >
              GALO STRIKE
            </text>
            <text
              x="94"
              y="74"
              fill="#f59e0b"
              fontFamily="Barlow Condensed, sans-serif"
              fontWeight="700"
              fontSize="24"
              letterSpacing="4"
            >
              ULTRA ARENA 3D
            </text>
          </svg>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-sm">
            Combate tático em 3D com física explosiva, multiplayer online por código de sala, veículos e construção sandbox.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Modo Solo
          </div>
          <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-slate-900/90 border border-slate-700/80">
            <button
              type="button"
              onClick={() => onSelectMode('survival')}
              className={`min-h-[44px] px-3 py-2 rounded-md text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                mode === 'survival'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              Ondas &amp; Chefes
            </button>
            <button
              type="button"
              onClick={() => onSelectMode('sandbox')}
              className={`min-h-[44px] px-3 py-2 rounded-md text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                mode === 'sandbox'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              Caos Sandbox
            </button>
          </div>
        </div>

        {/* Arena Selector */}
        <div className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Arena
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(ARENA_MAPS) as ArenaMapId[]).map((id) => {
              const m = ARENA_MAPS[id];
              const active = mapId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectMap(id)}
                  className={`min-h-[44px] px-2.5 sm:px-3 py-2 rounded-lg text-left border transition-colors ${
                    active
                      ? 'bg-slate-800 border-amber-400 text-white'
                      : 'bg-slate-900/85 border-slate-700/70 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <div className="text-xs font-bold truncate">{m.name}</div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">{m.subtitle}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary CTA + Online Room + Armory Trigger (3 primary buttons) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
          <button
            type="button"
            data-start="true"
            onClick={onStart}
            className="flex-1 min-h-[48px] px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 active:translate-y-px text-slate-950 font-display text-2xl font-extrabold tracking-wide shadow-[0_5px_0_#b45309] transition-all whitespace-nowrap"
          >
            JOGAR AGORA
          </button>
          <div className="grid grid-cols-2 sm:flex gap-2.5">
            <button
              type="button"
              data-open-online="true"
              onClick={onOpenOnline}
              className="min-h-[48px] px-4 py-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm shadow-[0_5px_0_#0369a1] transition-all whitespace-nowrap"
            >
              Jogar Online
            </button>
            <button
              type="button"
              onClick={onOpenArmory}
              className="min-h-[48px] px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm border border-slate-600 shadow-[0_5px_0_#0f172a] transition-all whitespace-nowrap"
            >
              Armaria &amp; Visual
            </button>
          </div>
        </div>
      </div>

      {/* Bottom flat borderless control hint line */}
      <div className="text-[11px] sm:text-xs text-slate-100 tracking-wide hud-stroke">
        PC: WASD Mover · Espaço Jetpack · Clique/F Atirar · G Ovo TNT · E Buggy · Celular: Toque &amp; Tela Cheia
      </div>
    </div>
  );
};
