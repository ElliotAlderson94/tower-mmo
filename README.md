# Tower MMO – Browser Multiplayer Foundation

A 2D multiplayer tower-climbing game inspired by tower manhwas (Tower of God, Solo Leveling style).

## Current Features
- Browser-based (Phaser 3)
- Real-time multiplayer (WebSocket)
- Player join / leave
- Movement sync
- Basic chat
- Floor 1 (Entrance Hall)
- Name tags + unique colors
- Simple HUD (name, level, floor, HP bar)

## How to Run

### 1. Install dependencies
```bash
cd server
npm install
```

### 2. Start the server
```bash
npm start
```

### 3. Open the game
Go to: **http://localhost:3000**

Open multiple browser tabs (or different browsers) to test multiplayer.

## Controls
- **WASD** or **Arrow Keys** → Move
- **Enter** → Chat
- **Space** → Attack (placeholder)

## Project Structure
```
tower-mmo/
├── server/
│   ├── index.js          # WebSocket + Express server
│   └── package.json
└── client/
    ├── index.html
    ├── style.css
    └── game.js           # Phaser 3 client
```

## Next Steps (recommended order)
1. Add proper player sprites / animations
2. Basic combat (HP, damage, death)
3. Simple enemies on Floor 1
4. Floor clearing → teleport to Floor 2
5. Stats + leveling
6. Skills
7. Ranking / leaderboard
8. Inventory & loot

## Notes
- Server is authoritative for positions
- Currently one shared floor (Floor 1)
- No persistence yet (refresh = new character)
