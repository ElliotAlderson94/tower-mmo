const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
function uuidv4() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) { const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8); return v.toString(16); }); }
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, '../client')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// ============ GAME STATE ============
const players = new Map(); // id -> player data
const FLOOR_WIDTH = 1200;
const FLOOR_HEIGHT = 800;

function createPlayer(id, name) {
  return {
    id,
    name: name || `Climber_${id.slice(0, 4)}`,
    x: 200 + Math.random() * 200,
    y: 400,
    vx: 0,
    vy: 0,
    direction: 'right',
    floor: 1,
    hp: 100,
    maxHp: 100,
    level: 1,
    color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
    lastUpdate: Date.now()
  };
}

function broadcast(data, excludeId = null) {
  const msg = JSON.stringify(data);
  for (const [id, player] of players) {
    if (id !== excludeId && player.ws && player.ws.readyState === 1) {
      player.ws.send(msg);
    }
  }
}

function broadcastAll(data) {
  const msg = JSON.stringify(data);
  for (const player of players.values()) {
    if (player.ws && player.ws.readyState === 1) {
      player.ws.send(msg);
    }
  }
}

// ============ WEBSOCKET ============
wss.on('connection', (ws) => {
  const id = uuidv4();
  console.log(`[+] Player connected: ${id}`);

  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    switch (data.type) {
      case 'join': {
        const player = createPlayer(id, data.name);
        player.ws = ws;
        players.set(id, player);

        // Send current state to the new player
        ws.send(JSON.stringify({
          type: 'welcome',
          id,
          player: {
            id: player.id,
            name: player.name,
            x: player.x,
            y: player.y,
            floor: player.floor,
            hp: player.hp,
            maxHp: player.maxHp,
            level: player.level,
            color: player.color
          },
          others: Array.from(players.values())
            .filter(p => p.id !== id)
            .map(p => ({
              id: p.id,
              name: p.name,
              x: p.x,
              y: p.y,
              floor: p.floor,
              hp: p.hp,
              maxHp: p.maxHp,
              level: p.level,
              color: p.color,
              direction: p.direction
            }))
        }));

        // Notify others
        broadcast({
          type: 'player_joined',
          player: {
            id: player.id,
            name: player.name,
            x: player.x,
            y: player.y,
            floor: player.floor,
            hp: player.hp,
            maxHp: player.maxHp,
            level: player.level,
            color: player.color,
            direction: player.direction
          }
        }, id);

        console.log(`Player ${player.name} joined Floor ${player.floor}. Total: ${players.size}`);
        break;
      }

      case 'move': {
        const player = players.get(id);
        if (!player) return;

        // Basic validation
        player.x = Math.max(20, Math.min(FLOOR_WIDTH - 20, data.x));
        player.y = Math.max(20, Math.min(FLOOR_HEIGHT - 20, data.y));
        player.direction = data.direction || player.direction;
        player.lastUpdate = Date.now();

        broadcast({
          type: 'player_moved',
          id,
          x: player.x,
          y: player.y,
          direction: player.direction
        }, id);
        break;
      }

      case 'chat': {
        const player = players.get(id);
        if (!player || !data.message) return;

        broadcastAll({
          type: 'chat',
          id,
          name: player.name,
          message: data.message.slice(0, 120)
        });
        break;
      }

      case 'attack': {
        // Placeholder for future combat
        const player = players.get(id);
        if (!player) return;

        broadcast({
          type: 'player_attack',
          id,
          x: player.x,
          y: player.y,
          direction: player.direction
        }, id);
        break;
      }
    }
  });

  ws.on('close', () => {
    const player = players.get(id);
    if (player) {
      console.log(`[-] Player left: ${player.name}`);
      players.delete(id);
      broadcastAll({
        type: 'player_left',
        id
      });
    }
  });

  ws.on('error', (err) => {
    console.error('WS error:', err.message);
  });
});

// Simple heartbeat / cleanup
setInterval(() => {
  const now = Date.now();
  for (const [id, player] of players) {
    if (now - player.lastUpdate > 60000) {
      // optional timeout
    }
  }
}, 10000);

server.listen(PORT, () => {
  console.log(`=====================================`);
  console.log(`  Tower MMO Server running`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`=====================================`);
});
