import { useState, useEffect } from 'react';

interface Props {
  endsAt: number | null;
  className?: string;
}

export default function Timer({ endsAt, className = '' }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!endsAt) {
      setSecondsLeft(0);
      return;
    }

    function tick() {
      const remaining = Math.max(0, Math.ceil((endsAt! - Date.now()) / 1000));
      setSecondsLeft(remaining);
    }

    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [endsAt]);

  if (!endsAt || secondsLeft <= 0) return null;

  const isUrgent = secondsLeft <= 5;

  return (
    <div
      className={`
        inline-flex items-center gap-2 rounded-full px-4 py-1.5
        font-mono font-bold text-lg tabular-nums
        ${isUrgent ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-white/10 text-white/70'}
        ${className}
      `}
      role="timer"
      aria-live="polite"
      aria-label={`${secondsLeft} seconds remaining`}
    >
      <ClockIcon />
      {secondsLeft}s
    </div>
  );
}

function ClockIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}
