import { useState } from 'react';
import { useGame } from '../context/GameContext';
import PlayerAvatar from './PlayerAvatar';
import type { ClientRoomState } from '../../shared/types';

export default function Lobby({ room }: { room: ClientRoomState }) {
  const { startGame, kickPlayer, updateSettings, leaveRoom, error } = useGame();
  const [copied, setCopied] = useState(false);

  const me = room.players.find((p) => p.id === room.myPlayerId);
  const isHost = me?.isHost ?? false;
  const canStart = room.players.filter((p) => p.isConnected).length >= 3;

  const shareUrl = `${window.location.origin}/?join=${room.code}`;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select a text input
      try {
        await navigator.clipboard.writeText(room.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-8">
      <div className="max-w-lg w-full space-y-6 animate-fadeIn">
        {/* Room Code */}
        <div className="text-center space-y-2">
          <p className="text-white/50 text-sm uppercase tracking-wider">Room Code</p>
          <button
            onClick={copyCode}
            className="text-5xl font-mono font-bold tracking-[0.4em] text-amber-400
                       hover:text-amber-300 transition-colors cursor-pointer"
            aria-label={`Room code: ${room.code}. Click to copy invite link.`}
          >
            {room.code}
          </button>
          <p className="text-white/40 text-sm">
            {copied ? 'Link copied!' : 'Tap code to copy invite link'}
          </p>
        </div>

        {/* Players */}
        <div className="card">
          <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">
            Players ({room.players.length}/8)
          </h3>
          <ul className="space-y-2">
            {room.players.map((player) => (
              <li
                key={player.id}
                className="flex items-center gap-3 py-2 px-3 rounded-xl bg-white/5"
              >
                <PlayerAvatar
                  name={player.name}
                  color={player.color}
                  isConnected={player.isConnected}
                />
                <span className={`font-medium flex-1 ${!player.isConnected ? 'opacity-40' : ''}`}>
                  {player.name}
                  {player.id === room.myPlayerId && (
                    <span className="text-white/40 ml-1">(you)</span>
                  )}
                </span>
                {player.isHost && (
                  <span className="badge bg-amber-500/20 text-amber-400">Host</span>
                )}
                {isHost && !player.isHost && (
                  <button
                    onClick={() => kickPlayer(player.id)}
                    className="text-white/30 hover:text-red-400 transition-colors text-xs px-2 py-1"
                    aria-label={`Remove ${player.name}`}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Settings (host only) */}
        {isHost && (
          <div className="card space-y-3">
            <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider">
              Settings
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="lobby-rounds" className="label">Rounds</label>
                <select
                  id="lobby-rounds"
                  className="input text-sm"
                  value={room.settings.rounds}
                  onChange={(e) => updateSettings({ rounds: Number(e.target.value) })}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                </select>
              </div>
              <div>
                <label htmlFor="lobby-mode" className="label">Mode</label>
                <select
                  id="lobby-mode"
                  className="input text-sm"
                  value={room.settings.contentMode}
                  onChange={(e) =>
                    updateSettings({ contentMode: e.target.value as 'family' | 'party' | 'mixed' })
                  }
                >
                  <option value="family">Family</option>
                  <option value="mixed">Mixed</option>
                  <option value="party">Party</option>
                </select>
              </div>
              <div>
                <label htmlFor="lobby-timer" className="label">Timer</label>
                <select
                  id="lobby-timer"
                  className="input text-sm"
                  value={room.settings.timerSeconds}
                  onChange={(e) => updateSettings({ timerSeconds: Number(e.target.value) })}
                >
                  <option value={15}>15s</option>
                  <option value={30}>30s</option>
                  <option value={60}>60s</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer pb-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded"
                    checked={room.settings.discussionEnabled}
                    onChange={(e) => updateSettings({ discussionEnabled: e.target.checked })}
                  />
                  <span className="text-sm text-white/70">Discussion</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {error && <p className="text-red-400 text-sm text-center" role="alert">{error}</p>}

        {isHost ? (
          <div className="space-y-3">
            <button
              onClick={startGame}
              className="btn-primary w-full text-lg"
              disabled={!canStart}
            >
              {canStart ? 'Start Game' : `Need ${3 - room.players.length} more player${3 - room.players.length === 1 ? '' : 's'}`}
            </button>
            <button onClick={leaveRoom} className="btn-secondary w-full text-sm opacity-60">
              Leave Room
            </button>
          </div>
        ) : (
          <div className="space-y-3 text-center">
            <p className="text-white/50">Waiting for the host to start the game...</p>
            <button onClick={leaveRoom} className="btn-secondary text-sm opacity-60">
              Leave Room
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
