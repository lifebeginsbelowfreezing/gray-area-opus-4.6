import { Link } from 'react-router-dom';

export default function HowToPlayPage() {
  return (
    <div className="flex-1 flex flex-col items-center px-4 py-8">
      <div className="max-w-2xl w-full space-y-8 animate-fadeIn">
        <Link
          to="/"
          className="text-white/50 hover:text-white transition-colors text-sm inline-block"
        >
          &larr; Back to Home
        </Link>

        <h1 className="text-4xl font-bold">
          How to Play{' '}
          <span className="bg-gradient-to-r from-amber-400 to-yellow-200 bg-clip-text text-transparent">
            Gray Area
          </span>
        </h1>

        <div className="space-y-6 text-white/80 leading-relaxed">
          <Section title="The Basics" emoji="1">
            <p>
              Gray Area is a party game about ethical dilemmas and knowing your friends.
              One player answers a tricky question, and everyone else predicts their answer.
            </p>
          </Section>

          <Section title="Setup" emoji="2">
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>One player creates a room and shares the 4-letter code</li>
              <li>Everyone joins from their own device (phone, tablet, or laptop)</li>
              <li>You need 3–8 players to start</li>
              <li>The host picks settings and starts the game</li>
            </ul>
          </Section>

          <Section title="Each Round" emoji="3">
            <ol className="list-decimal list-inside space-y-2 ml-1">
              <li>
                <strong>Spotlight</strong> — One player is put in the hot seat. A dilemma is shown to everyone.
              </li>
              <li>
                <strong>Answer</strong> — The spotlight player secretly picks
                <em> Yes</em>, <em>No</em>, or <em>It Depends</em>.
              </li>
              <li>
                <strong>Predict</strong> — Everyone else predicts what the spotlight player chose.
              </li>
              <li>
                <strong>Discuss</strong> (optional) — Debate the dilemma before the reveal.
              </li>
              <li>
                <strong>Reveal</strong> — The answer is shown and points are awarded.
              </li>
            </ol>
          </Section>

          <Section title="Scoring" emoji="4">
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>
                <strong>Correct prediction:</strong> 2 points
              </li>
              <li>
                <strong>Spotlight player:</strong> 1 point for each wrong prediction (you surprised them!)
              </li>
              <li>
                <strong>Consensus bonus:</strong> If ALL predictors guess right, each gets +1
              </li>
              <li>
                <strong>Surprise bonus:</strong> If NOBODY guesses right, spotlight player gets +2 extra
              </li>
            </ul>
          </Section>

          <Section title="Winning" emoji="5">
            <p>
              After all rounds are played, the player with the most points wins.
              The real winner, though, is whoever started the best argument.
            </p>
          </Section>

          <Section title="Content Modes" emoji="6">
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li><strong>Family Friendly:</strong> Lighter, appropriate-for-all-ages dilemmas</li>
              <li><strong>Mixed:</strong> A variety of topics and tones</li>
              <li><strong>Party:</strong> Includes edgier, more provocative scenarios</li>
            </ul>
          </Section>
        </div>

        <Link to="/" className="btn-primary inline-block">
          Start Playing
        </Link>
      </div>
    </div>
  );
}

function Section({
  title,
  emoji,
  children,
}: {
  title: string;
  emoji: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card space-y-3">
      <h2 className="text-xl font-semibold flex items-center gap-3">
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 text-sm font-bold">
          {emoji}
        </span>
        {title}
      </h2>
      {children}
    </div>
  );
}
