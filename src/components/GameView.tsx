import { useGame } from '../context/GameContext';
import Timer from './Timer';
import PlayerAvatar from './PlayerAvatar';
import type { ClientRoomState, Answer, RoundResult, ClientPlayer } from '../../shared/types';

export default function GameView({ room }: { room: ClientRoomState }) {
  const phase = room.phase;

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-6">
      <div className="max-w-lg w-full space-y-5">
        {/* Round indicator */}
        <div className="flex items-center justify-between">
          <span className="text-white/40 text-sm font-medium">
            Round {room.currentRound} / {room.totalRounds}
          </span>
          <Timer endsAt={room.phaseEndsAt} />
        </div>

        {/* Phase content */}
        {phase === 'presenting' && <PresentingPhase room={room} />}
        {phase === 'answering' && <AnsweringPhase room={room} />}
        {phase === 'predicting' && <PredictingPhase room={room} />}
        {phase === 'discussion' && <DiscussionPhase room={room} />}
        {phase === 'reveal' && <RevealPhase room={room} />}
        {phase === 'scores' && <ScoresPhase room={room} />}
        {phase === 'finished' && <FinishedPhase room={room} />}
      </div>
    </div>
  );
}

// ─── Presenting ──────────────────────────────────────────

function PresentingPhase({ room }: { room: ClientRoomState }) {
  const spotlight = room.players.find((p) => p.id === room.spotlightPlayerId);

  return (
    <div className="animate-scaleIn space-y-6 text-center">
      <SpotlightBadge player={spotlight} isMe={room.spotlightPlayerId === room.myPlayerId} />
      <DilemmaCard text={room.currentDilemma?.text ?? ''} />
      <p className="text-white/40 text-sm">Get ready...</p>
    </div>
  );
}

// ─── Answering ───────────────────────────────────────────

