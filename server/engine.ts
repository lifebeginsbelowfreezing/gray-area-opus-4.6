import { randomBytes } from 'crypto';
import type {
  Answer,
  GamePhase,
  GameSettings,
  ClientPlayer,
  ClientRoomState,
  Dilemma,
  RoundResult,
} from '../shared/types.js';

// Re-export for convenience
export type { Answer, GamePhase, GameSettings, Dilemma, RoundResult };

// ─── Server-Side Player ──────────────────────────────────

export interface ServerPlayer {
  id: string;
  socketId: string;
  name: string;
  score: number;
  isHost: boolean;
  isConnected: boolean;
  color: string;
}

// ─── Server-Side Room ────────────────────────────────────

export interface ServerRoom {
  code: string;
  phase: GamePhase;
  players: Map<string, ServerPlayer>;
  settings: GameSettings;

  currentRound: number;
  totalRounds: number;
  spotlightOrder: string[];
  spotlightIndex: number;

  currentDilemma: Dilemma | null;
  spotlightAnswer: Answer | null;
  predictions: Map<string, Answer>;

  roundResults: RoundResult[];
  dilemmaPool: Dilemma[];
  usedDilemmaIds: Set<string>;

  phaseTimer: ReturnType<typeof setTimeout> | null;
  phaseEndsAt: number | null;

  createdAt: number;
  lastActivity: number;
}

// ─── Constants ───────────────────────────────────────────

const PLAYER_COLORS_LIST = [
  '#ef4444', '#3b82f6', '#22c55e', '#f59e0b',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
];

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const PHASE_DURATIONS: Partial<Record<GamePhase, number>> = {
  presenting: 4000,
  reveal: 8000,
  scores: 6000,
};

// ─── Room Store ──────────────────────────────────────────

const rooms = new Map<string, ServerRoom>();

export function getRoom(code: string): ServerRoom | undefined {
  return rooms.get(code.toUpperCase());
}

export function getAllRooms(): Map<string, ServerRoom> {
  return rooms;
}

// ─── Room Code Generation ────────────────────────────────

function generateRoomCode(): string {
  let code: string;
  do {
    const bytes = randomBytes(4);
    code = Array.from(bytes)
      .map((b) => ROOM_CODE_CHARS[b % ROOM_CODE_CHARS.length])
      .join('');
  } while (rooms.has(code));
  return code;
}

// ─── Player ID Generation ────────────────────────────────

export function generatePlayerId(): string {
  return randomBytes(8).toString('hex');
}

// ─── Room Creation ───────────────────────────────────────

export function createRoom(
  socketId: string,
  playerName: string,
  settings: GameSettings
): { room: ServerRoom; playerId: string } {
  const code = generateRoomCode();
  const playerId = generatePlayerId();

  const host: ServerPlayer = {
    id: playerId,
    socketId,
    name: sanitizeName(playerName),
    score: 0,
    isHost: true,
    isConnected: true,
    color: PLAYER_COLORS_LIST[0],
  };

  const room: ServerRoom = {
    code,
    phase: 'lobby',
    players: new Map([[playerId, host]]),
    settings: { ...settings },
    currentRound: 0,
    totalRounds: settings.rounds,
    spotlightOrder: [],
    spotlightIndex: 0,
    currentDilemma: null,
    spotlightAnswer: null,
    predictions: new Map(),
    roundResults: [],
    dilemmaPool: [],
    usedDilemmaIds: new Set(),
    phaseTimer: null,
    phaseEndsAt: null,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };

  rooms.set(code, room);
  return { room, playerId };
}

// ─── Join Room ───────────────────────────────────────────

