import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import Lobby from '../components/Lobby';
import GameView from '../components/GameView';

export default function RoomPage() {
  const { roomState, isConnected } = useGame();
  const navigate = useNavigate();

  if (!roomState) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4">
        <p className="text-white/50">
          {isConnected ? 'Loading room...' : 'Connecting...'}
        </p>
        <button
          onClick={() => navigate('/', { replace: true })}
          className="btn-secondary text-sm"
        >
          Back to Home
        </button>
      </div>
    );
  }

  if (roomState.phase === 'lobby') {
    return <Lobby room={roomState} />;
  }

  return <GameView room={roomState} />;
}
