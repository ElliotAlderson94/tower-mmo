function handleMessage(data) {
  switch (data.type) {
    case 'auth_error':
      if ($('login-error')) $('login-error').textContent = data.message || 'Error';
      if ($('reg-error')) $('reg-error').textContent = data.message || 'Error';
      break;
    case 'auth_ok':
      toast(data.message || 'OK');
      if ($('register-form')) $('register-form').classList.add('hidden');
      if ($('login-form')) $('login-form').classList.remove('hidden');
      if ($('reg-user') && $('login-user') && $('reg-user').value) $('login-user').value = $('reg-user').value;
      break;
    case 'welcome':
      myId = data.id; myPlayer = data.player;
      currentFloor = myPlayer.floor || 0;
      floorWidth = data.mapW || 1600; floorHeight = data.mapH || 1200;
      if ($('auth-screen')) $('auth-screen').classList.add('hidden');
      if ($('hud')) $('hud').classList.remove('hidden');
      { const ft = $('floor-text') || $('floor-badge'); if (ft) ft.textContent = (data.floorName || 'TOWN').toUpperCase(); }
      updateBars();
      if (gameScene) {
        try {
          gameScene.rebuildWorld(currentFloor); clearEntities();
          createLocalPlayer(gameScene, myPlayer);
          (data.others || []).forEach((p) => createRemotePlayer(gameScene, p));
          (data.enemies || []).forEach((e) => createEnemy(gameScene, e));
          (data.npcs || []).forEach((n) => createNpc(gameScene, n));
        } catch (err) { console.error(err); }
      }
      canMove = true; toast('Welcome to ' + (data.floorName || 'Town'));
      break;
    case 'player_joined':
      if (data.player && data.player.id !== myId && gameScene) createRemotePlayer(gameScene, data.player);
      break;
    case 'player_left':
      if (otherPlayers[data.id]) { otherPlayers[data.id].container.destroy(); delete otherPlayers[data.id]; }
      break;
    case 'player_moved':
      if (otherPlayers[data.id]) { otherPlayers[data.id].targetX = data.x; otherPlayers[data.id].targetY = data.y; }
      break;
    case 'player_attack':
      if (gameScene) showAttackEffect(data.x, data.y, data.direction);
      (data.hits || []).forEach((h) => showDamage(h.id, h.dmg));
      break;
    case 'skill_used':
      if (data.skill === 'shockwave') showShockwave(data.x, data.y);
      else showAttackEffect(data.x, data.y, 'right');
      (data.hits || []).forEach((h) => showDamage(h.id, h.dmg));
      break;
    case 'enemies_update':
      (data.enemies || []).forEach((e) => {
        if (enemies[e.id]) {
          enemies[e.id].targetX = e.x; enemies[e.id].targetY = e.y; enemies[e.id].hp = e.hp;
          updateEnemyHp(e.id);
        }
      });
      break;
    case 'enemy_died':
      if (enemies[data.enemyId]) { enemies[data.enemyId].container.destroy(); delete enemies[data.enemyId]; }
      if (data.killerId === myId) {
        if (data.xp) addChat('System', '+' + data.xp + ' XP');
        if (data.gold) addChat('System', '+' + data.gold + ' ◆');
        if (data.loot) toast('Loot: ' + data.loot.name);
      }
      break;
    case 'player_died':
      if (data.id === myId) {
        canMove = false; if (myPlayer) myPlayer.isDead = true;
        if ($('death-screen')) $('death-screen').classList.remove('hidden');
        if (gameScene && gameScene.localPlayer) gameScene.localPlayer.container.setAlpha(0.4);
      }
      break;
    case 'player_respawned':
      if (data.player && data.player.id === myId) {
        Object.assign(myPlayer, data.player); myPlayer.isDead = false; canMove = true;
        if ($('death-screen')) $('death-screen').classList.add('hidden');
        if (gameScene && gameScene.localPlayer) {
          gameScene.localPlayer.container.setAlpha(1);
          gameScene.localPlayer.container.x = data.player.x;
          gameScene.localPlayer.container.y = data.player.y;
        }
        updateBars(); toast('Respawned');
      }
      break;
    case 'stats_update':
      if (!myPlayer) return;
      Object.assign(myPlayer, data); updateBars();
      if (data.leveled) toast('LEVEL UP! Lv.' + myPlayer.level);
      if ($('panel-stats') && !$('panel-stats').classList.contains('hidden')) renderStats();
      if ($('panel-inventory') && !$('panel-inventory').classList.contains('hidden')) renderInventory();
      break;
    case 'floor_changed':
      if (data.player) Object.assign(myPlayer, data.player);
      currentFloor = data.floor;
      floorWidth = data.mapW || 1400; floorHeight = data.mapH || 900;
      { const ft2 = $('floor-text') || $('floor-badge'); if (ft2) ft2.textContent = (data.floorName || ('Floor ' + data.floor)).toUpperCase(); }
      clearEntities();
      if (gameScene) {
        gameScene.rebuildWorld(currentFloor);
        createLocalPlayer(gameScene, myPlayer || data.player);
        (data.enemies || []).forEach((e) => createEnemy(gameScene, e));
        (data.npcs || []).forEach((n) => createNpc(gameScene, n));
      }
      toast(data.floorName || ('Floor ' + data.floor)); updateBars();
      break;
    case 'chat': addChat(data.name, data.message); break;
    case 'toast': toast(data.message || ''); break;
    case 'npc_say':
      addChat(data.name || 'NPC', data.message || '');
      toast((data.name || 'NPC') + ': ' + (data.message || ''));
      break;
    case 'leaderboard': renderLeaderboard(data.rows || []); break;
    case 'search_results': renderSearchResults(data.rows || []); break;
    case 'profile_data': showOtherProfile(data.profile); break;
    case 'trade_offer': showTradeIncoming(data); break;
    case 'trade_result':
      toast(data.message || (data.ok ? 'Trade complete' : 'Trade failed'));
      if (data.ok && myPlayer) {
        if (data.gold != null) myPlayer.gold = data.gold;
        updateBars(); renderInventory();
      }
      break;
    default: break;
  }
}
function showTradeIncoming(data) {
  const box = $('trade-incoming');
  if (!box) return;
  openPanel('trade');
  box.innerHTML = '<div class="trade-offer"><b>' + escapeHtml(data.from) + '</b> offers <b>' + data.gold +
    ' ◆</b><br/><button type="button" class="btn-blue sm" id="trade-accept">ACCEPT</button> ' +
    '<button type="button" class="btn-blue sm" id="trade-decline">DECLINE</button></div>';
  const acc = $('trade-accept'), dec = $('trade-decline');
  if (acc) acc.onclick = () => send({ type: 'trade_accept', from: data.from, gold: data.gold });
  if (dec) dec.onclick = () => { box.innerHTML = ''; toast('Declined'); };
}
function clearEntities() {
  Object.keys(otherPlayers).forEach((id) => { try { otherPlayers[id].container.destroy(); } catch (_) {} });
  Object.keys(enemies).forEach((id) => { try { enemies[id].container.destroy(); } catch (_) {} });
  Object.keys(npcs).forEach((id) => { try { npcs[id].container.destroy(); } catch (_) {} });
  otherPlayers = {}; enemies = {}; npcs = {};
  if (gameScene && gameScene.localPlayer) {
    try { gameScene.localPlayer.container.destroy(); } catch (_) {}
    gameScene.localPlayer = null;
  }
}
function ensureHeroTexture(scene) {
  if (scene.textures.exists('hero')) return;
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 40;
  const ctx = canvas.getContext('2d');
  const P = (x, y, c, bw, bh) => { ctx.fillStyle = c; ctx.fillRect(x, y, bw || 1, bh || 1); };
  P(6, 12, '#3d2a5c', 20, 20); P(4, 14, '#2a1a44', 4, 16); P(24, 14, '#2a1a44', 4, 16);
  P(10, 16, '#5c4a32', 12, 14); P(10, 26, '#2a1a10', 12, 3); P(14, 26, '#c9a227', 4, 3);
  P(8, 4, '#2a1a44', 16, 12); P(11, 10, '#e8c090', 10, 8);
  P(13, 13, '#1a1008', 2, 2); P(18, 13, '#1a1008', 2, 2);
  P(11, 30, '#2a1a10', 4, 8); P(17, 30, '#2a1a10', 4, 8);
  P(3, 14, '#a8b8c8', 2, 18); P(26, 10, '#6b5638', 2, 16);
  scene.textures.addCanvas('hero', canvas);
}
function ensureEnemyTextures(scene) {
  if (scene.textures.exists('enemy_slime')) return;
  const mk = (key, draw) => {
    const c = document.createElement('canvas'); c.width = 24; c.height = 24;
    draw(c.getContext('2d')); scene.textures.addCanvas(key, c);
  };
  mk('enemy_slime', (ctx) => {
    ctx.fillStyle = '#3cb85a'; ctx.beginPath(); ctx.ellipse(12, 14, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1008'; ctx.fillRect(8, 11, 3, 3); ctx.fillRect(14, 11, 3, 3);
  });
  mk('enemy_wolf', (ctx) => {
    ctx.fillStyle = '#8a6a4a'; ctx.fillRect(4, 10, 16, 10);
    ctx.fillStyle = '#6a4a30'; ctx.fillRect(2, 6, 8, 8);
    ctx.fillStyle = '#1a1008'; ctx.fillRect(4, 8, 2, 2); ctx.fillRect(8, 8, 2, 2);
  });
  mk('enemy_assassin', (ctx) => {
    ctx.fillStyle = '#4a2a6a'; ctx.fillRect(8, 8, 10, 14);
    ctx.fillStyle = '#2a1a3a'; ctx.fillRect(7, 4, 12, 8);
    ctx.fillStyle = '#e8c090'; ctx.fillRect(10, 8, 6, 5);
  });
  mk('enemy_boss', (ctx) => {
    ctx.fillStyle = '#8a2020'; ctx.fillRect(4, 8, 16, 14);
    ctx.fillStyle = '#5a1010'; ctx.fillRect(6, 2, 12, 10);
    ctx.fillStyle = '#c9a227'; ctx.fillRect(8, 0, 8, 4);
  });
}
function createLocalPlayer(scene, data) {
  if (!scene || !data) return;
  ensureHeroTexture(scene);
  const c = scene.add.container(data.x, data.y);
  const spr = scene.add.image(0, 0, 'hero').setScale(2.5).setOrigin(0.5, 0.85);
  const tag = scene.add.text(0, -40, data.name || data.username || 'You', {
    fontSize: '11px', color: '#ffe8a0', backgroundColor: '#000000cc', padding: { x: 4, y: 2 }
  }).setOrigin(0.5);
  c.add([spr, tag]); c.setDepth(10);
  scene.localPlayer = { container: c, data, spr };
  scene.cameras.main.startFollow(c, true, 0.1, 0.1);
  scene.cameras.main.setBounds(0, 0, floorWidth, floorHeight);
}
function createRemotePlayer(scene, data) {
  if (!scene || otherPlayers[data.id]) return;
  ensureHeroTexture(scene);
  const c = scene.add.container(data.x, data.y);
  const spr = scene.add.image(0, 0, 'hero').setScale(2.5).setOrigin(0.5, 0.85).setTint(0xb0c0ff);
  const tag = scene.add.text(0, -40, data.name || 'Player', {
    fontSize: '11px', color: '#c0d0ff', backgroundColor: '#000000cc', padding: { x: 4, y: 2 }
  }).setOrigin(0.5);
  c.add([spr, tag]); c.setDepth(5);
  c.setInteractive(new Phaser.Geom.Rectangle(-20, -40, 40, 50), Phaser.Geom.Rectangle.Contains);
  c.on('pointerdown', () => { if (data.name) send({ type: 'view_profile', username: data.name }); });
  otherPlayers[data.id] = { container: c, targetX: data.x, targetY: data.y, name: data.name };
}
function createEnemy(scene, data) {
  if (!scene || enemies[data.id]) return;
  ensureEnemyTextures(scene);
  const c = scene.add.container(data.x, data.y);
  let key = 'enemy_slime';
  if (data.type === 'wolf') key = 'enemy_wolf';
  else if (data.type === 'assassin') key = 'enemy_assassin';
  else if (data.isBoss) key = 'enemy_boss';
  const spr = scene.add.image(0, 0, key).setScale(data.isBoss ? 3 : 2).setOrigin(0.5, 0.85);
  c.add(spr);
  c.add(scene.add.text(0, -(data.size || 24) - 8, data.name || 'Enemy', {
    fontSize: '10px', color: data.isBoss ? '#ff8888' : '#ffccaa', backgroundColor: '#00000099', padding: { x: 3, y: 1 }
  }).setOrigin(0.5));
  const barBg = scene.add.rectangle(0, -(data.size || 24) - 2, 28, 4, 0x333333);
  const barFill = scene.add.rectangle(0, -(data.size || 24) - 2, 28, 4, 0xcc3333);
  c.add([barBg, barFill]); c.setDepth(4);
  enemies[data.id] = { container: c, barFill, targetX: data.x, targetY: data.y, hp: data.hp, maxHp: data.maxHp, size: data.size || 24 };
}
function createNpc(scene, data) {
  if (!scene || npcs[data.id]) return;
  const c = scene.add.container(data.x, data.y);
  c.add(scene.add.ellipse(0, 8, 16, 20, 0x4a6a3a));
  c.add(scene.add.circle(0, -6, 8, 0xe8c090));
  c.add(scene.add.rectangle(-3, -7, 2, 2, 0x1a1008));
  c.add(scene.add.rectangle(3, -7, 2, 2, 0x1a1008));
  c.add(scene.add.text(0, -24, data.name || 'NPC', {
    fontSize: '10px', color: '#a0ffc0', backgroundColor: '#000000aa', padding: { x: 3, y: 1 }
  }).setOrigin(0.5));
  c.setDepth(6);
  c.setInteractive(new Phaser.Geom.Rectangle(-20, -30, 40, 50), Phaser.Geom.Rectangle.Contains);
  c.on('pointerdown', () => send({ type: 'talk_npc', npcId: data.id }));
  npcs[data.id] = { container: c, data };
}
function updateEnemyHp(id) {
  const e = enemies[id]; if (!e || !e.maxHp) return;
  const r = Math.max(0, e.hp / e.maxHp);
  e.barFill.width = 28 * r;
  e.barFill.x = -(28 * (1 - r)) / 2;
}
function showDamage(id, dmg) {
  if (!gameScene || dmg == null) return;
  let x, y;
  if (enemies[id]) { x = enemies[id].container.x; y = enemies[id].container.y - 30; }
  else if (otherPlayers[id]) { x = otherPlayers[id].container.x; y = otherPlayers[id].container.y - 44; }
  else if (id === myId && gameScene.localPlayer) { x = gameScene.localPlayer.container.x; y = gameScene.localPlayer.container.y - 44; }
  else return;
  const t = gameScene.add.text(x, y, '-' + dmg, { fontSize: '14px', color: '#ff4444', fontStyle: 'bold' }).setOrigin(0.5).setDepth(20);
  gameScene.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 500, onComplete: () => t.destroy() });
}
function showAttackEffect(x, y, dir) {
  if (!gameScene) return;
  const o = dir === 'left' ? -36 : 36;
  const r = gameScene.add.rectangle(x + o, y, 40, 14, 0xffffff, 0.5).setDepth(15);
  gameScene.tweens.add({ targets: r, alpha: 0, duration: 160, onComplete: () => r.destroy() });
}
function showShockwave(x, y) {
  if (!gameScene) return;
  const c = gameScene.add.circle(x, y, 12, 0x6688ff, 0.35).setDepth(15);
  gameScene.tweens.add({ targets: c, radius: 140, alpha: 0, duration: 300, onComplete: () => c.destroy() });
}
