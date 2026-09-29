# Tower MMO – Browser Multiplayer

A 2D multiplayer tower-climbing game inspired by tower manhwas (Tower of God, Solo Leveling style).

## Features

- **Multiplayer** – Real-time players on the same floor
- **Combat** – Basic attack (Space) + 3 skills (Q / E / R)
- **Enemies** – Sli mes, Wolves, Assassins + Floor Bosses
- **Floors** – Clear the boss to advance (Floor 1 → Floor 2)
- **Stats & Leveling** – STR / AGI / VIT + skill points on level up
- **Skills**
  - Q – Slash (higher damage)
  - E – Dash (mobility)
  - R – Shockwave (AoE)
- **Inventory & Loot** – Potions drop from enemies
- **HUD** – HP, Mana, XP, Stats panel, Skills bar, Chat

## How to Run

```bash
cd server
npm install
npm start
```

Open **http://localhost:3000**  
Use multiple tabs to test multiplayer.

## Controls

| Key | Action |
|-----|--------|
| WASD / Arrows | Move |
| Space | Basic Attack |
| Q | Slash |
| E | Dash |
| R | Shockwave |
| Enter | Chat |
| + buttons | Allocate stat points |

## Project Structure

```
tower-mmo/
├── server/
│   ├── index.js
│   └── package.json
└── client/
    ├── index.html
    ├── style.css
    └── game.js
```

## Roadmap Ideas

- More floors & unique mechanics
- Equipment system
- Party system
- Ranking leaderboard UI
- Persistence (database)
- Better sprites & animations
