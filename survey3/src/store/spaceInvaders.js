// Space Invaders Vuex Module

function createState() {
  return {
    player: { x: 150, y: 0, width: 40, height: 30, speed: 5 },
    bullets: [],
    enemies: [],
    enemyBullets: [],
    explosions: [],
    score: 0,
    lives: 3,
    level: 1,
    gameOver: false,
    isPaused: false,
    isInvulnerable: false,
    invulnerabilityTimer: 0,
    isDying: false,
    deathTimer: 0,
    isRespawning: false,
    respawnCountdown: 0,
    enemyDirection: 1, // 1 = right, -1 = left
    highScore: parseInt(localStorage.getItem('si_highscore') || '0')
  }
}

// MUTATIONS

function SI_INIT_GAME(state, payload) {
  const canvasWidth = payload.canvasWidth || 320;
  const canvasHeight = payload.canvasHeight || 480;

  state.player = {
    x: canvasWidth / 2 - 20,
    y: canvasHeight - 60,
    width: 40,
    height: 30,
    speed: 5
  };
  state.bullets = [];
  state.enemyBullets = [];
  state.explosions = [];
  state.score = 0;
  state.lives = 3;
  state.level = 1;
  state.gameOver = false;
  state.isPaused = false;
  state.isInvulnerable = false;
  state.invulnerabilityTimer = 0;
  state.isDying = false;
  state.deathTimer = 0;
  state.isRespawning = false;
  state.respawnCountdown = 0;
  state.enemyDirection = 1;

  // Create enemies
  const enemies = [];
  const rows = 4;
  const cols = 8;
  const enemyWidth = 30;
  const enemyHeight = 25;
  const spacing = 10;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      enemies.push({
        x: col * (enemyWidth + spacing) + 20,
        y: row * (enemyHeight + spacing) + 40,
        width: enemyWidth,
        height: enemyHeight,
        alive: true,
        type: row
      });
    }
  }
  state.enemies = enemies;
}

function SI_MOVE_PLAYER(state, direction) {
  const player = state.player;
  if (direction === 'left') {
    player.x = Math.max(0, player.x - player.speed);
  } else if (direction === 'right') {
    player.x = Math.min(320 - player.width, player.x + player.speed);
  }
}

function SI_SET_PLAYER_X(state, x) {
  const player = state.player;
  player.x = Math.max(0, Math.min(320 - player.width, x - player.width / 2));
}

function SI_SHOOT(state) {
  if (state.gameOver) return;
  const player = state.player;
  state.bullets.push({
    x: player.x + player.width / 2 - 2,
    y: player.y,
    width: 4,
    height: 10,
    speed: 7
  });
}

function SI_UPDATE_BULLETS(state) {
  state.bullets = state.bullets.filter(bullet => {
    bullet.y -= bullet.speed;
    return bullet.y > 0;
  });
}

function SI_UPDATE_ENEMY_BULLETS(state) {
  state.enemyBullets = state.enemyBullets.filter(bullet => {
    bullet.y += bullet.speed;
    return bullet.y < 480;
  });

  // Update explosions
  state.explosions = state.explosions.filter(explosion => {
    explosion.radius += 2;
    explosion.alpha -= 0.05;
    return explosion.alpha > 0 && explosion.radius < explosion.maxRadius;
  });
}

function SI_MOVE_ENEMIES(state, payload) {
  const enemies = state.enemies;
  const shouldMoveDown = payload.shouldMoveDown || false;
  const newDirection = payload.newDirection;

  enemies.forEach(enemy => {
    if (enemy.alive) {
      if (shouldMoveDown) {
        enemy.y += 20;
      } else {
        enemy.x += state.enemyDirection * 10;
      }
    }
  });

  if (shouldMoveDown && newDirection !== undefined) {
    state.enemyDirection = newDirection;
  }
}

function SI_ENEMY_SHOOT(state, enemy) {
  state.enemyBullets.push({
    x: enemy.x + enemy.width / 2 - 2,
    y: enemy.y + enemy.height,
    width: 4,
    height: 15,
    speed: 4
  });
}

