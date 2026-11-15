import React, { useState } from 'react';
import { HATS, PlayerCustomization, SKINS, VISORS, WEAPON_ORDER, WEAPONS } from '../game/types';

interface ArmoryModalProps {
  customization: PlayerCustomization;
  coins: number;
  onPurchaseOrEquip: (
    category: 'skin' | 'hat' | 'visor' | 'weapon',
    itemId: string,
    cost: number,
  ) => void;
  onClose: () => void;
}

type ArmoryTab = 'skin' | 'hat' | 'visor' | 'weapon';

export const ArmoryModal: React.FC<ArmoryModalProps> = ({
  customization,
  coins,
  onPurchaseOrEquip,
  onClose,
}) => {
  const [tab, setTab] = useState<ArmoryTab>('hat');

  return (
    <div className="fixed inset-y-0 left-0 z-30 w-full max-w-md p-6 flex flex-col justify-between bg-slate-950/95 border-r border-slate-700/80 shadow-2xl">
      <div className="space-y-5 overflow-y-auto pr-1">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="font-display text-3xl font-extrabold tracking-wide text-white">
              ARMARIA DO GALO
            </h2>
            <p className="text-xs text-slate-400">
              Personalize penas, chapéus e desbloqueie armas em tempo real
            </p>
          </div>
          <div className="text-right font-mono-num">
            <div className="text-[11px] uppercase text-slate-400">Saldo</div>
            <div className="text-xl font-bold text-amber-400">{coins}</div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800">
          {(
            [
              ['hat', 'Chapéus'],
              ['skin', 'Penas'],
              ['visor', 'Visores'],
              ['weapon', 'Armas'],
            ] as [ArmoryTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`py-2 px-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === id
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-2 gap-3">
          {tab === 'skin' &&
            SKINS.map((item) => {
              const unlocked = customization.unlockedSkins.includes(item.id);
              const equipped = customization.skin === item.id;
              const affordable = coins >= item.cost;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!unlocked && !affordable}
                  onClick={() => onPurchaseOrEquip('skin', item.id, item.cost)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    equipped
                      ? 'bg-slate-800 border-amber-400'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-600 disabled:opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-5 h-5 rounded-full border border-white/25 shrink-0"
                      style={{ backgroundColor: item.colorHex }}
                    />
                    <span className="text-sm font-semibold text-white truncate">{item.name}</span>
                  </div>
                  <div className="mt-2 text-xs font-mono-num">
                    {equipped ? (
                      <span className="text-amber-400 font-bold">Equipado</span>
                    ) : unlocked ? (
                      <span className="text-emerald-400">Desbloqueado</span>
                    ) : (
                      <span className={affordable ? 'text-amber-300' : 'text-rose-400'}>
                        {item.cost} MilhoCoins
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

          {tab === 'hat' &&
            HATS.map((item) => {
              const unlocked = customization.unlockedHats.includes(item.id);
              const equipped = customization.hat === item.id;
              const affordable = coins >= item.cost;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!unlocked && !affordable}
                  onClick={() => onPurchaseOrEquip('hat', item.id, item.cost)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    equipped
                      ? 'bg-slate-800 border-amber-400'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-600 disabled:opacity-50'
                  }`}
                >
                  <div className="text-sm font-semibold text-white truncate">{item.name}</div>
                  <div className="mt-2 text-xs font-mono-num">
                    {equipped ? (
                      <span className="text-amber-400 font-bold">Equipado</span>
                    ) : unlocked ? (
                      <span className="text-emerald-400">Desbloqueado</span>
                    ) : (
                      <span className={affordable ? 'text-amber-300' : 'text-rose-400'}>
                        {item.cost} MilhoCoins
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

          {tab === 'visor' &&
            VISORS.map((item) => {
              const unlocked = customization.unlockedVisors.includes(item.id);
              const equipped = customization.visor === item.id;
              const affordable = coins >= item.cost;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!unlocked && !affordable}
                  onClick={() => onPurchaseOrEquip('visor', item.id, item.cost)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    equipped
                      ? 'bg-slate-800 border-amber-400'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-600 disabled:opacity-50'
                  }`}
                >
                  <div className="text-sm font-semibold text-white truncate">{item.name}</div>
                  <div className="mt-2 text-xs font-mono-num">
                    {equipped ? (
                      <span className="text-amber-400 font-bold">Equipado</span>
                    ) : unlocked ? (
                      <span className="text-emerald-400">Desbloqueado</span>
                    ) : (
                      <span className={affordable ? 'text-amber-300' : 'text-rose-400'}>
                        {item.cost} MilhoCoins
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

          {tab === 'weapon' &&
            WEAPON_ORDER.map((wId) => {
              const w = WEAPONS[wId];
              const unlocked = customization.unlockedWeapons.includes(wId);
              const affordable = coins >= w.unlockCost;
              return (
                <button
                  key={wId}
                  type="button"
                  disabled={unlocked || !affordable}
                  onClick={() => onPurchaseOrEquip('weapon', wId, w.unlockCost)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    unlocked
                      ? 'bg-slate-800/80 border-emerald-500/50'
                      : 'bg-slate-900 border-slate-800 hover:border-amber-400 disabled:opacity-50'
                  }`}
                >
                  <div className="text-sm font-semibold text-white truncate">{w.name}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{w.role}</div>
                  <div className="mt-2 text-xs font-mono-num">
                    {unlocked ? (
                      <span className="text-emerald-400 font-bold">No Arsenal [{w.key}]</span>
                    ) : (
                      <span className={affordable ? 'text-amber-300' : 'text-rose-400'}>
                        Desbloquear · {w.unlockCost}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-800 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors"
        >
          Confirmar Visual
        </button>
      </div>
    </div>
  );
};
