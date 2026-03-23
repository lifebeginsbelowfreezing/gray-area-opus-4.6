import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../lib/socket';
import type { ClientRoomState, GameSettings, Answer } from '../../shared/types';

// ─── Session persistence ─────────────────────────────────

interface SessionData {
  roomCode: string;
  playerId: string;
}

function saveSession(data: SessionData) {
  try {
    localStorage.setItem('gray-area-session', JSON.stringify(data));
  } catch {}
}

function loadSession(): SessionData | null {
  try {
    const raw = localStorage.getItem('gray-area-session');
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.roomCode && data.playerId) return data;
  } catch {}
  return null;
}

function clearSession() {
  try {
    localStorage.removeItem('gray-area-session');
  } catch {}
}

// ─── Context Type ────────────────────────────────────────

interface GameContextType {
  roomState: ClientRoomState | null;
  error: string | null;
  isConnected: boolean;
  clearError: () => void;
  createRoom: (playerName: string, settings: GameSettings) => void;
  joinRoom: (roomCode: string, playerName: string) => void;
  startGame: () => void;
  submitAnswer: (answer: Answer) => void;
  submitPrediction: (prediction: Answer) => void;
  skipPhase: () => void;
  kickPlayer: (playerId: string) => void;
  updateSettings: (settings: Partial<GameSettings>) => void;
  leaveRoom: () => void;
  playAgain: () => void;
}

const GameContext = createContext<GameContextType | null>(null);

// ─── Provider ────────────────────────────────────────────

export function GameProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [roomState, setRoomState] = useState<ClientRoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const hasTriedRejoin = useRef(false);

  // Connect socket on mount
  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    function onConnect() {
      setIsConnected(true);

      // Try to rejoin previous session
      if (!hasTriedRejoin.current) {
        hasTriedRejoin.current = true;
        const session = loadSession();
        if (session) {
          socket.emit('rejoin-room', {
            roomCode: session.roomCode,
            playerId: session.playerId,
          });
        }
      }
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    function onRoomState(state: ClientRoomState) {
      setRoomState(state);
      setError(null);
      saveSession({ roomCode: state.code, playerId: state.myPlayerId });
    }

    function onError(data: { message: string }) {
      setError(data.message);
      setTimeout(() => setError(null), 5000);
    }

    function onKicked() {
      setRoomState(null);
      clearSession();
      navigate('/', { replace: true });
      setError('You were removed from the room');
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room-state', onRoomState);
    socket.on('error', onError);
    socket.on('kicked', onKicked);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room-state', onRoomState);
      socket.off('error', onError);
      socket.off('kicked', onKicked);
    };
  }, [navigate]);

  // Navigate based on room state changes
  useEffect(() => {
    if (roomState) {
      navigate(`/room/${roomState.code}`, { replace: true });
    }
  }, [roomState?.code]);

  const clearError = useCallback(() => setError(null), []);

  const createRoom = useCallback((playerName: string, settings: GameSettings) => {
    socket.emit('create-room', { playerName, settings });
  }, []);

  const joinRoom = useCallback((roomCode: string, playerName: string) => {
    socket.emit('join-room', { roomCode, playerName });
  }, []);

  const startGame = useCallback(() => {
    socket.emit('start-game');
  }, []);

  const submitAnswer = useCallback((answer: Answer) => {
    socket.emit('submit-answer', { answer });
  }, []);

  const submitPrediction = useCallback((prediction: Answer) => {
    socket.emit('submit-prediction', { prediction });
  }, []);

  const skipPhase = useCallback(() => {
    socket.emit('skip-phase');
  }, []);

  const kickPlayer = useCallback((playerId: string) => {
    socket.emit('kick-player', { playerId });
  }, []);

  const updateSettings = useCallback((settings: Partial<GameSettings>) => {
    socket.emit('update-settings', { settings });
  }, []);

  const leaveRoom = useCallback(() => {
    socket.emit('leave-room');
    setRoomState(null);
    clearSession();
    navigate('/', { replace: true });
  }, [navigate]);

  const playAgain = useCallback(() => {
    socket.emit('play-again');
  }, []);

  return (
    <GameContext.Provider
      value={{
        roomState,
        error,
        isConnected,
        clearError,
        createRoom,
        joinRoom,
        startGame,
        submitAnswer,
        submitPrediction,
        skipPhase,
        kickPlayer,
        updateSettings,
        leaveRoom,
        playAgain,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────

export function useGame(): GameContextType {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