function SI_UPDATE_TIMERS(state) {
  // Update death timer
  if (state.isDying) {
    state.deathTimer--;
    if (state.deathTimer <= 0) {
      state.isDying = false;

      if (state.lives <= 0) {
        state.gameOver = true;
        if (state.score > state.highScore) {
          state.highScore = state.score;
          localStorage.setItem('si_highscore', state.score.toString());
        }
      } else {
        state.isRespawning = true;
        state.respawnCountdown = 240;
      }
    }
  }

  // Update respawn countdown
  if (state.isRespawning) {
    state.respawnCountdown--;
    if (state.respawnCountdown <= 0) {
      state.isRespawning = false;
    }
  }

  // Update invulnerability timer
  if (state.isInvulnerable) {
    state.invulnerabilityTimer--;
    if (state.invulnerabilityTimer <= 0) {
      state.isInvulnerable = false;
    }
  }
}

function SI_CHECK_COLLISIONS(state) {
  const { bullets, enemies, enemyBullets, player, isInvulnerable, isDying, isRespawning } = state;

  if (isDying || isRespawning) {
    SI_UPDATE_TIMERS(state);
    return;
  }

  // Check player bullets hitting enemies
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    let bulletHit = false;

    for (let j = 0; j < enemies.length; j++) {
      const enemy = enemies[j];
      if (enemy.alive &&
          bullet.x < enemy.x + enemy.width &&
          bullet.x + bullet.width > enemy.x &&
          bullet.y < enemy.y + enemy.height &&
          bullet.y + bullet.height > enemy.y) {

        enemy.alive = false;
        bulletHit = true;
        state.score += (4 - enemy.type) * 10 * state.level;

        state.explosions.push({
          x: enemy.x + enemy.width / 2,
          y: enemy.y + enemy.height / 2,
          radius: 5,
          maxRadius: 20,
          alpha: 1,
          type: 'enemy'
        });
        break;
      }
    }

    if (bulletHit) {
      bullets.splice(i, 1);
    }
  }

  // Check enemy bullets hitting player
  if (!isInvulnerable) {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const bullet = enemyBullets[i];
      if (bullet.x < player.x + player.width &&
          bullet.x + bullet.width > player.x &&
          bullet.y < player.y + player.height &&
          bullet.y + bullet.height > player.y) {

        state.lives--;

        state.explosions.push({
          x: player.x + player.width / 2,
          y: player.y + player.height / 2,
          radius: 10,
          maxRadius: 40,
          alpha: 1,
          type: 'player'
        });

        state.isDying = true;
        state.deathTimer = 120;
        state.enemyBullets = [];

        SI_UPDATE_TIMERS(state);
        return;
      }
    }
  }

  // Check if enemies reached the bottom
  if (!isInvulnerable) {
    const dangerLine = player.y + player.height;

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (enemy.alive && enemy.y + enemy.height >= dangerLine) {

        state.lives--;

        state.explosions.push({
          x: player.x + player.width / 2,
          y: player.y + player.height / 2,
          radius: 10,
          maxRadius: 40,
          alpha: 1,
          type: 'player'
        });

        state.isDying = true;
        state.deathTimer = 120;
        state.enemyBullets = [];
        enemy.alive = false;

        SI_UPDATE_TIMERS(state);
        return;
      }
    }
  }

  SI_UPDATE_TIMERS(state);
}

function SI_TOGGLE_PAUSE(state) {
  state.isPaused = !state.isPaused;
}

function SI_RESET_GAME(state, payload) {
  SI_INIT_GAME(state, payload);
}

function SI_RESPAWN_PLAYER(state, payload) {
  const canvasWidth = payload.canvasWidth || 320;
  const canvasHeight = payload.canvasHeight || 480;

  state.player = {
    x: canvasWidth / 2 - 20,
    y: canvasHeight - 60,
    width: 40,
    height: 30,
    speed: 5
  };

  state.bullets = [];
  state.enemyBullets = [];

  state.isInvulnerable = true;
  state.invulnerabilityTimer = 180;
  state.isRespawning = false;
  state.respawnCountdown = 0;

  let minY = 999;
  state.enemies.forEach(enemy => {
    if (enemy.alive && enemy.y < minY) {
      minY = enemy.y;
    }
  });

  const resetOffset = minY - 40;

  state.enemies.forEach(enemy => {
    if (enemy.alive) {
      enemy.y = enemy.y - resetOffset;
      if (enemy.y > 200) {
        enemy.y = 40 + (enemy.y % 100);
      }
    }
  });
}

