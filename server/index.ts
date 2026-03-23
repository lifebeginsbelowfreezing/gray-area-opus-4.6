import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { registerHandlers } from './handlers.js';
import { cleanupStaleRooms, getAllRooms } from './engine.js';
import type { Dilemma, ClientToServerEvents, ServerToClientEvents } from '../shared/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT || (isProd ? '3000' : '3001'), 10);

// ─── Load Dilemmas ───────────────────────────────────────

const dilemmasPath = join(__dirname, '..', 'content', 'dilemmas.json');
let allDilemmas: Dilemma[];
try {
  allDilemmas = JSON.parse(readFileSync(dilemmasPath, 'utf-8'));
  console.log(`Loaded ${allDilemmas.length} dilemmas`);
} catch (err) {
  console.error('Failed to load dilemmas:', err);
  allDilemmas = [];
}

// ─── Express ─────────────────────────────────────────────

const app = express();
const httpServer = createServer(app);

app.use(express.json());

if (isProd) {
  const distPath = join(__dirname, '..', 'dist');
  app.use(express.static(distPath));

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      rooms: getAllRooms().size,
      dilemmas: allDilemmas.length,
    });
  });

  // SPA fallback
  app.get('*', (_req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

// ─── Socket.IO ───────────────────────────────────────────

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: isProd
    ? {}
    : {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST'],
      },
  pingInterval: 10000,
  pingTimeout: 15000,
});

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  registerHandlers(io, socket, allDilemmas);
});

// ─── Stale Room Cleanup ─────────────────────────────────

setInterval(cleanupStaleRooms, 60_000);

// ─── Start ───────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`Gray Area server running on port ${PORT}`);
  if (!isProd) {
    console.log(`WebSocket server ready — Vite proxy should forward from :5173`);
  }
});