export function joinRoom(
  room: ServerRoom,
  socketId: string,
  playerName: string
): { playerId: string } | { error: string } {
  if (room.phase !== 'lobby') {
    return { error: 'Game already in progress' };
  }
  if (room.players.size >= 8) {
    return { error: 'Room is full (max 8 players)' };
  }

  const safeName = sanitizeName(playerName);
  const nameTaken = Array.from(room.players.values()).some(
    (p) => p.name.toLowerCase() === safeName.toLowerCase()
  );
  if (nameTaken) {
    return { error: 'That name is already taken in this room' };
  }

  const playerId = generatePlayerId();
  const colorIndex = room.players.size % PLAYER_COLORS_LIST.length;

  const player: ServerPlayer = {
    id: playerId,
    socketId,
    name: safeName,
    score: 0,
    isHost: false,
    isConnected: true,
    color: PLAYER_COLORS_LIST[colorIndex],
  };

  room.players.set(playerId, player);
  room.lastActivity = Date.now();
  return { playerId };
}

// ─── Rejoin Room ─────────────────────────────────────────

export function rejoinRoom(
  room: ServerRoom,
  playerId: string,
  socketId: string
): boolean {
  const player = room.players.get(playerId);
  if (!player) return false;

  player.socketId = socketId;
  player.isConnected = true;
  room.lastActivity = Date.now();
  return true;
}

// ─── Leave / Disconnect ─────────────────────────────────

export function disconnectPlayer(room: ServerRoom, socketId: string): string | null {
  for (const [id, player] of room.players) {
    if (player.socketId === socketId) {
      player.isConnected = false;

      if (room.phase === 'lobby') {
        room.players.delete(id);
        if (player.isHost && room.players.size > 0) {
          const nextHost = room.players.values().next().value!;
          nextHost.isHost = true;
        }
      } else if (player.isHost) {
        for (const p of room.players.values()) {
          if (p.isConnected && p.id !== id) {
            p.isHost = true;
            player.isHost = false;
            break;
          }
        }
      }

      if (allPlayersDisconnected(room)) {
        scheduleRoomCleanup(room);
      }

      return id;
    }
  }
  return null;
}

export function kickPlayer(room: ServerRoom, targetPlayerId: string): boolean {
  const player = room.players.get(targetPlayerId);
  if (!player || player.isHost) return false;
  room.players.delete(targetPlayerId);
  return true;
}

// ─── Game Start ──────────────────────────────────────────

export function startGame(
  room: ServerRoom,
  allDilemmas: Dilemma[]
): { error?: string } {
  const connectedPlayers = Array.from(room.players.values()).filter((p) => p.isConnected);
  if (connectedPlayers.length < 3) {
    return { error: 'Need at least 3 connected players to start' };
  }

  const filteredDilemmas = allDilemmas.filter((d) => {
    if (room.settings.contentMode === 'family') return d.tone !== 'party';
    if (room.settings.contentMode === 'party') return true;
    return true; // mixed
  });

  room.dilemmaPool = shuffleArray([...filteredDilemmas]);
  room.usedDilemmaIds = new Set();
  room.currentRound = 0;
  room.totalRounds = room.settings.rounds;
  room.roundResults = [];
  room.spotlightOrder = buildSpotlightOrder(room);
  room.spotlightIndex = 0;

  for (const player of room.players.values()) {
    player.score = 0;
  }

  return {};
}

// ─── Round Management ────────────────────────────────────

export function startNextRound(room: ServerRoom): Dilemma | null {
  room.currentRound++;
  room.spotlightAnswer = null;
  room.predictions.clear();

  const dilemma = pickDilemma(room);
  if (!dilemma) return null;

  room.currentDilemma = dilemma;

  const spotlightId = room.spotlightOrder[room.spotlightIndex % room.spotlightOrder.length];
  room.spotlightIndex++;

  const player = room.players.get(spotlightId);
  if (!player || !player.isConnected) {
    return startNextRound(room);
  }

  room.phase = 'presenting';
  return dilemma;
}

export function submitAnswer(room: ServerRoom, playerId: string, answer: Answer): boolean {
  if (room.phase !== 'answering') return false;

  const spotlightId = getCurrentSpotlightId(room);
  if (playerId !== spotlightId) return false;

  room.spotlightAnswer = answer;
  return true;
}

