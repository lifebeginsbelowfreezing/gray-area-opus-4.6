import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createRoom,
  getRoom,
  joinRoom,
  startGame,
  startNextRound,
  submitAnswer,
  submitPrediction,
  allPredictionsIn,
  calculateRoundResult,
  isGameOver,
  getCurrentSpotlightId,
  disconnectPlayer,
  rejoinRoom,
  kickPlayer,
  resetRoomForPlayAgain,
  destroyRoom,
  toClientState,
  type ServerRoom,
} from '../server/engine';
import type { Dilemma, GameSettings } from '../shared/types';

const defaultSettings: GameSettings = {
  rounds: 5,
  contentMode: 'mixed',
  discussionEnabled: true,
  timerSeconds: 30,
};

const sampleDilemmas: Dilemma[] = Array.from({ length: 20 }, (_, i) => ({
  id: `TEST-${i + 1}`,
  text: `Test dilemma ${i + 1}?`,
  category: 'everyday' as const,
  tone: 'both' as const,
  difficulty: 'medium' as const,
}));

function createTestRoom() {
  const { room, playerId: hostId } = createRoom('socket-host', 'Host', defaultSettings);
  return { room, hostId };
}

function addPlayers(room: ServerRoom, count: number): string[] {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const result = joinRoom(room, `socket-player-${i}`, `Player${i + 1}`);
    if ('playerId' in result) {
      ids.push(result.playerId);
    }
  }
  return ids;
}

describe('Room Creation', () => {
  it('creates a room with valid code', () => {
    const { room } = createTestRoom();
    expect(room.code).toMatch(/^[A-Z0-9]{4}$/);
    expect(room.phase).toBe('lobby');
    expect(room.players.size).toBe(1);
    destroyRoom(room.code);
  });

  it('host is marked correctly', () => {
    const { room, hostId } = createTestRoom();
    const host = room.players.get(hostId)!;
    expect(host.isHost).toBe(true);
    expect(host.name).toBe('Host');
    expect(host.score).toBe(0);
    destroyRoom(room.code);
  });

  it('room is retrievable by code', () => {
    const { room } = createTestRoom();
    const found = getRoom(room.code);
    expect(found).toBe(room);
    destroyRoom(room.code);
  });
});

describe('Joining', () => {
  let room: ServerRoom;
  let hostId: string;

  beforeEach(() => {
    ({ room, hostId } = createTestRoom());
  });

  afterEach(() => {
    destroyRoom(room.code);
  });

  it('adds a player', () => {
    const result = joinRoom(room, 'socket-2', 'Alice');
    expect('playerId' in result).toBe(true);
    expect(room.players.size).toBe(2);
  });

  it('rejects duplicate names', () => {
    joinRoom(room, 'socket-2', 'Alice');
    const result = joinRoom(room, 'socket-3', 'alice');
    expect('error' in result).toBe(true);
  });

  it('rejects when room is full', () => {
    addPlayers(room, 7); // 1 host + 7 = 8
    const result = joinRoom(room, 'socket-full', 'TooMany');
    expect('error' in result).toBe(true);
  });

  it('rejects joining during active game', () => {
    addPlayers(room, 2);
    startGame(room, sampleDilemmas);
    startNextRound(room);
    const result = joinRoom(room, 'socket-late', 'Late');
    expect('error' in result).toBe(true);
  });
});

describe('Game Start', () => {
  let room: ServerRoom;

  beforeEach(() => {
    ({ room } = createTestRoom());
  });

  afterEach(() => {
    destroyRoom(room.code);
  });

  it('requires at least 3 connected players', () => {
    addPlayers(room, 1); // only 2 total
    const result = startGame(room, sampleDilemmas);
    expect(result.error).toBeTruthy();
  });

  it('starts with 3+ players', () => {
    addPlayers(room, 2); // 3 total
    const result = startGame(room, sampleDilemmas);
    expect(result.error).toBeUndefined();
    expect(room.spotlightOrder.length).toBe(room.totalRounds);
  });

  it('resets scores to zero', () => {
    addPlayers(room, 2);
    for (const p of room.players.values()) p.score = 99;
    startGame(room, sampleDilemmas);
    for (const p of room.players.values()) {
      expect(p.score).toBe(0);
    }
  });
});

