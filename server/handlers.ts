import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, GameSettings, Dilemma } from '../shared/types.js';
import {
  getRoom,
  createRoom,
  joinRoom,
  rejoinRoom,
  disconnectPlayer,
  kickPlayer,
  startGame,
  startNextRound,
  submitAnswer,
  submitPrediction,
  allPredictionsIn,
  calculateRoundResult,
  isGameOver,
  setPhase,
  setPhaseWithTimer,
  getPhaseDuration,
  toClientState,
  resetRoomForPlayAgain,
  getCurrentSpotlightId,
  type ServerRoom,
} from './engine.js';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

interface SocketMeta {
  roomCode: string | null;
  playerId: string | null;
}

const socketMeta = new Map<string, SocketMeta>();

function getMeta(socket: TypedSocket): SocketMeta {
  if (!socketMeta.has(socket.id)) {
    socketMeta.set(socket.id, { roomCode: null, playerId: null });
  }
  return socketMeta.get(socket.id)!;
}

function broadcastRoomState(io: TypedServer, room: ServerRoom): void {
  for (const player of room.players.values()) {
    if (player.isConnected) {
      const state = toClientState(room, player.id);
      io.to(player.socketId).emit('room-state', state);
    }
  }
}

function sendError(socket: TypedSocket, message: string): void {
  socket.emit('error', { message });
}

// ─── Phase Flow Engine ───────────────────────────────────

function runPhaseFlow(io: TypedServer, room: ServerRoom): void {
  switch (room.phase) {
    case 'presenting':
      setPhaseWithTimer(room, 'presenting', getPhaseDuration('presenting', room), () => {
        transitionToAnswering(io, room);
      });
      broadcastRoomState(io, room);
      break;

    case 'answering':
      transitionToAnswering(io, room);
      break;

    case 'predicting':
      transitionToPredicting(io, room);
      break;

    case 'discussion':
      transitionToDiscussion(io, room);
      break;

    case 'reveal':
      transitionToReveal(io, room);
      break;

    case 'scores':
      transitionToScores(io, room);
      break;

    default:
      break;
  }
}

function transitionToAnswering(io: TypedServer, room: ServerRoom): void {
  setPhaseWithTimer(room, 'answering', getPhaseDuration('answering', room), () => {
    // Time expired — if spotlight didn't answer, auto-select "depends"
    if (!room.spotlightAnswer) {
      const spotId = getCurrentSpotlightId(room);
      submitAnswer(room, spotId, 'depends');
    }
    transitionToPredicting(io, room);
  });
  broadcastRoomState(io, room);
}

function transitionToPredicting(io: TypedServer, room: ServerRoom): void {
  setPhaseWithTimer(room, 'predicting', getPhaseDuration('predicting', room), () => {
    if (room.settings.discussionEnabled) {
      transitionToDiscussion(io, room);
    } else {
      transitionToReveal(io, room);
    }
  });
  broadcastRoomState(io, room);
}

function transitionToDiscussion(io: TypedServer, room: ServerRoom): void {
  setPhaseWithTimer(room, 'discussion', getPhaseDuration('discussion', room), () => {
    transitionToReveal(io, room);
  });
  broadcastRoomState(io, room);
}

function transitionToReveal(io: TypedServer, room: ServerRoom): void {
  calculateRoundResult(room);
  setPhaseWithTimer(room, 'reveal', getPhaseDuration('reveal', room), () => {
    transitionToScores(io, room);
  });
  broadcastRoomState(io, room);
}

function transitionToScores(io: TypedServer, room: ServerRoom): void {
  if (isGameOver(room)) {
    setPhase(room, 'finished');
    broadcastRoomState(io, room);
    return;
  }

  setPhaseWithTimer(room, 'scores', getPhaseDuration('scores', room), () => {
    beginNextRound(io, room);
  });
  broadcastRoomState(io, room);
}

function beginNextRound(io: TypedServer, room: ServerRoom): void {
  const dilemma = startNextRound(room);
  if (!dilemma) {
    setPhase(room, 'finished');
    broadcastRoomState(io, room);
    return;
  }
  runPhaseFlow(io, room);
}

// ─── Socket Event Registration ───────────────────────────