export function submitPrediction(room: ServerRoom, playerId: string, prediction: Answer): boolean {
  if (room.phase !== 'predicting') return false;

  const spotlightId = getCurrentSpotlightId(room);
  if (playerId === spotlightId) return false;

  if (room.predictions.has(playerId)) return false;

  room.predictions.set(playerId, prediction);
  return true;
}

export function allPredictionsIn(room: ServerRoom): boolean {
  const spotlightId = getCurrentSpotlightId(room);
  const connectedNonSpotlight = Array.from(room.players.values()).filter(
    (p) => p.isConnected && p.id !== spotlightId
  );
  return connectedNonSpotlight.every((p) => room.predictions.has(p.id));
}

export function calculateRoundResult(room: ServerRoom): RoundResult | null {
  if (!room.currentDilemma || !room.spotlightAnswer) return null;

  const spotlightId = getCurrentSpotlightId(room);
  const pointsAwarded: Record<string, number> = {};

  let wrongPredictions = 0;

  for (const [playerId, prediction] of room.predictions) {
    if (prediction === room.spotlightAnswer) {
      pointsAwarded[playerId] = (pointsAwarded[playerId] || 0) + 2;
    } else {
      wrongPredictions++;
    }
  }

  // Spotlight player earns 1 point per wrong prediction
  if (wrongPredictions > 0) {
    pointsAwarded[spotlightId] = wrongPredictions;
  }

  // Consensus bonus: if ALL predictors got it right, +1 each
  if (wrongPredictions === 0 && room.predictions.size > 0) {
    for (const playerId of room.predictions.keys()) {
      pointsAwarded[playerId] = (pointsAwarded[playerId] || 0) + 1;
    }
  }

  // Total surprise bonus: if NOBODY got it right, spotlight gets +2
  if (wrongPredictions === room.predictions.size && room.predictions.size > 0) {
    pointsAwarded[spotlightId] = (pointsAwarded[spotlightId] || 0) + 2;
  }

  // Apply points to players
  for (const [playerId, points] of Object.entries(pointsAwarded)) {
    const player = room.players.get(playerId);
    if (player) {
      player.score += points;
    }
  }

  const result: RoundResult = {
    round: room.currentRound,
    dilemma: room.currentDilemma,
    spotlightPlayerId: spotlightId,
    spotlightAnswer: room.spotlightAnswer,
    predictions: Object.fromEntries(room.predictions),
    pointsAwarded,
  };

  room.roundResults.push(result);
  return result;
}

export function isGameOver(room: ServerRoom): boolean {
  return room.currentRound >= room.totalRounds;
}

// ─── Phase Transition Helpers ────────────────────────────

export function getCurrentSpotlightId(room: ServerRoom): string {
  const idx = (room.spotlightIndex - 1) % room.spotlightOrder.length;
  return room.spotlightOrder[idx >= 0 ? idx : 0];
}

export function setPhase(room: ServerRoom, phase: GamePhase): void {
  clearPhaseTimer(room);
  room.phase = phase;
  room.lastActivity = Date.now();
}

export function setPhaseWithTimer(
  room: ServerRoom,
  phase: GamePhase,
  durationMs: number,
  onExpire: () => void
): void {
  clearPhaseTimer(room);
  room.phase = phase;
  room.phaseEndsAt = Date.now() + durationMs;
  room.lastActivity = Date.now();
  room.phaseTimer = setTimeout(() => {
    room.phaseTimer = null;
    room.phaseEndsAt = null;
    onExpire();
  }, durationMs);
}

export function clearPhaseTimer(room: ServerRoom): void {
  if (room.phaseTimer) {
    clearTimeout(room.phaseTimer);
    room.phaseTimer = null;
  }
  room.phaseEndsAt = null;
}

export function getPhaseDuration(phase: GamePhase, room: ServerRoom): number {
  if (phase === 'answering' || phase === 'predicting') {
    return room.settings.timerSeconds * 1000;
  }
  if (phase === 'discussion') {
    return 60_000;
  }
  return PHASE_DURATIONS[phase] ?? 5000;
}