describe('Round Flow', () => {
  let room: ServerRoom;
  let hostId: string;
  let playerIds: string[];

  beforeEach(() => {
    ({ room, hostId } = createTestRoom());
    playerIds = addPlayers(room, 2);
    startGame(room, sampleDilemmas);
  });

  afterEach(() => {
    destroyRoom(room.code);
  });

  it('starts a round with a dilemma', () => {
    const dilemma = startNextRound(room);
    expect(dilemma).toBeTruthy();
    expect(room.currentRound).toBe(1);
    expect(room.phase).toBe('presenting');
  });

  it('only spotlight player can submit answer', () => {
    startNextRound(room);
    room.phase = 'answering';
    const spotlightId = getCurrentSpotlightId(room);
    const nonSpotlight = [hostId, ...playerIds].find((id) => id !== spotlightId)!;

    expect(submitAnswer(room, nonSpotlight, 'yes')).toBe(false);
    expect(submitAnswer(room, spotlightId, 'yes')).toBe(true);
    expect(room.spotlightAnswer).toBe('yes');
  });

  it('spotlight player cannot predict', () => {
    startNextRound(room);
    room.phase = 'predicting';
    const spotlightId = getCurrentSpotlightId(room);
    expect(submitPrediction(room, spotlightId, 'no')).toBe(false);
  });

  it('tracks prediction submission', () => {
    startNextRound(room);
    room.phase = 'answering';
    const spotlightId = getCurrentSpotlightId(room);
    submitAnswer(room, spotlightId, 'yes');

    room.phase = 'predicting';
    const predictors = [hostId, ...playerIds].filter((id) => id !== spotlightId);
    expect(allPredictionsIn(room)).toBe(false);

    for (const pid of predictors) {
      submitPrediction(room, pid, 'no');
    }
    expect(allPredictionsIn(room)).toBe(true);
  });
});

describe('Scoring', () => {
  let room: ServerRoom;
  let hostId: string;
  let playerIds: string[];

  beforeEach(() => {
    ({ room, hostId } = createTestRoom());
    playerIds = addPlayers(room, 3); // 4 total
    startGame(room, sampleDilemmas);
    startNextRound(room);
    room.phase = 'answering';
  });

  afterEach(() => {
    destroyRoom(room.code);
  });

  it('awards 2 points per correct prediction', () => {
    const spotlightId = getCurrentSpotlightId(room);
    submitAnswer(room, spotlightId, 'yes');

    room.phase = 'predicting';
    const predictors = [hostId, ...playerIds].filter((id) => id !== spotlightId);
    predictors.forEach((pid) => submitPrediction(room, pid, 'yes'));

    const result = calculateRoundResult(room)!;
    for (const pid of predictors) {
      // 2 base + 1 consensus = 3
      expect(result.pointsAwarded[pid]).toBe(3);
    }
  });

  it('spotlight earns points for wrong predictions', () => {
    const spotlightId = getCurrentSpotlightId(room);
    submitAnswer(room, spotlightId, 'depends');

    room.phase = 'predicting';
    const predictors = [hostId, ...playerIds].filter((id) => id !== spotlightId);
    predictors.forEach((pid) => submitPrediction(room, pid, 'yes'));

    const result = calculateRoundResult(room)!;
    // 1 per wrong prediction + 2 surprise bonus = predictors.length + 2
    expect(result.pointsAwarded[spotlightId]).toBe(predictors.length + 2);
  });

  it('mixed predictions award correctly', () => {
    const spotlightId = getCurrentSpotlightId(room);
    submitAnswer(room, spotlightId, 'no');

    room.phase = 'predicting';
    const predictors = [hostId, ...playerIds].filter((id) => id !== spotlightId);
    submitPrediction(room, predictors[0], 'no');  // correct
    submitPrediction(room, predictors[1], 'yes'); // wrong
    submitPrediction(room, predictors[2], 'no');  // correct

    const result = calculateRoundResult(room)!;
    expect(result.pointsAwarded[predictors[0]]).toBe(2);
    expect(result.pointsAwarded[predictors[2]]).toBe(2);
    expect(result.pointsAwarded[spotlightId]).toBe(1);
    expect(result.pointsAwarded[predictors[1]]).toBeUndefined();
  });
});

describe('Game Over', () => {
  it('detects end of game', () => {
    const { room, hostId } = createTestRoom();
    addPlayers(room, 2);
    room.settings.rounds = 1;
    room.totalRounds = 1;
    startGame(room, sampleDilemmas);
    startNextRound(room);
    expect(isGameOver(room)).toBe(true);
    destroyRoom(room.code);
  });
});