export function registerHandlers(
  io: TypedServer,
  socket: TypedSocket,
  allDilemmas: Dilemma[]
): void {
  const meta = getMeta(socket);

  // ── Create Room ──────────────────────────
  socket.on('create-room', ({ playerName, settings }) => {
    if (!playerName || typeof playerName !== 'string') {
      return sendError(socket, 'Please enter a name');
    }

    const validSettings: GameSettings = {
      rounds: clamp(settings?.rounds ?? 10, 3, 30),
      contentMode: ['family', 'party', 'mixed'].includes(settings?.contentMode)
        ? settings.contentMode
        : 'mixed',
      discussionEnabled: settings?.discussionEnabled ?? true,
      timerSeconds: clamp(settings?.timerSeconds ?? 30, 10, 90),
    };

    const { room, playerId } = createRoom(socket.id, playerName, validSettings);
    meta.roomCode = room.code;
    meta.playerId = playerId;
    socket.join(room.code);

    broadcastRoomState(io, room);
  });

  // ── Join Room ────────────────────────────
  socket.on('join-room', ({ roomCode, playerName }) => {
    if (!roomCode || typeof roomCode !== 'string') {
      return sendError(socket, 'Please enter a room code');
    }
    if (!playerName || typeof playerName !== 'string') {
      return sendError(socket, 'Please enter a name');
    }

    const room = getRoom(roomCode.toUpperCase());
    if (!room) {
      return sendError(socket, 'Room not found');
    }

    const result = joinRoom(room, socket.id, playerName);
    if ('error' in result) {
      return sendError(socket, result.error);
    }

    meta.roomCode = room.code;
    meta.playerId = result.playerId;
    socket.join(room.code);

    broadcastRoomState(io, room);
  });

  // ── Rejoin Room ──────────────────────────
  socket.on('rejoin-room', ({ roomCode, playerId }) => {
    const room = getRoom(roomCode);
    if (!room) {
      return sendError(socket, 'Room no longer exists');
    }

    const success = rejoinRoom(room, playerId, socket.id);
    if (!success) {
      return sendError(socket, 'Could not rejoin — player not found');
    }

    meta.roomCode = room.code;
    meta.playerId = playerId;
    socket.join(room.code);

    broadcastRoomState(io, room);
  });

  // ── Start Game ───────────────────────────
  socket.on('start-game', () => {
    const room = getRoomForSocket(meta);
    if (!room) return sendError(socket, 'Not in a room');

    const player = room.players.get(meta.playerId!);
    if (!player?.isHost) return sendError(socket, 'Only the host can start');

    const result = startGame(room, allDilemmas);
    if (result.error) return sendError(socket, result.error);

    beginNextRound(io, room);
  });

  // ── Submit Answer ────────────────────────
  socket.on('submit-answer', ({ answer }) => {
    if (!isValidAnswer(answer)) return;

    const room = getRoomForSocket(meta);
    if (!room) return;

    const success = submitAnswer(room, meta.playerId!, answer);
    if (success) {
      broadcastRoomState(io, room);
    }
  });

  // ── Submit Prediction ────────────────────
  socket.on('submit-prediction', ({ prediction }) => {
    if (!isValidAnswer(prediction)) return;

    const room = getRoomForSocket(meta);
    if (!room) return;

    const success = submitPrediction(room, meta.playerId!, prediction);
    if (success) {
      broadcastRoomState(io, room);

      if (allPredictionsIn(room)) {
        if (room.settings.discussionEnabled) {
          transitionToDiscussion(io, room);
        } else {
          transitionToReveal(io, room);
        }
      }
    }
  });

  // ── Skip Phase ───────────────────────────
  socket.on('skip-phase', () => {
    const room = getRoomForSocket(meta);
    if (!room) return;

    const player = room.players.get(meta.playerId!);
    if (!player?.isHost) return;

    if (room.phase === 'discussion') {
      transitionToReveal(io, room);
    } else if (room.phase === 'reveal') {
      transitionToScores(io, room);
    } else if (room.phase === 'scores') {
      beginNextRound(io, room);
    }
  });

  // ── Kick Player ──────────────────────────
  socket.on('kick-player', ({ playerId: targetId }) => {
    const room = getRoomForSocket(meta);
    if (!room) return;

    const player = room.players.get(meta.playerId!);
    if (!player?.isHost) return;

    const target = room.players.get(targetId);
    if (target) {
      io.to(target.socketId).emit('kicked');
    }

    kickPlayer(room, targetId);
    broadcastRoomState(io, room);
  });

  // ── Update Settings ──────────────────────
  socket.on('update-settings', ({ settings }) => {
    const room = getRoomForSocket(meta);
    if (!room || room.phase !== 'lobby') return;

    const player = room.players.get(meta.playerId!);
    if (!player?.isHost) return;

    if (settings.rounds !== undefined) {
      room.settings.rounds = clamp(settings.rounds, 3, 30);
      room.totalRounds = room.settings.rounds;
    }
    if (settings.contentMode !== undefined && ['family', 'party', 'mixed'].includes(settings.contentMode)) {
      room.settings.contentMode = settings.contentMode;
    }
    if (settings.discussionEnabled !== undefined) {
      room.settings.discussionEnabled = Boolean(settings.discussionEnabled);
    }
    if (settings.timerSeconds !== undefined) {
      room.settings.timerSeconds = clamp(settings.timerSeconds, 10, 90);
    }

    broadcastRoomState(io, room);
  });

  // ── Leave Room ───────────────────────────
  socket.on('leave-room', () => {
    handleDisconnect(io, socket, meta);
  });

  // ── Play Again ───────────────────────────
  socket.on('play-again', () => {
    const room = getRoomForSocket(meta);
    if (!room) return;

    const player = room.players.get(meta.playerId!);
    if (!player?.isHost) return;

    resetRoomForPlayAgain(room);
    broadcastRoomState(io, room);
  });

  // ── Disconnect ───────────────────────────
  socket.on('disconnect', () => {
    handleDisconnect(io, socket, meta);
    socketMeta.delete(socket.id);
  });
}

// ─── Helpers ─────────────────────────────────────────────

function getRoomForSocket(meta: SocketMeta): ServerRoom | null {
  if (!meta.roomCode) return null;
  return getRoom(meta.roomCode) ?? null;
}

function handleDisconnect(io: TypedServer, socket: TypedSocket, meta: SocketMeta): void {
  if (!meta.roomCode) return;
  const room = getRoom(meta.roomCode);
  if (!room) return;

  disconnectPlayer(room, socket.id);
  socket.leave(room.code);

  if (room.players.size > 0) {
    broadcastRoomState(io, room);
  }

  meta.roomCode = null;
  meta.playerId = null;
}

function isValidAnswer(a: unknown): a is 'yes' | 'no' | 'depends' {
  return a === 'yes' || a === 'no' || a === 'depends';
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}
