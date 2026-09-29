// ====================== TOWER MMO - CLIENT ======================

const CONFIG = {
  WIDTH: 1200,
  HEIGHT: 800,
  PLAYER_SPEED: 230,
  SERVER_URL: location.origin.replace(/^http/, 'ws')
};

let socket = null;
let myId = null;
let myPlayer = null;
let otherPlayers = {};
let enemies = {};
let gameScene = null;
let cursors = null;
let wasd = null;
let canMove = false;
let skillCooldowns = { slash: 0, dash: 0, shockwave: 0 };
let floorWidth = 1200;
let floorHeight = 800;

const loginScreen = document.getElementById('login-screen');
const nameInput = document.getElementById('name-input');
const joinBtn = document.getElementById('join-btn');
const hud = document.getElementById('hud');
const playerNameEl = document.getElementById('player-name');
const playerLevelEl = document.getElementById('player-level');
const playerFloorEl = document.getElementById('player-floor');
const hpBar = document.getElementById('hp-bar');
const manaBar = document.getElementById('mana-bar');
const xpBar = document.getElementById('xp-bar');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const statsPanel = document.getElementById('stats-panel');
const skillPointsEl = document.getElementById('skill-points');
const invPanel = document.getElementById('inventory-panel');
const deathScreen = document.getElementById('death-screen');

nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') joinBtn.click(); });
joinBtn.addEventListener('click', () => connect(nameInput.value.trim() || null));

chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && chatInput.value.trim()) {
    send({ type: 'chat', message: chatInput.value.trim() });
    chatInput.value = '';
  }
});

document.querySelectorAll('.stat-btn').forEach(btn => {
  btn.addEventListener('click', () => send({ type: 'allocate_stat', stat: btn.dataset.stat }));
});

document.getElementById('respawn-btn')?.addEventListener('click', () => {
  send({ type: 'respawn' });
  deathScreen.classList.add('hidden');
});

