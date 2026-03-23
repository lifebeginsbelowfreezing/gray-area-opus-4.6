// ─── Answer Types ────────────────────────────────────────

export type Answer = 'yes' | 'no' | 'depends';

// ─── Game Phases ─────────────────────────────────────────

export type GamePhase =
  | 'lobby'
  | 'presenting'
  | 'answering'
  | 'predicting'
  | 'discussion'
  | 'reveal'
  | 'scores'
  | 'finished';

// ─── Content ─────────────────────────────────────────────

export type DilemmaCategory =
  | 'everyday'
  | 'social'
  | 'honesty'
  | 'money'
  | 'relationships'
  | 'technology'
  | 'hypothetical'
  | 'lifestyle';

export type DilemmaTone = 'family' | 'party' | 'both';
export type DilemmaDifficulty = 'easy' | 'medium' | 'hard';

export interface Dilemma {
  id: string;
  text: string;
  category: DilemmaCategory;
  tone: DilemmaTone;
  difficulty: DilemmaDifficulty;
}

// ─── Game Settings ───────────────────────────────────────

export interface GameSettings {
  rounds: number;
  contentMode: 'family' | 'party' | 'mixed';
  discussionEnabled: boolean;
  timerSeconds: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
  rounds: 10,
  contentMode: 'mixed',
  discussionEnabled: true,
  timerSeconds: 30,
};

// ─── Player ──────────────────────────────────────────────

export interface ClientPlayer {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  isConnected: boolean;
  color: string;
}

// ─── Round Result ────────────────────────────────────────

export interface RoundResult {
  round: number;
  dilemma: Dilemma;
  spotlightPlayerId: string;
  spotlightAnswer: Answer;
  predictions: Record<string, Answer>;
  pointsAwarded: Record<string, number>;
}

// ─── Client Room State ───────────────────────────────────
// This is what the client receives from the server.
// Sensitive data (other players' answers) is hidden until reveal.

export interface ClientRoomState {
  code: string;
  phase: GamePhase;
  players: ClientPlayer[];
  settings: GameSettings;
  currentRound: number;
  totalRounds: number;
  spotlightPlayerId: string | null;
  currentDilemma: Dilemma | null;
  myPlayerId: string;
  myAnswer: Answer | null;
  myPrediction: Answer | null;
  submittedAnswerIds: string[];
  submittedPredictionIds: string[];
  currentRoundResult: RoundResult | null;
  pastResults: RoundResult[];
  phaseEndsAt: number | null;
}

// ─── Socket Events ───────────────────────────────────────

export interface ClientToServerEvents {
  'create-room': (data: { playerName: string; settings: GameSettings }) => void;
  'join-room': (data: { roomCode: string; playerName: string }) => void;
  'rejoin-room': (data: { roomCode: string; playerId: string }) => void;
  'start-game': () => void;
  'submit-answer': (data: { answer: Answer }) => void;
  'submit-prediction': (data: { prediction: Answer }) => void;
  'skip-phase': () => void;
  'kick-player': (data: { playerId: string }) => void;
  'update-settings': (data: { settings: Partial<GameSettings> }) => void;
  'leave-room': () => void;
  'play-again': () => void;
}

export interface ServerToClientEvents {
  'room-state': (state: ClientRoomState) => void;
  'kicked': () => void;
  'error': (data: { message: string }) => void;
}

// ─── Player Colors ───────────────────────────────────────

export const PLAYER_COLORS = [
  '#ef4444',
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
] as const;
