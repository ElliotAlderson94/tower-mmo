// ====================== TOWER MMO - CLIENT ======================

const CONFIG = {
  WIDTH: 1200,
  HEIGHT: 800,
  PLAYER_SPEED: 220,
  SERVER_URL: location.origin.replace(/^http/, 'ws') // auto detect
};

let socket = null;
let myId = null;
let myPlayer = null;
let otherPlayers = {};   // id -> sprite data
let gameScene = null;
let cursors = null;
let wasd = null;
let canMove = false;

// ====================== UI ======================
const loginScreen = document.getElementById('login-screen');
const nameInput = document.getElementById('name-input');
const joinBtn = document.getElementById('join-btn');
const hud = document.getElementById('hud');
const playerNameEl = document.getElementById('player-name');
const playerLevelEl = document.getElementById('player-level');
const playerFloorEl = document.getElementById('player-floor');
const hpBar = document.getElementById('hp-bar');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');

nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinBtn.click();
});

joinBtn.addEventListener('click', () => {
  const name = nameInput.value.trim() || null;
  connect(name);
});

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && chatInput.value.trim()) {
    send({ type: 'chat', message: chatInput.value.trim() });
    chatInput.value = '';
  }
});

function addChat(name, message) {
  const div = document.createElement('div');
  div.innerHTML = `<span class="name">${name}:</span> ${message}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ====================== NETWORK ======================
function connect(name) {
  joinBtn.disabled = true;
  joinBtn.textContent = 'Connecting...';

  socket = new WebSocket(CONFIG.SERVER_URL);

  socket.onopen = () => {
    console.log('Connected to server');
    send({ type: 'join', name });
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleMessage(data);
  };

  socket.onclose = () => {
    console.log('Disconnected');
    joinBtn.disabled = false;
    joinBtn.textContent = 'Enter the Tower';
    canMove = false;
  };

  socket.onerror = (err) => {
    console.error('WebSocket error', err);
    alert('Could not connect to server. Make sure the server is running.');
    joinBtn.disabled = false;
    joinBtn.textContent = 'Enter the Tower';
  };
}

function send(data) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
  }
}

function handleMessage(data) {
  switch (data.type) {
    case 'welcome':
      myId = data.id;
      myPlayer = data.player;

      // Update UI
      loginScreen.classList.add('hidden');
      hud.classList.remove('hidden');
      playerNameEl.textContent = myPlayer.name;
      playerLevelEl.textContent = `Lv.${myPlayer.level}`;
      playerFloorEl.textContent = `Floor ${myPlayer.floor}`;
      hpBar.style.width = `${(myPlayer.hp / myPlayer.maxHp) * 100}%`;

      // Create local player in Phaser
      if (gameScene) {
        createLocalPlayer(gameScene, myPlayer);
        data.others.forEach(p => createRemotePlayer(gameScene, p));
      }
      canMove = true;
      break;

    case 'player_joined':
      if (gameScene && data.player.id !== myId) {
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
        const p = otherPlayers[data.id];
        p.targetX = data.x;
        p.targetY = data.y;
        p.direction = data.direction;
      }
      break;

    case 'chat':
      addChat(data.name, data.message);
      break;

    case 'player_attack':
      // visual feedback later
      break;
  }
}

// ====================== PHASER ======================
function createLocalPlayer(scene, data) {
  const container = scene.add.container(data.x, data.y);

  const body = scene.add.rectangle(0, 0, 28, 40, Phaser.Display.Color.HexStringToColor(data.color).color);
  const nameTag = scene.add.text(0, -32, data.name, {
    fontSize: '12px',
    color: '#ffffff',
    backgroundColor: '#000000aa',
    padding: { x: 4, y: 2 }
  }).setOrigin(0.5);

  container.add([body, nameTag]);
  container.setDepth(10);

  scene.localPlayer = {
    container,
    body,
    nameTag,
    data
  };

  scene.cameras.main.startFollow(container, true, 0.1, 0.1);
  scene.cameras.main.setBounds(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
}

function createRemotePlayer(scene, data) {
  if (otherPlayers[data.id]) return;

  const container = scene.add.container(data.x, data.y);
  const body = scene.add.rectangle(0, 0, 28, 40, Phaser.Display.Color.HexStringToColor(data.color).color);
  const nameTag = scene.add.text(0, -32, data.name, {
    fontSize: '12px',
    color: '#ccccff',
    backgroundColor: '#000000aa',
    padding: { x: 4, y: 2 }
  }).setOrigin(0.5);

  container.add([body, nameTag]);
  container.setDepth(5);

  otherPlayers[data.id] = {
    container,
    body,
    nameTag,
    targetX: data.x,
    targetY: data.y,
    direction: data.direction || 'right'
  };
}

class MainScene extends Phaser.Scene {
  constructor() {
    super('MainScene');
  }

  create() {
    gameScene = this;

    // Background
    this.add.rectangle(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, CONFIG.WIDTH, CONFIG.HEIGHT, 0x12121f);

    // Simple floor grid
    const g = this.add.graphics();
    g.lineStyle(1, 0x22223a, 0.6);
    for (let x = 0; x <= CONFIG.WIDTH; x += 40) {
      g.lineBetween(x, 0, x, CONFIG.HEIGHT);
    }
    for (let y = 0; y <= CONFIG.HEIGHT; y += 40) {
      g.lineBetween(0, y, CONFIG.WIDTH, y);
    }

    // Floor label
    this.add.text(CONFIG.WIDTH / 2, 30, 'FLOOR 1 — Entrance Hall', {
      fontSize: '18px',
      color: '#6666aa',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Walls (simple)
    this.add.rectangle(CONFIG.WIDTH / 2, 10, CONFIG.WIDTH, 20, 0x2a2a45);
    this.add.rectangle(CONFIG.WIDTH / 2, CONFIG.HEIGHT - 10, CONFIG.WIDTH, 20, 0x2a2a45);
    this.add.rectangle(10, CONFIG.HEIGHT / 2, 20, CONFIG.HEIGHT, 0x2a2a45);
    this.add.rectangle(CONFIG.WIDTH - 10, CONFIG.HEIGHT / 2, 20, CONFIG.HEIGHT, 0x2a2a45);

    // Input
    cursors = this.input.keyboard.createCursorKeys();
    wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });

    // Attack key
    this.input.keyboard.on('keydown-SPACE', () => {
      if (canMove && this.localPlayer) {
        send({ type: 'attack' });
      }
    });
  }

  update(time, delta) {
    if (!canMove || !this.localPlayer) return;

    const speed = CONFIG.PLAYER_SPEED * (delta / 1000);
    let moved = false;
    let dx = 0;
    let dy = 0;
    let direction = this.localPlayer.data.direction || 'right';

    if (cursors.left.isDown || wasd.left.isDown) {
      dx = -speed;
      direction = 'left';
      moved = true;
    } else if (cursors.right.isDown || wasd.right.isDown) {
      dx = speed;
      direction = 'right';
      moved = true;
    }

    if (cursors.up.isDown || wasd.up.isDown) {
      dy = -speed;
      moved = true;
    } else if (cursors.down.isDown || wasd.down.isDown) {
      dy = speed;
      moved = true;
    }

    if (moved) {
      const container = this.localPlayer.container;
      container.x = Phaser.Math.Clamp(container.x + dx, 30, CONFIG.WIDTH - 30);
      container.y = Phaser.Math.Clamp(container.y + dy, 30, CONFIG.HEIGHT - 30);
      this.localPlayer.data.direction = direction;

      // Send position (throttled simply by frame)
      send({
        type: 'move',
        x: container.x,
        y: container.y,
        direction
      });
    }

    // Smooth remote players
    for (const id in otherPlayers) {
      const p = otherPlayers[id];
      p.container.x += (p.targetX - p.container.x) * 0.2;
      p.container.y += (p.targetY - p.container.y) * 0.2;
    }
  }
}

// Start Phaser
const phaserConfig = {
  type: Phaser.AUTO,
  width: CONFIG.WIDTH,
  height: CONFIG.HEIGHT,
  parent: 'game-container',
  backgroundColor: '#0a0a12',
  scene: MainScene,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

const game = new Phaser.Game(phaserConfig);
