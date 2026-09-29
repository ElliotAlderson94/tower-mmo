class MainScene extends Phaser.Scene {
  constructor() { super('MainScene'); }
  create() {
    gameScene = this;
    ensureHeroTexture(this);
    this.rebuildWorld(0);
    cursors = this.input.keyboard.createCursorKeys();
    wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });
    const typing = () => {
      const t = document.activeElement;
      return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
    };
    this.input.keyboard.on('keydown-SPACE', () => {
      if (canMove && !typing()) send({ type: 'attack' });
    });
    this.input.keyboard.on('keydown-Q', () => {
      if (canMove && !typing()) { send({ type: 'skill', skill: 'slash' }); skillCd.slash = Date.now() + SKILL_CD_MS.slash; }
    });
    this.input.keyboard.on('keydown-E', () => {
      if (canMove && !typing()) { send({ type: 'skill', skill: 'dash' }); skillCd.dash = Date.now() + SKILL_CD_MS.dash; }
    });
    this.input.keyboard.on('keydown-R', () => {
      if (canMove && !typing()) { send({ type: 'skill', skill: 'shockwave' }); skillCd.shockwave = Date.now() + SKILL_CD_MS.shockwave; }
    });
  }

  rebuildWorld(floor) {
    if (this.worldGfx) { this.worldGfx.destroy(); this.worldGfx = null; }
    if (this.worldDecor) { this.worldDecor.forEach((d) => d.destroy()); }
    this.worldDecor = [];
    const g = this.add.graphics();
    this.worldGfx = g;

    if (floor === 0) {
      g.fillStyle(0x6b9e3a); g.fillRect(0, 0, 2000, 1600);
      for (let y = 0; y < 1200; y += 32) {
        for (let x = 0; x < 1600; x += 32) {
          if ((x + y) % 64 === 0) { g.fillStyle(0x5f8f32); g.fillRect(x, y, 32, 32); }
          if ((x * 3 + y) % 96 === 0) { g.fillStyle(0x7aad45); g.fillRect(x + 4, y + 4, 8, 8); }
        }
      }
      g.fillStyle(0xc4a06a);
      g.fillRect(0, 480, 1600, 64);
      g.fillRect(640, 200, 56, 700);
      g.fillRect(300, 700, 500, 48);
      g.fillRect(900, 350, 400, 48);
      g.fillStyle(0xa88850, 0.5);
      g.fillRect(0, 476, 1600, 4); g.fillRect(0, 540, 1600, 4);
      for (let i = 0; i < 60; i++) {
        const fx = (i * 97 + 40) % 1500, fy = (i * 53 + 30) % 1100;
        g.fillStyle([0xe070a0, 0xf0e060, 0x70c0e0][i % 3]);
        g.fillRect(fx, fy, 3, 3);
      }
      const trees = [[120,180],[200,320],[80,700],[180,900],[400,150],[520,250],[350,1000],
        [800,120],[950,200],[1100,150],[1250,300],[1400,180],[1500,500],[1450,800],[200,500],
        [1000,900],[750,850],[550,600],[1200,1000]];
      trees.forEach(([tx, ty]) => {
        g.fillStyle(0x5d4037); g.fillRect(tx - 5, ty, 10, 22);
        g.fillStyle(0x2e7d32); g.fillCircle(tx, ty - 6, 18);
        g.fillStyle(0x388e3c); g.fillCircle(tx - 8, ty - 2, 12);
        g.fillStyle(0x43a047); g.fillCircle(tx + 8, ty - 4, 11);
      });
      const houses = [
        [280, 300, 0x8d6e63, 0xbf360c],[420, 320, 0xa1887f, 0x6d4c41],
        [880, 260, 0xbcaaa4, 0xd84315],[1050, 580, 0x8d6e63, 0x5d4037],[480, 820, 0xa1887f, 0xbf360c]
      ];
      houses.forEach(([hx, hy, wall, roof]) => {
        g.fillStyle(wall); g.fillRect(hx, hy, 80, 55);
        g.fillStyle(roof); g.fillTriangle(hx - 8, hy, hx + 40, hy - 28, hx + 88, hy);
        g.fillStyle(0x3e2723); g.fillRect(hx + 32, hy + 28, 16, 27);
        g.fillStyle(0x81d4fa); g.fillRect(hx + 10, hy + 14, 14, 12);
        g.fillStyle(0x81d4fa); g.fillRect(hx + 56, hy + 14, 14, 12);
        g.fillStyle(0x5d4037); g.fillRect(hx + 10, hy + 19, 14, 2); g.fillRect(hx + 16, hy + 14, 2, 12);
      });
      [[620, 300], [980, 720]].forEach(([wx, wy]) => {
        g.fillStyle(0x6d4c41); g.fillRect(wx, wy, 32, 70);
        g.fillStyle(0x90a4ae); g.fillCircle(wx + 16, wy + 4, 20);
        g.fillStyle(0xb0bec5); g.fillRect(wx + 14, wy - 28, 4, 30); g.fillRect(wx - 8, wy - 2, 30, 4);
      });
      [[500, 480], [560, 490], [1100, 500]].forEach(([hx, hy]) => {
        g.fillStyle(0xd4a84b); g.fillRect(hx, hy, 28, 18);
        g.fillStyle(0xc49a3c); g.fillRect(hx + 2, hy + 4, 24, 3);
      });
      g.fillStyle(0x6d4c41);
      for (let x = 1000; x < 1200; x += 20) g.fillRect(x, 620, 4, 28);
      g.fillRect(1000, 628, 200, 3); g.fillRect(1000, 640, 200, 3);
      const tw = 1300, ty = 220;
      g.fillStyle(0x455a64); g.fillRect(tw, ty, 100, 260);
      g.fillStyle(0x37474f); g.fillRect(tw + 8, ty - 40, 84, 50);
      g.fillStyle(0x263238); g.fillRect(tw + 20, ty - 70, 60, 40);
      for (let i = 0; i < 5; i++) {
        g.fillStyle(0xffe082); g.fillRect(tw + 20, ty + 30 + i * 40, 12, 16);
        g.fillStyle(0xffe082); g.fillRect(tw + 68, ty + 30 + i * 40, 12, 16);
      }
      g.fillStyle(0xffc107); g.fillRect(tw + 35, ty + 210, 30, 50);
      g.fillStyle(0x1a120c); g.fillRect(tw + 48, ty + 230, 4, 8);
      g.fillStyle(0xc62828); g.fillRect(tw + 48, ty - 100, 4, 30);
      g.fillStyle(0xe8c84a); g.fillTriangle(tw + 52, ty - 100, tw + 72, ty - 92, tw + 52, ty - 84);
      const t = this.add.text(tw + 18, ty - 90, 'TOWER', { fontSize: '11px', color: '#ffd54f', fontStyle: 'bold' });
      t.setDepth(2); this.worldDecor.push(t);
      g.fillStyle(0xffffff, 0.15); g.fillCircle(250, 520, 40);
    } else {
      g.fillStyle(0x1c1814); g.fillRect(0, 0, 2000, 1600);
      for (let y = 0; y < 1200; y += 48) {
        for (let x = 0; x < 1600; x += 48) {
          g.fillStyle((x + y) % 96 === 0 ? 0x2a2520 : 0x24201c);
          g.fillRect(x, y, 48, 48);
          g.lineStyle(1, 0x1a1612, 0.8);
          g.strokeRect(x, y, 48, 48);
        }
      }
      for (let x = 80; x < 1500; x += 160) {
        g.fillStyle(0x3a3530); g.fillRect(x, 0, 24, 1200);
        g.fillStyle(0x2a2520); g.fillRect(x + 4, 0, 16, 1200);
      }
      for (let i = 0; i < 8; i++) {
        const tx = 100 + i * 180, ty = 100 + (i % 2) * 400;
        g.fillStyle(0xff9800, 0.12); g.fillCircle(tx, ty, 50);
        g.fillStyle(0xffc107); g.fillRect(tx - 2, ty - 8, 4, 12);
      }
    }
    g.setDepth(0);
    this.cameras.main.setBounds(0, 0, floorWidth, floorHeight);
    this.cameras.main.setBackgroundColor(floor === 0 ? '#6b9e3a' : '#1c1814');
  }

  update(_, delta) {
    for (const id in otherPlayers) {
      const p = otherPlayers[id];
      p.container.x += (p.targetX - p.container.x) * 0.2;
      p.container.y += (p.targetY - p.container.y) * 0.2;
    }
    for (const id in enemies) {
      const e = enemies[id];
      e.container.x += (e.targetX - e.container.x) * 0.15;
      e.container.y += (e.targetY - e.container.y) * 0.15;
    }
    if (!canMove || !this.localPlayer) return;
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;

    const speed = CONFIG.PLAYER_SPEED * (delta / 1000);
    let dx = 0, dy = 0, dir = this.localPlayer.data.direction || 'right';
    if (cursors.left.isDown || wasd.left.isDown) { dx = -speed; dir = 'left'; }
    else if (cursors.right.isDown || wasd.right.isDown) { dx = speed; dir = 'right'; }
    if (cursors.up.isDown || wasd.up.isDown) dy = -speed;
    else if (cursors.down.isDown || wasd.down.isDown) dy = speed;

    if (dx || dy) {
      const c = this.localPlayer.container;
      c.x = Phaser.Math.Clamp(c.x + dx, 30, floorWidth - 30);
      c.y = Phaser.Math.Clamp(c.y + dy, 30, floorHeight - 30);
      this.localPlayer.data.direction = dir;
      if (this.localPlayer.spr) this.localPlayer.spr.setFlipX(dir === 'left');
      const now = Date.now();
      if (now - lastMoveSend > 50) {
        lastMoveSend = now;
        send({ type: 'move', x: c.x, y: c.y, direction: dir });
      }
      if (currentFloor === 0 && c.x > 1280 && c.x < 1420 && c.y > 400 && c.y < 500) {
        if (!this._towerGate) {
          this._towerGate = true;
          send({ type: 'enter_tower' });
          setTimeout(() => { this._towerGate = false; }, 2500);
        }
      }
    }
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: Math.max(640, window.innerWidth),
  height: Math.max(480, window.innerHeight),
  parent: 'game-container',
  backgroundColor: '#6b9e3a',
  scene: MainScene,
  banner: false,
  input: { keyboard: true, mouse: true },
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { pixelArt: true, antialias: false }
});
window.addEventListener('resize', () => {
  if (game && game.scale) game.scale.resize(window.innerWidth, window.innerHeight);
});
window.addEventListener('keydown', (e) => {
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA') e.stopPropagation();
}, true);
