import React from 'react';
import { GameScreenState, HudSnapshot } from '../game/types';

interface StatusModalProps {
  screenState: GameScreenState;
  hud: HudSnapshot;
  onResume: () => void;
  onRestart: () => void;
  onReturnToTitle: () => void;
}

export const StatusModal: React.FC<StatusModalProps> = ({
  screenState,
  hud,
  onResume,
  onRestart,
  onReturnToTitle,
}) => {
  if (screenState !== 'paused' && screenState !== 'gameover') return null;

  const isPaused = screenState === 'paused';
  const isVictory = hud.outcome === 'victory';

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/75">
      <div className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-700 p-6 shadow-2xl space-y-6">
        <div className="text-center space-y-1">
          <div className="text-xs font-semibold uppercase tracking-widest text-amber-400">
            {isPaused ? 'Jogo Pausado' : isVictory ? 'Arena Dominada' : 'Galo Abatido'}
          </div>
          <h2 className="font-display text-4xl font-extrabold tracking-wide text-white">
            {isPaused ? 'PAUSA TÁTICA' : isVictory ? 'VITÓRIA!' : 'FIM DE JOGO'}
          </h2>
        </div>

        {/* 3 Tabular Stat Tiles */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-center">
            <div className="text-[11px] uppercase text-slate-400">Pontuação</div>
            <div className="font-mono-num text-xl font-bold text-white mt-0.5">{hud.score}</div>
            <div className="text-[10px] text-slate-500 font-mono-num">Recorde {hud.bestScore}</div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-center">
            <div className="text-[11px] uppercase text-slate-400">Onda</div>
            <div className="font-mono-num text-xl font-bold text-amber-400 mt-0.5">{hud.wave}</div>
            <div className="text-[10px] text-slate-500 font-mono-num">{hud.elapsedSeconds}s</div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-center">
            <div className="text-[11px] uppercase text-slate-400">Abates</div>
            <div className="font-mono-num text-xl font-bold text-emerald-400 mt-0.5">{hud.kills}</div>
            <div className="text-[10px] text-slate-500 font-mono-num">Dano {hud.damageTaken}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2.5">
          {isPaused ? (
            <button
              type="button"
              onClick={onResume}
              className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display text-xl font-extrabold tracking-wide transition-colors"
            >
              CONTINUAR
            </button>
          ) : (
            <button
              type="button"
              data-start="true"
              onClick={onRestart}
              className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display text-xl font-extrabold tracking-wide transition-colors"
            >
              JOGAR NOVAMENTE
            </button>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            {isPaused && (
              <button
                type="button"
                onClick={onRestart}
                className="py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold border border-slate-700 transition-colors"
              >
                Reiniciar
              </button>
            )}
            <button
              type="button"
              onClick={onReturnToTitle}
              className={`${
                isPaused ? '' : 'col-span-2'
              } py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold border border-slate-700 transition-colors`}
            >
              Menu Principal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
