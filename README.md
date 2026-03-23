# Gray Area

**Where do you draw the line?**

A browser-based multiplayer party game about ethical dilemmas and knowing your friends. 3–8 players take turns in the spotlight, answering tricky questions while everyone else predicts their response.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## How It Works

1. **Create a room** — One player creates a game and shares the 4-letter room code
2. **Join** — Everyone else joins from their own device using the code or a share link
3. **Play** — Each round, one player answers a dilemma while others predict their response
4. **Score** — Earn points for correct predictions. Surprise everyone to earn spotlight points.

## Scoring

| Action | Points |
|--------|--------|
| Correct prediction | +2 |
| Spotlight: per wrong prediction | +1 |
| Consensus bonus (all predict correctly) | +1 each |
| Total surprise bonus (nobody correct) | +2 to spotlight |

## Game Modes

- **Family Friendly** — Lighter dilemmas suitable for all ages
- **Mixed** — A variety of topics and tones (default)
- **Party** — Includes edgier, more provocative scenarios

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Express + Socket.io
- **State:** In-memory (ephemeral game rooms)
- **Content:** 250 original dilemmas in structured JSON

No database required — game state is ephemeral by design.

## Project Structure

```
gray-area/
├── server/           # Express + Socket.io backend
│   ├── index.ts      # Server entry point
│   ├── engine.ts     # Game engine + room management
│   └── handlers.ts   # Socket event handlers
├── shared/           # Shared TypeScript types
│   └── types.ts
├── src/              # React frontend
│   ├── pages/        # Route pages
│   ├── components/   # UI components
│   ├── context/      # Game state context
│   └── lib/          # Socket client
├── content/          # Dilemma content database
│   └── dilemmas.json # 250 original dilemmas
└── tests/            # Game engine tests
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (frontend + backend) |
| `npm run build` | Build frontend for production |
| `npm start` | Run production server |
| `npm test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |

## Deployment

### Option 1: Docker (recommended)

```bash
docker build -t gray-area .
docker run -p 3000:3000 gray-area
```

### Option 2: Fly.io

```bash
fly launch
fly deploy
```

### Option 3: Railway / Render

1. Connect your Git repository
2. Set build command: `npm run build`
3. Set start command: `npm start`
4. Deploy

### Option 4: Any Node.js host

```bash
npm ci
npm run build
NODE_ENV=production PORT=3000 npx tsx server/index.ts
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment |

## Adding Content

Dilemmas live in `content/dilemmas.json`. Each entry has:

```json
{
  "id": "E001",
  "text": "Would you return a wallet you found if it had no ID inside?",
  "category": "everyday",
  "tone": "both",
  "difficulty": "medium"
}
```

**Categories:** everyday, social, honesty, money, relationships, technology, hypothetical, lifestyle

**Tone:** family, party, both

**Difficulty:** easy, medium, hard

## License

MIT
