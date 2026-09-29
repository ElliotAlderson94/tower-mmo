# TOWER — Multiplayer Tower Climbing MMO

## Run locally

```bash
cd server
npm install
npm start
```

Open **http://localhost:3000**

## Build error: "No entrypoint found which imports express"

Fixed in v2.3 — `server/index.js` now imports **express** for static files + WebSocket.

```bash
git pull
cd server
npm install
npm start
```

### Vercel note
Vercel is for static/serverless apps. This game needs a **persistent WebSocket server**.
Use **local**, **Render**, or **Railway** for the full multiplayer server.
`vercel.json` can host the static client only; the game server should run elsewhere.

## Features
- Register / Login (saved progress)
- Combat, skills (Q/E/R), floors 1–3
- Inventory: click potions to use, weapons to equip
- Shop (gold)
- Skill cooldown UI
- Stats / Profile / Quests panels

## Controls
WASD move · Space attack · Q/E/R skills · Side buttons for panels
