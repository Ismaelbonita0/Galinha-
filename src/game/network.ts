import Peer, { DataConnection } from 'peerjs';
import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  roomCodeToPeerId,
} from './rules';
import {
  ArenaMapId,
  OnlinePeerPlayer,
  OnlineRoomMode,
  PlayerCustomization,
  RoomSessionState,
  WeaponId,
} from './types';

export interface RemoteFireEvent {
  senderId: string;
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  weaponId: WeaponId;
}

export interface RemoteHitEvent {
  targetId: string;
  attackerId: string;
  damage: number;
}

type WireMessage =
  | { type: 'hello'; player: OnlinePeerPlayer }
  | {
      type: 'room_state';
      mapId: ArenaMapId;
      roomMode: OnlineRoomMode;
      players: OnlinePeerPlayer[];
      started: boolean;
    }
  | { type: 'match_start'; mapId: ArenaMapId; roomMode: OnlineRoomMode }
  | { type: 'player_state'; player: OnlinePeerPlayer }
  | { type: 'fire_event'; event: RemoteFireEvent }
  | { type: 'hit_event'; event: RemoteHitEvent };

export interface RoomCallbacks {
  onSessionChange: (state: RoomSessionState) => void;
  onMatchStart: (mapId: ArenaMapId, roomMode: OnlineRoomMode) => void;
  onRemotePlayersUpdate: (players: OnlinePeerPlayer[]) => void;
  onRemoteFire: (ev: RemoteFireEvent) => void;
  onLocalDamaged: (damage: number, attackerId: string) => void;
}

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export class OnlineRoomManager {
  private peer: Peer | null = null;
  private connections = new Map<string, DataConnection>();
  private hostConn: DataConnection | null = null;
  private callbacks: RoomCallbacks;

  private state: RoomSessionState = {
    status: 'idle',
    role: 'none',
    roomCode: '',
    localId: '',
    mapId: 'farm',
    roomMode: 'pvp',
    players: [],
    error: null,
  };

  private localPlayer: OnlinePeerPlayer | null = null;

  constructor(callbacks: RoomCallbacks) {
    this.callbacks = callbacks;
  }

  public getState(): RoomSessionState {
    return this.state;
  }

  private emitState(patch: Partial<RoomSessionState>) {
    this.state = { ...this.state, ...patch };
    this.callbacks.onSessionChange(this.state);
  }

  public createRoom(
    hostName: string,
    customization: PlayerCustomization,
    mapId: ArenaMapId,
    roomMode: OnlineRoomMode,
  ) {
    this.leaveRoom();
    const code = generateRoomCode(5);
    const peerId = roomCodeToPeerId(code);
    const cleanName = hostName.trim().slice(0, 16) || 'Galo Host';

    this.localPlayer = {
      id: peerId,
      name: cleanName,
      isHost: true,
      skin: customization.skin,
      hat: customization.hat,
      visor: customization.visor,
      weapon: 'ak_galo',
      x: 0,
      y: 0,
      z: 10,
      yaw: 0,
      hp: 100,
      kills: 0,
    };

    this.emitState({
      status: 'creating',
      role: 'host',
      roomCode: code,
      localId: peerId,
      mapId,
      roomMode,
      players: [this.localPlayer],
      error: null,
    });

    const peer = new Peer(peerId, { config: ICE_CONFIG });
    this.peer = peer;

    peer.on('open', (id) => {
      if (this.peer !== peer) return;
      if (this.localPlayer) this.localPlayer.id = id;
      this.emitState({
        status: 'lobby',
        localId: id,
        players: this.localPlayer ? [this.localPlayer] : [],
      });
    });

    peer.on('connection', (conn) => {
      if (this.peer !== peer) return;
      this.setupHostConnection(conn);
    });

    peer.on('error', (err) => {
      if (this.peer !== peer) return;
      this.emitState({
        status: 'error',
        error: `Erro na rede P2P: ${err.message || 'falha ao criar sala'}`,
      });
    });
  }

  private setupHostConnection(conn: DataConnection) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
    });

    conn.on('data', (raw) => {
      const msg = raw as WireMessage;
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'hello') {
        const incoming: OnlinePeerPlayer = {
          ...msg.player,
          id: conn.peer,
          isHost: false,
        };
        const existingIdx = this.state.players.findIndex((p) => p.id === incoming.id);
        const nextPlayers = [...this.state.players];
        if (existingIdx >= 0) nextPlayers[existingIdx] = incoming;
        else nextPlayers.push(incoming);

        this.emitState({ players: nextPlayers });
        this.broadcastFromHost({
          type: 'room_state',
          mapId: this.state.mapId,
          roomMode: this.state.roomMode,
          players: nextPlayers,
          started: this.state.status === 'playing',
        });
        if (this.state.status === 'playing') {
          conn.send({
            type: 'match_start',
            mapId: this.state.mapId,
            roomMode: this.state.roomMode,
          });
        }
      } else if (msg.type === 'player_state') {
        const updated = { ...msg.player, id: conn.peer, isHost: false };
        const nextPlayers = this.state.players.map((p) => (p.id === conn.peer ? updated : p));
        this.state = { ...this.state, players: nextPlayers };
        this.callbacks.onRemotePlayersUpdate(
          nextPlayers.filter((p) => p.id !== this.state.localId),
        );
        this.broadcastFromHost(
          { type: 'player_state', player: updated },
          conn.peer,
        );
      } else if (msg.type === 'fire_event') {
        const ev = { ...msg.event, senderId: conn.peer };
        this.callbacks.onRemoteFire(ev);
        this.broadcastFromHost({ type: 'fire_event', event: ev }, conn.peer);
      } else if (msg.type === 'hit_event') {
        if (msg.event.targetId === this.state.localId) {
          this.callbacks.onLocalDamaged(msg.event.damage, msg.event.attackerId);
        } else {
          const targetConn = this.connections.get(msg.event.targetId);
          if (targetConn && targetConn.open) {
            targetConn.send(msg);
          }
        }
      }
    });

    const removeGuest = () => {
      this.connections.delete(conn.peer);
      const nextPlayers = this.state.players.filter((p) => p.id !== conn.peer);
      this.emitState({ players: nextPlayers });
      this.callbacks.onRemotePlayersUpdate(
        nextPlayers.filter((p) => p.id !== this.state.localId),
      );
      this.broadcastFromHost({
        type: 'room_state',
        mapId: this.state.mapId,
        roomMode: this.state.roomMode,
        players: nextPlayers,
        started: this.state.status === 'playing',
      });
    };

    conn.on('close', removeGuest);
    conn.on('error', removeGuest);
  }

  private broadcastFromHost(msg: WireMessage, excludePeerId?: string) {
    for (const [peerId, conn] of this.connections.entries()) {
      if (peerId === excludePeerId) continue;
      if (conn.open) {
        conn.send(msg);
      }
    }
  }

  public joinRoom(
    rawCode: string,
    guestName: string,
    customization: PlayerCustomization,
  ) {
    if (!isValidRoomCode(rawCode)) {
      this.emitState({
        status: 'error',
        error: 'Código inválido. Digite o código de 4 a 8 caracteres da sala.',
      });
      return;
    }

    this.leaveRoom();
    const code = normalizeRoomCode(rawCode);
    const hostPeerId = roomCodeToPeerId(code);
    const cleanName = guestName.trim().slice(0, 16) || 'Galo Amigo';

    this.emitState({
      status: 'joining',
      role: 'guest',
      roomCode: code,
      players: [],
      error: null,
    });

    const peer = new Peer({ config: ICE_CONFIG });
    this.peer = peer;

    peer.on('open', (myId) => {
      if (this.peer !== peer) return;
      this.localPlayer = {
        id: myId,
        name: cleanName,
        isHost: false,
        skin: customization.skin,
        hat: customization.hat,
        visor: customization.visor,
        weapon: 'ak_galo',
        x: 3,
        y: 0,
        z: 10,
        yaw: 0,
        hp: 100,
        kills: 0,
      };
      this.emitState({ localId: myId });

      const conn = peer.connect(hostPeerId, { reliable: true });
      this.hostConn = conn;

      const timeout = window.setTimeout(() => {
        if (this.state.status === 'joining') {
          this.emitState({
            status: 'error',
            error: `Sala "${code}" não encontrada ou host offline.`,
          });
        }
      }, 9000);

      conn.on('open', () => {
        window.clearTimeout(timeout);
        if (this.localPlayer) {
          conn.send({ type: 'hello', player: this.localPlayer });
        }
        this.emitState({ status: 'lobby', error: null });
      });

      conn.on('data', (raw) => {
        const msg = raw as WireMessage;
        if (!msg || typeof msg !== 'object') return;

        if (msg.type === 'room_state') {
          this.emitState({
            status: msg.started ? 'playing' : 'lobby',
            mapId: msg.mapId,
            roomMode: msg.roomMode,
            players: msg.players,
          });
          this.callbacks.onRemotePlayersUpdate(
            msg.players.filter((p) => p.id !== this.state.localId),
          );
        } else if (msg.type === 'match_start') {
          this.emitState({
            status: 'playing',
            mapId: msg.mapId,
            roomMode: msg.roomMode,
          });
          this.callbacks.onMatchStart(msg.mapId, msg.roomMode);
        } else if (msg.type === 'player_state') {
          if (msg.player.id === this.state.localId) return;
          const exists = this.state.players.some((p) => p.id === msg.player.id);
          const nextPlayers = exists
            ? this.state.players.map((p) => (p.id === msg.player.id ? msg.player : p))
            : [...this.state.players, msg.player];
          this.state = { ...this.state, players: nextPlayers };
          this.callbacks.onRemotePlayersUpdate(
            nextPlayers.filter((p) => p.id !== this.state.localId),
          );
        } else if (msg.type === 'fire_event') {
          if (msg.event.senderId !== this.state.localId) {
            this.callbacks.onRemoteFire(msg.event);
          }
        } else if (msg.type === 'hit_event') {
          if (msg.event.targetId === this.state.localId) {
            this.callbacks.onLocalDamaged(msg.event.damage, msg.event.attackerId);
          }
        }
      });

      conn.on('close', () => {
        window.clearTimeout(timeout);
        if (this.peer === peer) {
          this.emitState({
            status: 'error',
            error: 'Conexão com o host encerrada.',
          });
        }
      });

      conn.on('error', () => {
        window.clearTimeout(timeout);
        if (this.peer === peer) {
          this.emitState({
            status: 'error',
            error: `Não foi possível conectar à sala "${code}".`,
          });
        }
      });
    });

    peer.on('error', (err) => {
      if (this.peer !== peer) return;
      this.emitState({
        status: 'error',
        error: `Erro de conexão: ${err.message || 'verifique o código da sala'}`,
      });
    });
  }

  public updateRoomSettings(mapId: ArenaMapId, roomMode: OnlineRoomMode) {
    if (this.state.role !== 'host') return;
    this.emitState({ mapId, roomMode });
    this.broadcastFromHost({
      type: 'room_state',
      mapId,
      roomMode,
      players: this.state.players,
      started: this.state.status === 'playing',
    });
  }

  public startMatch() {
    if (this.state.role !== 'host') return;
    this.emitState({ status: 'playing' });
    this.broadcastFromHost({
      type: 'match_start',
      mapId: this.state.mapId,
      roomMode: this.state.roomMode,
    });
    this.callbacks.onMatchStart(this.state.mapId, this.state.roomMode);
  }

  public sendLocalState(patch: Omit<OnlinePeerPlayer, 'id' | 'name' | 'isHost'>) {
    if (!this.localPlayer || (this.state.status !== 'playing' && this.state.status !== 'lobby')) {
      return;
    }
    this.localPlayer = { ...this.localPlayer, ...patch };
    const msg: WireMessage = { type: 'player_state', player: this.localPlayer };
    if (this.state.role === 'host') {
      this.broadcastFromHost(msg);
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send(msg);
    }
  }

  public sendFireEvent(ev: Omit<RemoteFireEvent, 'senderId'>) {
    if (!this.localPlayer) return;
    const msg: WireMessage = {
      type: 'fire_event',
      event: { ...ev, senderId: this.state.localId },
    };
    if (this.state.role === 'host') {
      this.broadcastFromHost(msg);
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send(msg);
    }
  }

  public sendHitEvent(targetId: string, damage: number) {
    if (!this.localPlayer) return;
    const msg: WireMessage = {
      type: 'hit_event',
      event: { targetId, attackerId: this.state.localId, damage },
    };
    if (this.state.role === 'host') {
      const targetConn = this.connections.get(targetId);
      if (targetConn && targetConn.open) targetConn.send(msg);
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send(msg);
    }
  }

  public leaveRoom() {
    for (const conn of this.connections.values()) {
      conn.close();
    }
    this.connections.clear();
    if (this.hostConn) {
      this.hostConn.close();
      this.hostConn = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.localPlayer = null;
    this.emitState({
      status: 'idle',
      role: 'none',
      roomCode: '',
      localId: '',
      players: [],
      error: null,
    });
  }
}