function SI_NEXT_LEVEL(state, payload) {
  const canvasWidth = payload.canvasWidth || 320;
  const canvasHeight = payload.canvasHeight || 480;

  state.level++;

  state.player = {
    x: canvasWidth / 2 - 20,
    y: canvasHeight - 60,
    width: 40,
    height: 30,
    speed: 5
  };

  state.bullets = [];
  state.enemyBullets = [];
  state.explosions = [];

  state.isInvulnerable = false;
  state.invulnerabilityTimer = 0;
  state.isDying = false;
  state.deathTimer = 0;

  state.enemyDirection = 1;

  state.score += 100 * state.level;

  const enemies = [];
  const baseRows = 4;
  const baseCols = 8;
  const rows = Math.min(baseRows + Math.floor(state.level / 3), 6);
  const cols = Math.min(baseCols + Math.floor(state.level / 2), 10);
  const enemyWidth = 30;
  const enemyHeight = 25;
  const spacing = Math.max(10 - state.level, 5);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      enemies.push({
        x: col * (enemyWidth + spacing) + 20,
        y: row * (enemyHeight + spacing) + 40,
        width: enemyWidth,
        height: enemyHeight,
        alive: true,
        type: row % 4
      });
    }
  }
  state.enemies = enemies;
}

// ACTIONS

function si_initGame({commit}, payload) {
  commit('SI_INIT_GAME', payload);
}

function si_movePlayer({commit}, direction) {
  commit('SI_MOVE_PLAYER', direction);
}

function si_setPlayerX({commit}, x) {
  commit('SI_SET_PLAYER_X', x);
}

function si_shoot({commit}) {
  commit('SI_SHOOT');
}

function si_updateGame({commit, state}) {
  if (state.gameOver || state.isPaused) return;

  commit('SI_UPDATE_BULLETS');
  commit('SI_UPDATE_ENEMY_BULLETS');
  commit('SI_CHECK_COLLISIONS');
}

function si_moveEnemies({commit, state}) {
  if (state.gameOver || state.isPaused) return;

  const enemies = state.enemies;
  const currentDirection = state.enemyDirection;
  let shouldMoveDown = false;
  let newDirection = currentDirection;

  const aliveEnemies = enemies.filter(e => e.alive);
  if (aliveEnemies.length > 0) {
    const rightmost = Math.max(...aliveEnemies.map(e => e.x + e.width));
    const leftmost = Math.min(...aliveEnemies.map(e => e.x));

    if (currentDirection > 0 && rightmost + 10 >= 320) {
      shouldMoveDown = true;
      newDirection = -1;
    } else if (currentDirection < 0 && leftmost - 10 <= 0) {
      shouldMoveDown = true;
      newDirection = 1;
    }
  }

  commit('SI_MOVE_ENEMIES', { shouldMoveDown, newDirection });
}

function si_enemyShoot({commit, state}) {
  if (state.gameOver || state.isPaused) return;

  const aliveEnemies = state.enemies.filter(e => e.alive);
  if (aliveEnemies.length > 0 && Math.random() < 0.02) {
    const randomEnemy = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
    commit('SI_ENEMY_SHOOT', randomEnemy);
  }
}

function si_togglePause({commit}) {
  commit('SI_TOGGLE_PAUSE');
}

function si_resetGame({commit}, payload) {
  commit('SI_RESET_GAME', payload);
}

function si_nextLevel({commit}, payload) {
  commit('SI_NEXT_LEVEL', payload);
}

function si_checkLevelComplete({state}) {
  const aliveEnemies = state.enemies.filter(e => e.alive);
  return aliveEnemies.length === 0 && !state.gameOver;
}

function si_respawnPlayer({commit}, payload) {
  commit('SI_RESPAWN_PLAYER', payload);
}

export default {
  state: createState,
  mutations: {
    SI_INIT_GAME,
    SI_MOVE_PLAYER,
    SI_SET_PLAYER_X,
    SI_SHOOT,
    SI_UPDATE_BULLETS,
    SI_UPDATE_ENEMY_BULLETS,
    SI_MOVE_ENEMIES,
    SI_ENEMY_SHOOT,
    SI_CHECK_COLLISIONS,
    SI_UPDATE_TIMERS,
    SI_TOGGLE_PAUSE,
    SI_RESET_GAME,
    SI_RESPAWN_PLAYER,
    SI_NEXT_LEVEL,
  },
  actions: {
    si_initGame,
    si_movePlayer,
    si_setPlayerX,
    si_shoot,
    si_updateGame,
    si_moveEnemies,
    si_enemyShoot,
    si_togglePause,
    si_resetGame,
    si_nextLevel,
    si_checkLevelComplete,
    si_respawnPlayer,
  }
}