function addChat(name, message) {
  const div = document.createElement('div');
  div.innerHTML = `<span class="name">${name}:</span> ${message}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateBars() {
  if (!myPlayer) return;
  hpBar.style.width = `${Math.max(0, (myPlayer.hp / myPlayer.maxHp) * 100)}%`;
  manaBar.style.width = `${Math.max(0, (myPlayer.mana / myPlayer.maxMana) * 100)}%`;
  xpBar.style.width = `${Math.max(0, (myPlayer.xp / myPlayer.xpToLevel) * 100)}%`;
  playerLevelEl.textContent = `Lv.${myPlayer.level}`;
  if (skillPointsEl) skillPointsEl.textContent = myPlayer.skillPoints || 0;
  if (statsPanel) {
    document.getElementById('stat-str').textContent = myPlayer.stats?.str ?? 5;
    document.getElementById('stat-agi').textContent = myPlayer.stats?.agi ?? 5;
    document.getElementById('stat-vit').textContent = myPlayer.stats?.vit ?? 5;
  }
}

function updateInventory() {
  if (!invPanel || !myPlayer?.inventory) return;
  invPanel.innerHTML = '<div class="panel-title">Inventory</div>' + (myPlayer.inventory.map(item =>
    `<div class="inv-item">${item.name}</div>`
  ).join('') || '<div class="inv-empty">Empty</div>');
}

function connect(name) {
  joinBtn.disabled = true;
  joinBtn.textContent = 'Connecting...';
  socket = new WebSocket(CONFIG.SERVER_URL);
  socket.onopen = () => send({ type: 'join', name });
  socket.onmessage = (event) => handleMessage(JSON.parse(event.data));
  socket.onclose = () => {
    joinBtn.disabled = false;
    joinBtn.textContent = 'Enter the Tower';
    canMove = false;
  };
  socket.onerror = () => {
    alert('Could not connect. Make sure the server is running.');
    joinBtn.disabled = false;
    joinBtn.textContent = 'Enter the Tower';
  };
}

function send(data) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(data));
}

function handleMessage(data) {
  switch (data.type) {
    case 'welcome':
      myId = data.id;
      myPlayer = data.player;
      loginScreen.classList.add('hidden');
      hud.classList.remove('hidden');
      playerNameEl.textContent = myPlayer.name;
      playerFloorEl.textContent = `Floor ${myPlayer.floor} — ${data.floorName || ''}`;
      updateBars();
      updateInventory();
      if (gameScene) {
        clearEntities();
        createLocalPlayer(gameScene, myPlayer);
        data.others?.forEach(p => createRemotePlayer(gameScene, p));
        data.enemies?.forEach(e => createEnemy(gameScene, e));
      }
      canMove = true;
      break;
    case 'player_joined':
      if (data.player.id !== myId && gameScene) {
        createRemotePlayer(gameScene, data.player);
        addChat('System', `${data.player.name} entered the floor`);
      }
      break;
    case 'player_left':
      if (otherPlayers[data.id]) {
        otherPlayers[data.id].container.destroy();
        delete otherPlayers[data.id];
      }
      break;
    case 'player_moved':
      if (otherPlayers[data.id]) {
        otherPlayers[data.id].targetX = data.x;
        otherPlayers[data.id].targetY = data.y;
        otherPlayers[data.id].direction = data.direction;
      }
      break;
    case 'player_attack':
      if (gameScene) showAttackEffect(data.x, data.y, data.direction);
      if (data.hits) data.hits.forEach(h => showDamage(h.id, h.dmg, true));
      break;
    case 'skill_used':
      if (gameScene) {
        if (data.skill === 'shockwave') showShockwave(data.x, data.y);
        else showAttackEffect(data.x, data.y, 'right');
      }
      if (data.hits) data.hits.forEach(h => showDamage(h.id, h.dmg, true));
      break;
    case 'enemies_update':
      data.enemies?.forEach(e => {
        if (enemies[e.id]) {
          enemies[e.id].targetX = e.x;
          enemies[e.id].targetY = e.y;
          enemies[e.id].hp = e.hp;
          updateEnemyHpBar(e.id);
        }
      });
      break;
    case 'enemy_died':
      if (enemies[data.enemyId]) {
        enemies[data.enemyId].container.destroy();
        delete enemies[data.enemyId];
      }
      if (data.killerId === myId) {
        addChat('System', `+${data.xp} XP`);
        if (data.loot) addChat('System', `Found: ${data.loot.name}`);
      }
      break;
    case 'player_died':
      if (data.id === myId) {
        canMove = false;
        deathScreen.classList.remove('hidden');
        if (gameScene?.localPlayer) gameScene.localPlayer.container.setAlpha(0.4);
      } else if (otherPlayers[data.id]) {
        otherPlayers[data.id].container.setAlpha(0.4);
      }
      break;
    case 'player_respawned':
      if (data.player.id === myId) {
        myPlayer = { ...myPlayer, ...data.player };
        canMove = true;
        deathScreen.classList.add('hidden');
        if (gameScene?.localPlayer) {
          gameScene.localPlayer.container.setAlpha(1);
          gameScene.localPlayer.container.x = data.player.x;
          gameScene.localPlayer.container.y = data.player.y;
        }
        updateBars();
      } else if (otherPlayers[data.player.id]) {
        otherPlayers[data.player.id].container.setAlpha(1);
        otherPlayers[data.player.id].targetX = data.player.x;
        otherPlayers[data.player.id].targetY = data.player.y;
      }
      break;
    case 'stats_update':
      if (!myPlayer) return;
      Object.assign(myPlayer, data);
      updateBars();
      if (data.inventory) updateInventory();
      if (data.leveled) addChat('System', `LEVEL UP! You are now level ${myPlayer.level}`);
      break;
    case 'floor_changed':
      myPlayer = { ...myPlayer, ...data.player };
      playerFloorEl.textContent = `Floor ${data.floor} — ${data.floorName}`;
      floorWidth = data.floor === 2 ? 1400 : 1200;
      floorHeight = data.floor === 2 ? 900 : 800;
      clearEntities();
      if (gameScene) {
        gameScene.cameras.main.setBounds(0, 0, floorWidth, floorHeight);
        createLocalPlayer(gameScene, myPlayer);
        data.enemies?.forEach(e => createEnemy(gameScene, e));
      }
      addChat('System', `Entered Floor ${data.floor}: ${data.floorName}`);
      updateBars();
      break;
    case 'chat':
      addChat(data.name, data.message);
      break;
  }
}

function clearEntities() {
  Object.values(otherPlayers).forEach(p => p.container?.destroy());
  Object.values(enemies).forEach(e => e.container?.destroy());
  otherPlayers = {};
  enemies = {};
  if (gameScene?.localPlayer) {
    gameScene.localPlayer.container.destroy();
    gameScene.localPlayer = null;
  }
}

function createLocalPlayer(scene, data) {
  const container = scene.add.container(data.x, data.y);
  const body = scene.add.rectangle(0, 0, 28, 40, Phaser.Display.Color.HexStringToColor(data.color).color);
  const nameTag = scene.add.text(0, -36, data.name, {
    fontSize: '12px', color: '#ffffff', backgroundColor: '#000000aa', padding: { x: 4, y: 2 }
  }).setOrigin(0.5);
  container.add([body, nameTag]);
  container.setDepth(10);
  scene.localPlayer = { container, body, nameTag, data };
  scene.cameras.main.startFollow(container, true, 0.12, 0.12);
  scene.cameras.main.setBounds(0, 0, floorWidth, floorHeight);
}

function createRemotePlayer(scene, data) {
  if (otherPlayers[data.id]) return;
  const container = scene.add.container(data.x, data.y);
  const body = scene.add.rectangle(0, 0, 28, 40, Phaser.Display.Color.HexStringToColor(data.color).color);
  const nameTag = scene.add.text(0, -36, data.name, {
    fontSize: '12px', color: '#ccccff', backgroundColor: '#000000aa', padding: { x: 4, y: 2 }
  }).setOrigin(0.5);
  container.add([body, nameTag]);
  container.setDepth(5);
  if (data.isDead) container.setAlpha(0.4);
  otherPlayers[data.id] = { container, body, nameTag, targetX: data.x, targetY: data.y };
}

function createEnemy(scene, data) {
  if (enemies[data.id]) return;
  const container = scene.add.container(data.x, data.y);
  const body = scene.add.rectangle(0, 0, data.size, data.size, Phaser.Display.Color.HexStringToColor(data.color).color);
  const nameTag = scene.add.text(0, -data.size / 2 - 14, data.name, {
    fontSize: '11px', color: data.isBoss ? '#ff8888' : '#ffccaa', backgroundColor: '#00000099', padding: { x: 3, y: 1 }
  }).setOrigin(0.5);
  const barBg = scene.add.rectangle(0, -data.size / 2 - 4, data.size + 8, 5, 0x333333);
  const barFill = scene.add.rectangle(0, -data.size / 2 - 4, data.size + 8, 5, 0xcc3333);
  container.add([body, nameTag, barBg, barFill]);
  container.setDepth(4);
  enemies[data.id] = { container, body, nameTag, barFill, barBg, targetX: data.x, targetY: data.y, hp: data.hp, maxHp: data.maxHp, size: data.size };
}

function updateEnemyHpBar(id) {
  const e = enemies[id];
  if (!e) return;
  const ratio = Math.max(0, e.hp / e.maxHp);
  e.barFill.width = (e.size + 8) * ratio;
  e.barFill.x = -((e.size + 8) * (1 - ratio)) / 2;
}

function showDamage(entityId, dmg, isEnemy) {
  if (!gameScene) return;
  let x, y;
  if (isEnemy && enemies[entityId]) { x = enemies[entityId].container.x; y = enemies[entityId].container.y - 30; }
  else if (otherPlayers[entityId]) { x = otherPlayers[entityId].container.x; y = otherPlayers[entityId].container.y - 40; }
  else if (entityId === myId && gameScene.localPlayer) { x = gameScene.localPlayer.container.x; y = gameScene.localPlayer.container.y - 40; }
  else return;
  const txt = gameScene.add.text(x, y, `-${dmg}`, { fontSize: '16px', color: '#ff4444', fontStyle: 'bold' }).setOrigin(0.5).setDepth(20);
  gameScene.tweens.add({ targets: txt, y: y - 40, alpha: 0, duration: 700, onComplete: () => txt.destroy() });
}

function showAttackEffect(x, y, dir) {
  if (!gameScene) return;
  const offset = dir === 'left' ? -40 : 40;
  const rect = gameScene.add.rectangle(x + offset, y, 50, 20, 0xffffff, 0.6).setDepth(15);
  gameScene.tweens.add({ targets: rect, alpha: 0, scaleX: 1.4, duration: 200, onComplete: () => rect.destroy() });
}

function showShockwave(x, y) {
  if (!gameScene) return;
  const circle = gameScene.add.circle(x, y, 20, 0x6688ff, 0.4).setDepth(15);
  gameScene.tweens.add({ targets: circle, radius: 160, alpha: 0, duration: 400, onComplete: () => circle.destroy() });
}

class MainScene extends Phaser.Scene {
  constructor() { super('MainScene'); }
  create() {
    gameScene = this;
    this.add.rectangle(600, 400, 2000, 1600, 0x12121f);
    const g = this.add.graphics();
    g.lineStyle(1, 0x22223a, 0.5);
    for (let x = 0; x <= 1600; x += 40) g.lineBetween(x, 0, x, 1200);
    for (let y = 0; y <= 1200; y += 40) g.lineBetween(0, y, 1600, y);
    cursors = this.input.keyboard.createCursorKeys();
    wasd = this.input.keyboard.addKeys({ up: Phaser.Input.Keyboard.KeyCodes.W, down: Phaser.Input.Keyboard.KeyCodes.S, left: Phaser.Input.Keyboard.KeyCodes.A, right: Phaser.Input.Keyboard.KeyCodes.D });
    this.input.keyboard.on('keydown-SPACE', () => { if (canMove) send({ type: 'attack' }); });
    this.input.keyboard.on('keydown-Q', () => { if (canMove) { send({ type: 'skill', skill: 'slash' }); skillCooldowns.slash = Date.now(); } });
    this.input.keyboard.on('keydown-E', () => { if (canMove) { send({ type: 'skill', skill: 'dash' }); skillCooldowns.dash = Date.now(); } });
    this.input.keyboard.on('keydown-R', () => { if (canMove) { send({ type: 'skill', skill: 'shockwave' }); skillCooldowns.shockwave = Date.now(); } });
  }
  update(time, delta) {
    for (const id in otherPlayers) {
      const p = otherPlayers[id];
      p.container.x += (p.targetX - p.container.x) * 0.22;
      p.container.y += (p.targetY - p.container.y) * 0.22;
    }
    for (const id in enemies) {
      const e = enemies[id];
      e.container.x += (e.targetX - e.container.x) * 0.18;
      e.container.y += (e.targetY - e.container.y) * 0.18;
    }
    if (!canMove || !this.localPlayer) return;
    const speed = CONFIG.PLAYER_SPEED * (delta / 1000);
    let dx = 0, dy = 0, moved = false;
    let direction = this.localPlayer.data.direction || 'right';
    if (cursors.left.isDown || wasd.left.isDown) { dx = -speed; direction = 'left'; moved = true; }
    else if (cursors.right.isDown || wasd.right.isDown) { dx = speed; direction = 'right'; moved = true; }
    if (cursors.up.isDown || wasd.up.isDown) { dy = -speed; moved = true; }
    else if (cursors.down.isDown || wasd.down.isDown) { dy = speed; moved = true; }
    if (moved) {
      const c = this.localPlayer.container;
      c.x = Phaser.Math.Clamp(c.x + dx, 30, floorWidth - 30);
      c.y = Phaser.Math.Clamp(c.y + dy, 30, floorHeight - 30);
      this.localPlayer.data.direction = direction;
      send({ type: 'move', x: c.x, y: c.y, direction });
    }
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 1200,
  height: 800,
  parent: 'game-container',
  backgroundColor: '#0a0a12',
  scene: MainScene,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }
});