describe('Client State Projection', () => {
  it('hides spotlight answer during answering', () => {
    const { room, hostId } = createTestRoom();
    const [p1] = addPlayers(room, 2);
    startGame(room, sampleDilemmas);
    startNextRound(room);
    room.phase = 'answering';

    const spotlightId = getCurrentSpotlightId(room);
    submitAnswer(room, spotlightId, 'yes');

    const viewerState = toClientState(room, p1);
    if (p1 !== spotlightId) {
      expect(viewerState.myAnswer).toBeNull();
    }
    destroyRoom(room.code);
  });

  it('shows answer after reveal', () => {
    const { room, hostId } = createTestRoom();
    const [p1] = addPlayers(room, 2);
    startGame(room, sampleDilemmas);
    startNextRound(room);
    room.phase = 'answering';
    const spotlightId = getCurrentSpotlightId(room);
    submitAnswer(room, spotlightId, 'yes');

    room.phase = 'predicting';
    const predictors = [hostId, p1, ...Array.from(room.players.keys())].filter(
      (id, idx, arr) => arr.indexOf(id) === idx && id !== spotlightId
    );
    predictors.forEach((pid) => submitPrediction(room, pid, 'no'));
    calculateRoundResult(room);
    room.phase = 'reveal';

    const state = toClientState(room, p1);
    expect(state.currentRoundResult).toBeTruthy();
    expect(state.currentRoundResult!.spotlightAnswer).toBe('yes');
    destroyRoom(room.code);
  });
});

describe('Disconnection & Rejoin', () => {
  it('marks player as disconnected', () => {
    const { room, hostId } = createTestRoom();
    const [p1] = addPlayers(room, 2);
    const player = room.players.get(p1)!;
    const socketId = player.socketId;

    disconnectPlayer(room, socketId);
    expect(player.isConnected).toBe(false);
    destroyRoom(room.code);
  });

  it('rejoin restores connection', () => {
    const { room, hostId } = createTestRoom();
    const [p1] = addPlayers(room, 2);
    const player = room.players.get(p1)!;
    disconnectPlayer(room, player.socketId);

    const success = rejoinRoom(room, p1, 'new-socket');
    expect(success).toBe(true);
    expect(player.isConnected).toBe(true);
    expect(player.socketId).toBe('new-socket');
    destroyRoom(room.code);
  });
});

describe('Kick & Play Again', () => {
  it('removes kicked player', () => {
    const { room } = createTestRoom();
    const [p1] = addPlayers(room, 2);
    expect(room.players.size).toBe(3);

    kickPlayer(room, p1);
    expect(room.players.size).toBe(2);
    expect(room.players.has(p1)).toBe(false);
    destroyRoom(room.code);
  });

  it('cannot kick the host', () => {
    const { room, hostId } = createTestRoom();
    addPlayers(room, 1);
    const result = kickPlayer(room, hostId);
    expect(result).toBe(false);
    expect(room.players.has(hostId)).toBe(true);
    destroyRoom(room.code);
  });

  it('resets room on play again', () => {
    const { room, hostId } = createTestRoom();
    addPlayers(room, 2);
    startGame(room, sampleDilemmas);
    startNextRound(room);
    room.phase = 'answering';
    submitAnswer(room, getCurrentSpotlightId(room), 'yes');

    resetRoomForPlayAgain(room);
    expect(room.phase).toBe('lobby');
    expect(room.currentRound).toBe(0);
    expect(room.roundResults).toHaveLength(0);
    for (const p of room.players.values()) {
      expect(p.score).toBe(0);
    }
    destroyRoom(room.code);
  });
});

describe('Input Sanitization', () => {
  it('sanitizes player names with HTML characters', () => {
    const { room } = createTestRoom();
    const result = joinRoom(room, 'socket-xss', '<script>alert("xss")</script>');
    expect('playerId' in result).toBe(true);
    if ('playerId' in result) {
      const player = room.players.get(result.playerId)!;
      expect(player.name).not.toContain('<');
      expect(player.name).not.toContain('>');
    }
    destroyRoom(room.code);
  });

  it('truncates long names', () => {
    const { room } = createTestRoom();
    const longName = 'A'.repeat(50);
    const result = joinRoom(room, 'socket-long', longName);
    if ('playerId' in result) {
      const player = room.players.get(result.playerId)!;
      expect(player.name.length).toBeLessThanOrEqual(20);
    }
    destroyRoom(room.code);
  });
});
