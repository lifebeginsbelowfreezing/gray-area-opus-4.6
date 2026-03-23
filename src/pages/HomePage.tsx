import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { DEFAULT_SETTINGS } from '../../shared/types';
import type { GameSettings } from '../../shared/types';

type View = 'home' | 'create' | 'join';

export default function HomePage() {
  const [searchParams] = useSearchParams();
  const prefillCode = searchParams.get('join') || '';

  const [view, setView] = useState<View>(prefillCode ? 'join' : 'home');

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
      {view === 'home' && <HomeView onNavigate={setView} />}
      {view === 'create' && <CreateView onBack={() => setView('home')} />}
      {view === 'join' && <JoinView onBack={() => setView('home')} prefillCode={prefillCode} />}
    </div>
  );
}

// ─── Home ────────────────────────────────────────────────

function HomeView({ onNavigate }: { onNavigate: (v: View) => void }) {
  return (
    <div className="animate-fadeIn text-center max-w-md w-full space-y-8">
      <div className="space-y-3">
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight">
          <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-200 bg-clip-text text-transparent">
            Gray Area
          </span>
        </h1>
        <p className="text-white/60 text-lg">Where do you draw the line?</p>
      </div>

      <div className="space-y-3">
        <button onClick={() => onNavigate('create')} className="btn-primary w-full text-lg">
          Create Game
        </button>
        <button onClick={() => onNavigate('join')} className="btn-secondary w-full text-lg">
          Join Game
        </button>
      </div>

      <Link
        to="/how-to-play"
        className="inline-block text-white/50 hover:text-white/80 transition-colors text-sm underline underline-offset-4"
      >
        How to Play
      </Link>
    </div>
  );
}

// ─── Create Game ─────────────────────────────────────────

function CreateView({ onBack }: { onBack: () => void }) {
  const { createRoom, error } = useGame();
  const [name, setName] = useState('');
  const [settings, setSettings] = useState<GameSettings>({ ...DEFAULT_SETTINGS });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createRoom(name.trim(), settings);
  }

  return (
    <div className="animate-fadeIn max-w-md w-full space-y-6">
      <button onClick={onBack} className="text-white/50 hover:text-white transition-colors text-sm">
        &larr; Back
      </button>

      <h2 className="text-3xl font-bold">Create Game</h2>

      <form onSubmit={handleCreate} className="space-y-5">
        <div>
          <label htmlFor="create-name" className="label">Your Name</label>
          <input
            id="create-name"
            type="text"
            className="input"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            autoFocus
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="rounds" className="label">Rounds</label>
          <select
            id="rounds"
            className="input"
            value={settings.rounds}
            onChange={(e) => setSettings((s) => ({ ...s, rounds: Number(e.target.value) }))}
          >
            <option value={5}>5 — Quick</option>
            <option value={10}>10 — Standard</option>
            <option value={15}>15 — Long</option>
            <option value={20}>20 — Marathon</option>
          </select>
        </div>

        <div>
          <label htmlFor="content-mode" className="label">Content Mode</label>
          <select
            id="content-mode"
            className="input"
            value={settings.contentMode}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                contentMode: e.target.value as GameSettings['contentMode'],
              }))
            }
          >
            <option value="family">Family Friendly</option>
            <option value="mixed">Mixed</option>
            <option value="party">Party</option>
          </select>
        </div>

        <div>
          <label htmlFor="timer" className="label">Answer Timer</label>
          <select
            id="timer"
            className="input"
            value={settings.timerSeconds}
            onChange={(e) => setSettings((s) => ({ ...s, timerSeconds: Number(e.target.value) }))}
          >
            <option value={15}>15 seconds — Fast</option>
            <option value={30}>30 seconds — Normal</option>
            <option value={60}>60 seconds — Relaxed</option>
          </select>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="h-5 w-5 rounded border-white/20 bg-white/10 text-amber-500 focus:ring-amber-400"
            checked={settings.discussionEnabled}
            onChange={(e) => setSettings((s) => ({ ...s, discussionEnabled: e.target.checked }))}
          />
          <span className="text-white/80">Enable discussion phase</span>
        </label>

        {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}

        <button type="submit" className="btn-primary w-full" disabled={!name.trim()}>
          Create Room
        </button>
      </form>
    </div>
  );
}

// ─── Join Game ───────────────────────────────────────────

function JoinView({ onBack, prefillCode }: { onBack: () => void; prefillCode: string }) {
  const { joinRoom, error } = useGame();
  const [name, setName] = useState('');
  const [code, setCode] = useState(prefillCode);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    joinRoom(code.trim().toUpperCase(), name.trim());
  }

  return (
    <div className="animate-fadeIn max-w-md w-full space-y-6">
      <button onClick={onBack} className="text-white/50 hover:text-white transition-colors text-sm">
        &larr; Back
      </button>

      <h2 className="text-3xl font-bold">Join Game</h2>

      <form onSubmit={handleJoin} className="space-y-5">
        <div>
          <label htmlFor="join-code" className="label">Room Code</label>
          <input
            id="join-code"
            type="text"
            className="input text-center text-2xl tracking-[0.3em] uppercase font-mono"
            placeholder="ABCD"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
            maxLength={4}
            autoFocus={!prefillCode}
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="join-name" className="label">Your Name</label>
          <input
            id="join-name"
            type="text"
            className="input"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            autoFocus={!!prefillCode}
            autoComplete="off"
          />
        </div>

        {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={!name.trim() || code.length < 4}
        >
          Join Room
        </button>
      </form>
    </div>
  );
}
