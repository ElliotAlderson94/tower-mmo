# TOWER — Multiplayer Tower Climbing MMO

Pixel-style 2D multiplayer tower climber inspired by tower manhwas.

## Features

- Real-time multiplayer (WebSocket)
- Register / Login with saved progress
- Combat + skills (Q / E / R)
- Enemies, bosses, floors 1–3
- Stats, leveling, gold, loot
- Inventory / Stats / Profile / Quests panels
- Pixel RPG UI

## Run

```bash
cd server
npm install
npm start
```

Open http://localhost:3000 → Register → Login → Climb

## Controls

| Key | Action |
|-----|--------|
| WASD / Arrows | Move |
| Space | Attack |
| Q | Slash |
| E | Dash |
| R | Shockwave |
| Escape | Close panels |
| Side buttons | Inventory / Stats / Profile / Quests |

## Notes

- Passwords are hashed (SHA-256)
- Progress auto-saves on disconnect and every 60s
- Re-login kicks the previous session for that account
