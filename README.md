# TOWER — Multiplayer Tower Climbing MMO

## Run (important)

```bash
cd tower-mmo/server
npm install
npm start
```

Then open **http://localhost:3000** in your browser.

**Do not open the HTML file directly (file://)** — login will fail because WebSockets need the server.

### First time
1. Click **REGISTER**
2. Username: 3+ letters/numbers (e.g. `climber1`)
3. Password: 4+ characters
4. Then **LOGIN** with the same details

### Controls
| Key | Action |
|-----|--------|
| WASD / Arrows | Move |
| Space | Attack |
| Q / E / R | Skills |
| Side buttons | Inventory / Stats / Profile |

### Requirements
- Node.js 18+
- Only dependency: `ws`
