import React, { useState } from 'react';
import { ARENA_MAPS, ArenaMapId, OnlineRoomMode, RoomSessionState } from '../game/types';

interface OnlineRoomModalProps {
  session: RoomSessionState;
  playerName: string;
  defaultMapId: ArenaMapId;
  onChangeName: (name: string) => void;
  onCreateRoom: (mapId: ArenaMapId, mode: OnlineRoomMode) => void;
  onJoinRoom: (code: string) => void;
  onUpdateSettings: (mapId: ArenaMapId, mode: OnlineRoomMode) => void;
  onStartMatch: () => void;
  onLeaveRoom: () => void;
  onClose: () => void;
}

export const OnlineRoomModal: React.FC<OnlineRoomModalProps> = ({
  session,
  playerName,
  defaultMapId,
  onChangeName,
  onCreateRoom,
  onJoinRoom,
  onUpdateSettings,
  onStartMatch,
  onLeaveRoom,
  onClose,
}) => {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [selectedMap, setSelectedMap] = useState<ArenaMapId>(defaultMapId);
  const [selectedMode, setSelectedMode] = useState<OnlineRoomMode>('pvp');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);

  const inLobby = session.status === 'lobby';
  const connecting = session.status === 'creating' || session.status === 'joining';

  const handleCopy = async () => {
    if (!session.roomCode) return;
    try {
      await navigator.clipboard.writeText(session.roomCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/82 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Jogar Online com Amigos"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-wide">
              MULTIPLAYER ONLINE
            </h2>
            <p className="text-xs text-slate-400">
              Crie uma sala e envie o código para seu amigo entrar direto pelo navegador
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (inLobby || connecting) onLeaveRoom();
              onClose();
            }}
            className="px-3 py-2 min-h-[44px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-600"
          >
            Fechar
          </button>
        </div>

        {session.error && (
          <div className="px-3.5 py-2.5 rounded-lg bg-rose-950/90 border border-rose-500/70 text-rose-200 text-xs font-medium">
            {session.error}
          </div>
        )}

        {!inLobby && !connecting && (
          <>
            {/* Segmented Tab Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setTab('create')}
                className={`min-h-[44px] rounded-md text-sm font-bold transition-colors ${
                  tab === 'create'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                Criar Sala
              </button>
              <button
                type="button"
                onClick={() => setTab('join')}
                className={`min-h-[44px] rounded-md text-sm font-bold transition-colors ${
                  tab === 'join'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                Entrar com Código
              </button>
            </div>

            {/* Nickname */}
            <div className="space-y-1.5">
              <label htmlFor="online-nickname" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Seu Apelido
              </label>
              <input
                id="online-nickname"
                type="text"
                maxLength={16}
                value={playerName}
                onChange={(e) => onChangeName(e.target.value)}
                placeholder="Galo Bravo"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm font-semibold focus:outline-none focus:border-amber-400"
              />
            </div>

            {tab === 'create' ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Modo da Sala
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedMode('pvp')}
                      className={`min-h-[44px] px-3 py-2 rounded-lg border text-left transition-colors ${
                        selectedMode === 'pvp'
                          ? 'bg-slate-800 border-amber-400 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="text-xs font-bold">PvP · Galo vs Galo</div>
                      <div className="text-[11px] text-slate-400">Duelo entre amigos</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedMode('coop')}
                      className={`min-h-[44px] px-3 py-2 rounded-lg border text-left transition-colors ${
                        selectedMode === 'coop'
                          ? 'bg-slate-800 border-amber-400 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="text-xs font-bold">Co-op · Ondas Juntos</div>
                      <div className="text-[11px] text-slate-400">Enfrentem os chefes</div>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Arena
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(ARENA_MAPS) as ArenaMapId[]).map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSelectedMap(id)}
                        className={`min-h-[44px] px-2.5 py-2 rounded-lg border text-left transition-colors ${
                          selectedMap === id
                            ? 'bg-slate-800 border-amber-400 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="text-xs font-bold truncate">{ARENA_MAPS[id].name}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  data-create-room="true"
                  onClick={() => onCreateRoom(selectedMap, selectedMode)}
                  className="w-full min-h-[48px] px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display text-xl font-extrabold tracking-wide shadow-[0_4px_0_#b45309]"
                >
                  CRIAR SALA ONLINE
                </button>
              </div>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  onJoinRoom(joinCode);
                }}
              >
                <div className="space-y-1.5">
                  <label htmlFor="join-room-code" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Código da Sala do Amigo
                  </label>
                  <input
                    id="join-room-code"
                    data-join-code="true"
                    type="text"
                    maxLength={8}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="EX: K7M2P"
                    autoComplete="off"
                    className="w-full min-h-[48px] px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-amber-400 font-mono-num text-xl font-extrabold tracking-[0.25em] uppercase focus:outline-none focus:border-amber-400"
                  />
                </div>

                <button
                  type="submit"
                  data-join-submit="true"
                  className="w-full min-h-[48px] px-5 py-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-display text-xl font-extrabold tracking-wide shadow-[0_4px_0_#0369a1]"
                >
                  ENTRAR NA SALA
                </button>
              </form>
            )}
          </>
        )}

        {connecting && (
          <div className="py-6 text-center space-y-4">
            <div className="text-base font-bold text-amber-400">
              {session.status === 'creating'
                ? 'Gerando sala e código online...'
                : `Conectando à sala ${session.roomCode}...`}
            </div>
            <p className="text-xs text-slate-400">
              Estabelecendo canal P2P direto entre os jogadores.
            </p>
            <button
              type="button"
              onClick={onLeaveRoom}
              className="min-h-[44px] px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold border border-slate-600"
            >
              Cancelar
            </button>
          </div>
        )}

        {inLobby && (
          <div className="space-y-4">
            {/* Room Code Display */}
            <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/60 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Código da Sala
                </div>
                <div
                  data-room-code={session.roomCode}
                  className="font-mono-num text-3xl font-extrabold text-amber-400 tracking-[0.22em]"
                >
                  {session.roomCode}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-600 whitespace-nowrap"
              >
                {copied ? 'Copiado!' : 'Copiar Código'}
              </button>
            </div>

            {/* Room Settings (editable by Host, readonly for Guest) */}
            {session.role === 'host' ? (
              <div className="grid grid-cols-2 gap-2">
                <select
                  aria-label="Modo da sala"
                  value={session.roomMode}
                  onChange={(e) => onUpdateSettings(session.mapId, e.target.value as OnlineRoomMode)}
                  className="min-h-[44px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-bold text-white"
                >
                  <option value="pvp">PvP · Galo vs Galo</option>
                  <option value="coop">Co-op · Ondas Juntos</option>
                </select>
                <select
                  aria-label="Mapa da sala"
                  value={session.mapId}
                  onChange={(e) => onUpdateSettings(e.target.value as ArenaMapId, session.roomMode)}
                  className="min-h-[44px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-bold text-white"
                >
                  {(Object.keys(ARENA_MAPS) as ArenaMapId[]).map((id) => (
                    <option key={id} value={id}>
                      {ARENA_MAPS[id].name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                <span>
                  Modo: <strong className="text-white">{session.roomMode === 'pvp' ? 'PvP Galo vs Galo' : 'Co-op Ondas'}</strong>
                </span>
                <span>
                  Arena: <strong className="text-white">{ARENA_MAPS[session.mapId].name}</strong>
                </span>
              </div>
            )}

            {/* Player Roster */}
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Jogadores na Sala ({session.players.length})
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {session.players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm"
                  >
                    <span className="font-bold text-white truncate">
                      {p.name} {p.id === session.localId ? '(Você)' : ''}
                    </span>
                    <span className="text-[11px] font-mono-num font-bold text-amber-400">
                      {p.isHost ? 'HOST' : 'PRONTO'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              {session.role === 'host' ? (
                <button
                  type="button"
                  data-start-online="true"
                  onClick={onStartMatch}
                  className="flex-1 min-h-[48px] px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display text-xl font-extrabold tracking-wide shadow-[0_4px_0_#b45309]"
                >
                  INICIAR PARTIDA ONLINE
                </button>
              ) : (
                <div className="flex-1 min-h-[48px] px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-center text-xs font-semibold text-slate-300 flex items-center justify-center">
                  Aguardando o host iniciar a partida...
                </div>
              )}
              <button
                type="button"
                onClick={onLeaveRoom}
                className="min-h-[48px] px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-600"
              >
                Sair
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
