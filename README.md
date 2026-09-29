# TOWER MMO v3

## Run
```bash
git pull
cd server && npm install && npm start
# open http://localhost:3000
```

## What's new
- **Freeze fix**: throttled movement + cooldown UI off the render loop
- **Town of Beginnings**: spawn in green town (houses, trees, windmills, tower gate)
- **Tower floors**: dark stone maps
- **Pixel hero**: hooded 2D climber sprite
- **Fantasy UI**: wood frames matching RPG kit reference
- **ToS + Privacy** on login
- **NPCs**: Guide, Blacksmith, Merchant (click to talk)
- **Leaderboard** (RANKS button)
- **Shop**: potions, sword, armor, ring
- **Inventory**: click to use/equip

## Controls
WASD/Arrows move · Space attack · Q/E/R skills · Click NPCs · Walk into TOWER to climb

## Deploy note
WebSockets need a long-running Node host (local / Render / Railway). Vercel is static-only.