// ─── Client State Projection ─────────────────────────────
// Strips sensitive data depending on who is asking

export function toClientState(room: ServerRoom, forPlayerId: string): ClientRoomState {
  const spotlightId = room.spotlightOrder.length > 0 ? getCurrentSpotlightId(room) : null;
  const isRevealOrLater = room.phase === 'reveal' || room.phase === 'scores' || room.phase === 'finished';

  const players: ClientPlayer[] = Array.from(room.players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score,
    isHost: p.isHost,
    isConnected: p.isConnected,
    color: p.color,
  }));

  let currentRoundResult: RoundResult | null = null;
  if (isRevealOrLater && room.roundResults.length > 0) {
    currentRoundResult = room.roundResults[room.roundResults.length - 1];
  }

  return {
    code: room.code,
    phase: room.phase,
    players,
    settings: { ...room.settings },
    currentRound: room.currentRound,
    totalRounds: room.totalRounds,
    spotlightPlayerId: spotlightId,
    currentDilemma: room.currentDilemma,
    myPlayerId: forPlayerId,
    myAnswer: forPlayerId === spotlightId ? room.spotlightAnswer : null,
    myPrediction: room.predictions.get(forPlayerId) ?? null,
    submittedAnswerIds: room.spotlightAnswer ? [spotlightId!] : [],
    submittedPredictionIds: Array.from(room.predictions.keys()),
    currentRoundResult,
    pastResults: room.roundResults.slice(0, -1),
    phaseEndsAt: room.phaseEndsAt,
  };
}

// ─── Room Cleanup ────────────────────────────────────────

const ROOM_TIMEOUT = 10 * 60 * 1000; // 10 minutes of total inactivity

function scheduleRoomCleanup(room: ServerRoom): void {
  setTimeout(() => {
    if (allPlayersDisconnected(room)) {
      destroyRoom(room.code);
    }
  }, 2 * 60 * 1000); // 2 min grace
}

export function destroyRoom(code: string): void {
  const room = rooms.get(code);
  if (room) {
    clearPhaseTimer(room);
    rooms.delete(code);
  }
}

export function cleanupStaleRooms(): void {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > ROOM_TIMEOUT) {
      destroyRoom(code);
    }
  }
}

// ─── Play Again ──────────────────────────────────────────

export function resetRoomForPlayAgain(room: ServerRoom): void {
  clearPhaseTimer(room);
  room.phase = 'lobby';
  room.currentRound = 0;
  room.spotlightOrder = [];
  room.spotlightIndex = 0;
  room.currentDilemma = null;
  room.spotlightAnswer = null;
  room.predictions.clear();
  room.roundResults = [];
  room.dilemmaPool = [];
  room.usedDilemmaIds.clear();
  room.phaseEndsAt = null;

  for (const player of room.players.values()) {
    player.score = 0;
  }
}

// ─── Utilities ───────────────────────────────────────────

function sanitizeName(name: string): string {
  return name.replace(/[<>&"']/g, '').trim().slice(0, 20) || 'Player';
}

function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildSpotlightOrder(room: ServerRoom): string[] {
  const ids = Array.from(room.players.values())
    .filter((p) => p.isConnected)
    .map((p) => p.id);
  const shuffled = shuffleArray(ids);

  // Repeat enough times to cover all rounds
  const order: string[] = [];
  while (order.length < room.totalRounds) {
    order.push(...shuffled);
  }
  return order.slice(0, room.totalRounds);
}

function pickDilemma(room: ServerRoom): Dilemma | null {
  for (const d of room.dilemmaPool) {
    if (!room.usedDilemmaIds.has(d.id)) {
      room.usedDilemmaIds.add(d.id);
      return d;
    }
  }
  // All exhausted — reshuffle
  room.usedDilemmaIds.clear();
  room.dilemmaPool = shuffleArray(room.dilemmaPool);
  return room.dilemmaPool[0] ?? null;
}

function allPlayersDisconnected(room: ServerRoom): boolean {
  return Array.from(room.players.values()).every((p) => !p.isConnected);
}