function AnsweringPhase({ room }: { room: ClientRoomState }) {
  const { submitAnswer } = useGame();
  const isSpotlight = room.spotlightPlayerId === room.myPlayerId;
  const spotlight = room.players.find((p) => p.id === room.spotlightPlayerId);

  return (
    <div className="animate-fadeIn space-y-6">
      <SpotlightBadge player={spotlight} isMe={isSpotlight} />
      <DilemmaCard text={room.currentDilemma?.text ?? ''} />

      {isSpotlight ? (
        room.myAnswer ? (
          <div className="text-center space-y-2">
            <p className="text-white/60">You answered:</p>
            <AnswerBadge answer={room.myAnswer} large />
            <p className="text-white/40 text-sm">Waiting for predictions...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-white/70 font-medium">What&apos;s your answer?</p>
            <AnswerButtons onSelect={submitAnswer} />
          </div>
        )
      ) : (
        <div className="text-center">
          <p className="text-white/50">
            Waiting for <strong className="text-white">{spotlight?.name}</strong> to answer...
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Predicting ──────────────────────────────────────────

function PredictingPhase({ room }: { room: ClientRoomState }) {
  const { submitPrediction } = useGame();
  const isSpotlight = room.spotlightPlayerId === room.myPlayerId;
  const spotlight = room.players.find((p) => p.id === room.spotlightPlayerId);
  const totalPredictors = room.players.filter(
    (p) => p.id !== room.spotlightPlayerId && p.isConnected
  ).length;

  return (
    <div className="animate-fadeIn space-y-6">
      <DilemmaCard text={room.currentDilemma?.text ?? ''} />

      {isSpotlight ? (
        <div className="text-center space-y-3">
          <p className="text-white/60">You answered. Now others are predicting...</p>
          <ProgressDots
            total={totalPredictors}
            filled={room.submittedPredictionIds.length}
            label="predictions"
          />
        </div>
      ) : room.myPrediction ? (
        <div className="text-center space-y-2">
          <p className="text-white/60">Your prediction:</p>
          <AnswerBadge answer={room.myPrediction} large />
          <ProgressDots
            total={totalPredictors}
            filled={room.submittedPredictionIds.length}
            label="predictions"
          />
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-center text-white/70 font-medium">
            How did <strong className="text-white">{spotlight?.name}</strong> answer?
          </p>
          <AnswerButtons onSelect={submitPrediction} />
        </div>
      )}
    </div>
  );
}

// ─── Discussion ──────────────────────────────────────────

function DiscussionPhase({ room }: { room: ClientRoomState }) {
  const { skipPhase } = useGame();
  const me = room.players.find((p) => p.id === room.myPlayerId);

  return (
    <div className="animate-fadeIn space-y-6">
      <DilemmaCard text={room.currentDilemma?.text ?? ''} />

      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-400 rounded-full px-5 py-2 font-semibold">
          <ChatIcon />
          Time to Discuss!
        </div>
        <p className="text-white/50 text-sm">
          Debate, persuade, and defend your position.
        </p>

        {me?.isHost && (
          <button onClick={skipPhase} className="btn-secondary text-sm">
            Skip to Reveal
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Reveal ──────────────────────────────────────────────

function RevealPhase({ room }: { room: ClientRoomState }) {
  const { skipPhase } = useGame();
  const result = room.currentRoundResult;
  const me = room.players.find((p) => p.id === room.myPlayerId);
  if (!result) return null;

  const spotlight = room.players.find((p) => p.id === result.spotlightPlayerId);

  return (
    <div className="animate-scaleIn space-y-6">
      <DilemmaCard text={result.dilemma.text} />

      {/* Spotlight answer */}
      <div className="text-center space-y-2">
        <p className="text-white/50 text-sm">
          {spotlight?.name} answered:
        </p>
        <div className="animate-pop">
          <AnswerBadge answer={result.spotlightAnswer} large />
        </div>
      </div>

      {/* Predictions */}
      <div className="card space-y-3">
        <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider">Predictions</h3>
        <ul className="space-y-2">
          {Object.entries(result.predictions).map(([playerId, prediction]) => {
            const player = room.players.find((p) => p.id === playerId);
            if (!player) return null;
            const correct = prediction === result.spotlightAnswer;
            const points = result.pointsAwarded[playerId] || 0;

            return (
              <li
                key={playerId}
                className={`flex items-center gap-3 py-2 px-3 rounded-xl ${
                  correct ? 'bg-green-500/10' : 'bg-red-500/10'
                }`}
              >
                <PlayerAvatar name={player.name} color={player.color} size="sm" />
                <span className="flex-1 font-medium">{player.name}</span>
                <AnswerBadge answer={prediction} />
                <span className={`font-bold ${correct ? 'text-green-400' : 'text-red-400'}`}>
                  {correct ? '✓' : '✗'}
                </span>
                {points > 0 && (
                  <span className="text-amber-400 font-bold text-sm">+{points}</span>
                )}
              </li>
            );
          })}
        </ul>

        {/* Spotlight points */}
        {result.pointsAwarded[result.spotlightPlayerId] > 0 && (
          <p className="text-center text-sm text-amber-400 font-medium pt-2 border-t border-white/5">
            {spotlight?.name} earned +{result.pointsAwarded[result.spotlightPlayerId]} for surprising people
          </p>
        )}
      </div>

      {me?.isHost && (
        <button onClick={skipPhase} className="btn-secondary w-full text-sm">
          Next
        </button>
      )}
    </div>
  );
}

// ─── Scores ──────────────────────────────────────────────

function ScoresPhase({ room }: { room: ClientRoomState }) {
  const { skipPhase } = useGame();
  const me = room.players.find((p) => p.id === room.myPlayerId);
  const sorted = [...room.players].sort((a, b) => b.score - a.score);

  return (
    <div className="animate-slideUp space-y-6">
      <h2 className="text-2xl font-bold text-center">Scoreboard</h2>

      <div className="card">
        <ul className="space-y-2">
          {sorted.map((player, i) => (
            <li
              key={player.id}
              className={`flex items-center gap-3 py-3 px-4 rounded-xl ${
                i === 0 ? 'bg-amber-500/10' : 'bg-white/5'
              }`}
            >
              <span className="w-6 text-center font-bold text-white/40">{i + 1}</span>
              <PlayerAvatar
                name={player.name}
                color={player.color}
                highlight={player.id === room.myPlayerId}
              />
              <span className="flex-1 font-medium">
                {player.name}
                {player.id === room.myPlayerId && (
                  <span className="text-white/40 ml-1">(you)</span>
                )}
              </span>
              <span className="text-xl font-bold text-amber-400">{player.score}</span>
            </li>
          ))}
        </ul>
      </div>

      {me?.isHost && (
        <button onClick={skipPhase} className="btn-secondary w-full text-sm">
          Next Round
        </button>
      )}
    </div>
  );
}

// ─── Finished ────────────────────────────────────────────

function FinishedPhase({ room }: { room: ClientRoomState }) {
  const { playAgain, leaveRoom } = useGame();
  const me = room.players.find((p) => p.id === room.myPlayerId);
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];

  // Stats
  const allResults = [...room.pastResults, room.currentRoundResult].filter(Boolean) as RoundResult[];

  const spotlightCounts: Record<string, number> = {};
  const surpriseCounts: Record<string, number> = {};
  for (const r of allResults) {
    spotlightCounts[r.spotlightPlayerId] = (spotlightCounts[r.spotlightPlayerId] || 0) + 1;
    const wrongCount = Object.values(r.predictions).filter((p) => p !== r.spotlightAnswer).length;
    if (wrongCount === Object.values(r.predictions).length && wrongCount > 0) {
      surpriseCounts[r.spotlightPlayerId] = (surpriseCounts[r.spotlightPlayerId] || 0) + 1;
    }
  }

  const mostSurprising = Object.entries(surpriseCounts).sort((a, b) => b[1] - a[1])[0];
  const mostSurprisingPlayer = mostSurprising
    ? room.players.find((p) => p.id === mostSurprising[0])
    : null;

  return (
    <div className="animate-slideUp space-y-6">
      <div className="text-center space-y-3">
        <p className="text-white/50 text-sm uppercase tracking-wider">Game Over</p>
        <h2 className="text-4xl font-extrabold">
          <span className="bg-gradient-to-r from-amber-400 to-yellow-200 bg-clip-text text-transparent">
            {winner?.name} Wins!
          </span>
        </h2>
        <p className="text-white/40">with {winner?.score} points</p>
      </div>

      {/* Final standings */}
      <div className="card">
        <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">
          Final Standings
        </h3>
        <ul className="space-y-2">
          {sorted.map((player, i) => (
            <li
              key={player.id}
              className={`flex items-center gap-3 py-3 px-4 rounded-xl ${
                i === 0 ? 'bg-amber-500/15' : 'bg-white/5'
              }`}
            >
              <span className="w-8 text-center text-lg">
                {i === 0 ? '🏆' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
              </span>
              <PlayerAvatar name={player.name} color={player.color} />
              <span className="flex-1 font-medium">
                {player.name}
                {player.id === room.myPlayerId && (
                  <span className="text-white/40 ml-1">(you)</span>
                )}
              </span>
              <span className="text-xl font-bold text-amber-400">{player.score}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Fun stats */}
      {mostSurprisingPlayer && (
        <div className="card text-center">
          <p className="text-white/50 text-sm">Most Unpredictable</p>
          <p className="font-bold text-lg text-brand-300">
            {mostSurprisingPlayer.name}
          </p>
          <p className="text-white/40 text-xs">
            Fooled everyone {mostSurprising![1]} time{mostSurprising![1] > 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        {me?.isHost && (
          <button onClick={playAgain} className="btn-primary w-full text-lg">
            Play Again
          </button>
        )}
        {!me?.isHost && (
          <p className="text-center text-white/50 text-sm">
            Waiting for host to start a new game...
          </p>
        )}
        <button onClick={leaveRoom} className="btn-secondary w-full text-sm opacity-60">
          Leave
        </button>
      </div>
    </div>
  );
}

// ─── Shared UI Components ────────────────────────────────

function DilemmaCard({ text }: { text: string }) {
  return (
    <div className="card-solid text-center py-8 px-6">
      <p className="text-lg sm:text-xl font-medium leading-relaxed text-balance">{text}</p>
    </div>
  );
}

function SpotlightBadge({
  player,
  isMe,
}: {
  player: ClientPlayer | undefined;
  isMe: boolean;
}) {
  if (!player) return null;
  return (
    <div className="flex items-center justify-center gap-2">
      <PlayerAvatar name={player.name} color={player.color} size="sm" />
      <span className="text-white/70">
        {isMe ? (
          <strong className="text-amber-400">You&apos;re in the Spotlight</strong>
        ) : (
          <>
            <strong className="text-white">{player.name}</strong> is in the Spotlight
          </>
        )}
      </span>
    </div>
  );
}

function AnswerButtons({ onSelect }: { onSelect: (a: Answer) => void }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <button
        onClick={() => onSelect('yes')}
        className="btn-answer bg-green-500/10 border-green-500/30 text-green-400
                   hover:bg-green-500/20 hover:border-green-400 focus:ring-green-400"
      >
        Yes
      </button>
      <button
        onClick={() => onSelect('no')}
        className="btn-answer bg-red-500/10 border-red-500/30 text-red-400
                   hover:bg-red-500/20 hover:border-red-400 focus:ring-red-400"
      >
        No
      </button>
      <button
        onClick={() => onSelect('depends')}
        className="btn-answer bg-amber-500/10 border-amber-500/30 text-amber-400
                   hover:bg-amber-500/20 hover:border-amber-400 focus:ring-amber-400"
      >
        Depends
      </button>
    </div>
  );
}

function AnswerBadge({ answer, large }: { answer: Answer; large?: boolean }) {
  const styles = {
    yes: 'bg-green-500/20 text-green-400',
    no: 'bg-red-500/20 text-red-400',
    depends: 'bg-amber-500/20 text-amber-400',
  };
  const labels = { yes: 'Yes', no: 'No', depends: 'Depends' };

  return (
    <span
      className={`
        badge ${styles[answer]}
        ${large ? 'text-lg px-5 py-2 font-bold' : ''}
      `}
    >
      {labels[answer]}
    </span>
  );
}

function ProgressDots({
  total,
  filled,
  label,
}: {
  total: number;
  filled: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-colors duration-300 ${
              i < filled ? 'bg-amber-400' : 'bg-white/20'
            }`}
          />
        ))}
      </div>
      <p className="text-white/40 text-xs">
        {filled}/{total} {label}
      </p>
    </div>
  );
}

function ChatIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
