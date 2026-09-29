# TOWER — Multiplayer Tower Climbing MMO

Pixel-style 2D multiplayer tower climber inspired by tower manhwas.

## Features

### Core
- Real-time multiplayer
- Combat + 3 skills (Q Slash, E Dash, R Shockwave)
- Enemies & Floor Bosses
- Floors 1–3 with progression
- Stats (STR/AGI/VIT) + Leveling
- Gold, XP, loot drops

### Account System
- **Register / Login**
- Progress saved to server (level, gold, inventory, highest floor, kills, etc.)

### UI (Pixel RPG style)
- Portrait + HP/MP/XP bars + Gold + Hearts
- Side buttons: Inventory · Stats · Profile · Quests
- Sliding parchment panels
- Skill bar, chat, death screen, level-up flash, toasts

### Profile Stats
- Title, Level, Highest Floor, Gold, Kills, Bosses, Deaths

## Run

```bash
cd server
npm install
npm start
```

Open http://localhost:3000

1. Register an account
2. Login
3. Climb

## Controls

| Key | Action |
|-----|--------|
| WASD / Arrows | Move |
| Space | Attack |
| Q | Slash |
| E | Dash |
| R | Shockwave |
| Side buttons | Open panels |

## Stack

- Phaser 3 (client)
- Node.js + Express + WebSocket (server)
- File-based account storage (`accounts.json`)
