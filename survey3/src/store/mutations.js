import { log } from "src/tools/Logger";

export function PROTECTED_MODE_SET(state, payload) {
  state.PROTECTED_MODE = payload;
}

// PRESETS
export function PRESET_STORE(state, payload) {
  state.STORAGE.add_presets(payload);
}

export function PRESET_UPDATE(state, payload) {
  state.STORAGE.update_presets(payload);
}

export function PRESET_DELETE(state, payload) {
  state.STORAGE.delete_presets(payload);
}

export function PRESET_LOAD(state) {
  state.STORAGE.load_presets();
}

export function PRESET_CLEAR(state) {
  state.STORAGE.clear_presets();
}

export function EXPORT_CLEAR(state) {
  log({ message: "mutation: EXPORT_CLEAR" });
  state.EXPORT_DATA = [];
}

export function STORAGE_LOAD(state) {
  log({ message: "mutation: STORAGE_LOAD" });
  state.STORAGE.load();
}

export function STORAGE_ADD(state, payload) {
  log({ message: "mutation: STORAGE_ADD" });
  state.STORAGE.add(payload);
}

export function STORAGE_REMOVE(state, payload) {
  log({ message: "mutation: STORAGE_ADD" });
  state.STORAGE.remove(payload);
}

/**
 *
 * @param {*} state
 * @param {*} payload
 * @param {string} payload.field - name des Feldes
 * @param {object / integer / string} payload.value - Wert, der gespeichert werden soll
 * @example
 */
export function SETTINGS_SET(state, payload) {
  log({ message: "mutation: SETTINGS_SET", data: JSON.stringify(payload) });
  state.SETTINGS.set(payload);
}

// SPACE INVADERS MUTATIONS
export function SI_INIT_GAME(state, payload) {
  const canvasWidth = payload.canvasWidth || 320;
  const canvasHeight = payload.canvasHeight || 480;
  
  state.spaceInvaders.player = {
    x: canvasWidth / 2 - 20,
    y: canvasHeight - 60,
    width: 40,
    height: 30,
    speed: 5
  };
  state.spaceInvaders.bullets = [];
  state.spaceInvaders.enemyBullets = [];
  state.spaceInvaders.explosions = [];
  state.spaceInvaders.score = 0;
  state.spaceInvaders.lives = 3;
  state.spaceInvaders.level = 1;
  state.spaceInvaders.gameOver = false;
  state.spaceInvaders.isPaused = false;
  state.spaceInvaders.isInvulnerable = false;
  state.spaceInvaders.invulnerabilityTimer = 0;
  state.spaceInvaders.isDying = false;
  state.spaceInvaders.deathTimer = 0;
  state.spaceInvaders.isRespawning = false;
  state.spaceInvaders.respawnCountdown = 0;
  state.spaceInvaders.enemyDirection = 1;
  
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
  state.spaceInvaders.enemies = enemies;
}

export function SI_MOVE_PLAYER(state, direction) {
  const player = state.spaceInvaders.player;
  if (direction === 'left') {
    player.x = Math.max(0, player.x - player.speed);
  } else if (direction === 'right') {
    player.x = Math.min(320 - player.width, player.x + player.speed);
  }
}

export function SI_SET_PLAYER_X(state, x) {
  const player = state.spaceInvaders.player;
  player.x = Math.max(0, Math.min(320 - player.width, x - player.width / 2));
}

export function SI_SHOOT(state) {
  if (state.spaceInvaders.gameOver) return;
  const player = state.spaceInvaders.player;
  state.spaceInvaders.bullets.push({
    x: player.x + player.width / 2 - 2,
    y: player.y,
    width: 4,
    height: 10,
    speed: 7
  });
}

export function SI_UPDATE_BULLETS(state) {
  state.spaceInvaders.bullets = state.spaceInvaders.bullets.filter(bullet => {
    bullet.y -= bullet.speed;
    return bullet.y > 0;
  });
}

export function SI_UPDATE_ENEMY_BULLETS(state) {
  state.spaceInvaders.enemyBullets = state.spaceInvaders.enemyBullets.filter(bullet => {
    bullet.y += bullet.speed;
    return bullet.y < 480;
  });
  
  // Update explosions
  state.spaceInvaders.explosions = state.spaceInvaders.explosions.filter(explosion => {
    explosion.radius += 2;
    explosion.alpha -= 0.05;
    return explosion.alpha > 0 && explosion.radius < explosion.maxRadius;
  });
}

export function SI_MOVE_ENEMIES(state, payload) {
  const enemies = state.spaceInvaders.enemies;
  const shouldMoveDown = payload.shouldMoveDown || false;
  const newDirection = payload.newDirection;
  
  enemies.forEach(enemy => {
    if (enemy.alive) {
      if (shouldMoveDown) {
        // Only move down
        enemy.y += 20;
      } else {
        // Move horizontally in current direction
        enemy.x += state.spaceInvaders.enemyDirection * 10;
      }
    }
  });
  
  // Update direction after moving down
  if (shouldMoveDown && newDirection !== undefined) {
    state.spaceInvaders.enemyDirection = newDirection;
  }
}

export function SI_ENEMY_SHOOT(state, enemy) {
  state.spaceInvaders.enemyBullets.push({
    x: enemy.x + enemy.width / 2 - 2,
    y: enemy.y + enemy.height,
    width: 4,
    height: 15,  // Longer laser beam
    speed: 4
  });
}

export function SI_CHECK_COLLISIONS(state) {
  const { bullets, enemies, enemyBullets, player, isInvulnerable, isDying, isRespawning } = state.spaceInvaders;
  
  // Don't check NEW collisions during death or respawn, but update timers
  if (isDying || isRespawning) {
    // Just update timers and return
    SI_UPDATE_TIMERS(state);
    return;
  }
  
  // Check player bullets hitting enemies - iterate backwards to safely remove
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
        state.spaceInvaders.score += (4 - enemy.type) * 10 * state.spaceInvaders.level;
        
        // Add small explosion for enemy
        state.spaceInvaders.explosions.push({
          x: enemy.x + enemy.width / 2,
          y: enemy.y + enemy.height / 2,
          radius: 5,
          maxRadius: 20,
          alpha: 1,
          type: 'enemy'
        });
        break; // One bullet can only hit one enemy
      }
    }
    
    if (bulletHit) {
      bullets.splice(i, 1);
    }
  }
  
  // Check enemy bullets hitting player (only if not invulnerable)
  if (!isInvulnerable) {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const bullet = enemyBullets[i];
      if (bullet.x < player.x + player.width &&
          bullet.x + bullet.width > player.x &&
          bullet.y < player.y + player.height &&
          bullet.y + bullet.height > player.y) {
        
        // Player hit by bullet!
        state.spaceInvaders.lives--;
        
        // Add player explosion
        state.spaceInvaders.explosions.push({
          x: player.x + player.width / 2,
          y: player.y + player.height / 2,
          radius: 10,
          maxRadius: 40,
          alpha: 1,
          type: 'player'
        });
        
        // Start death sequence
        state.spaceInvaders.isDying = true;
        state.spaceInvaders.deathTimer = 120; // 2 seconds at 60fps
        
        // Clear all enemy bullets to give player a break
        state.spaceInvaders.enemyBullets = [];
        
        SI_UPDATE_TIMERS(state);
        return; // Stop checking more collisions
      }
    }
  }
  
  // Check if enemies reached the bottom (danger zone)
  // Aliens should not reach lower than the bottom of the player
  if (!isInvulnerable) {
    const dangerLine = player.y + player.height; // Bottom of player (e.g., y=420 + height=30 = 450)
    
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (enemy.alive && enemy.y + enemy.height >= dangerLine) {
        
        // Alien reached the player's bottom line! Life lost
        state.spaceInvaders.lives--;
        
        // Add player explosion at player position
        state.spaceInvaders.explosions.push({
          x: player.x + player.width / 2,
          y: player.y + player.height / 2,
          radius: 10,
          maxRadius: 40,
          alpha: 1,
          type: 'player'
        });
        
        // Start death sequence
        state.spaceInvaders.isDying = true;
        state.spaceInvaders.deathTimer = 120;
        
        // Clear enemy bullets
        state.spaceInvaders.enemyBullets = [];
        
        // Mark this enemy as dead so it doesn't trigger again
        enemy.alive = false;
        
        SI_UPDATE_TIMERS(state);
        return; // Stop checking more collisions
      }
    }
  }
  
  // Update all timers
  SI_UPDATE_TIMERS(state);
}

export function SI_UPDATE_TIMERS(state) {
  // Update death timer
  if (state.spaceInvaders.isDying) {
    state.spaceInvaders.deathTimer--;
    if (state.spaceInvaders.deathTimer <= 0) {
      state.spaceInvaders.isDying = false;
      
      // Check if game over
      if (state.spaceInvaders.lives <= 0) {
        state.spaceInvaders.gameOver = true;
        if (state.spaceInvaders.score > state.spaceInvaders.highScore) {
          state.spaceInvaders.highScore = state.spaceInvaders.score;
          localStorage.setItem('si_highscore', state.spaceInvaders.score.toString());
        }
      } else {
        // Start respawn countdown if lives remain
        state.spaceInvaders.isRespawning = true;
        state.spaceInvaders.respawnCountdown = 240; // 4 seconds at 60fps (message + 3,2,1)
      }
    }
  }
  
  // Update respawn countdown
  if (state.spaceInvaders.isRespawning) {
    state.spaceInvaders.respawnCountdown--;
    if (state.spaceInvaders.respawnCountdown <= 0) {
      state.spaceInvaders.isRespawning = false;
    }
  }
  
  // Update invulnerability timer
  if (state.spaceInvaders.isInvulnerable) {
    state.spaceInvaders.invulnerabilityTimer--;
    if (state.spaceInvaders.invulnerabilityTimer <= 0) {
      state.spaceInvaders.isInvulnerable = false;
    }
  }
}

export function SI_TOGGLE_PAUSE(state) {
  state.spaceInvaders.isPaused = !state.spaceInvaders.isPaused;
}

export function SI_RESET_GAME(state, payload) {
  SI_INIT_GAME(state, payload);
}

export function SI_RESPAWN_PLAYER(state, payload) {
  const canvasWidth = payload.canvasWidth || 320;
  const canvasHeight = payload.canvasHeight || 480;
  
  // Reset player position
  state.spaceInvaders.player = {
    x: canvasWidth / 2 - 20,
    y: canvasHeight - 60,
    width: 40,
    height: 30,
    speed: 5
  };
  
  // Clear bullets
  state.spaceInvaders.bullets = [];
  state.spaceInvaders.enemyBullets = [];
  
  // Set invulnerability for 3 seconds after respawn
  state.spaceInvaders.isInvulnerable = true;
  state.spaceInvaders.invulnerabilityTimer = 180;
  
  // Reset respawn state
  state.spaceInvaders.isRespawning = false;
  state.spaceInvaders.respawnCountdown = 0;
  
  // Reset enemies to safe starting position
  // Find the highest (lowest y value) alive enemy to determine how far they've moved
  let minY = 999;
  state.spaceInvaders.enemies.forEach(enemy => {
    if (enemy.alive && enemy.y < minY) {
      minY = enemy.y;
    }
  });
  
  // Calculate offset to move enemies back to top (starting position ~40px)
  const resetOffset = minY - 40;
  
  // Move all alive enemies back to starting area
  state.spaceInvaders.enemies.forEach(enemy => {
    if (enemy.alive) {
      enemy.y = enemy.y - resetOffset;
      // Extra safety: ensure they're not too far down
      if (enemy.y > 200) {
        enemy.y = 40 + (enemy.y % 100); // Reset to top area
      }
    }
  });
}

export function SI_NEXT_LEVEL(state, payload) {
  const canvasWidth = payload.canvasWidth || 320;
  const canvasHeight = payload.canvasHeight || 480;
  
  // Increase level
  state.spaceInvaders.level++;
  
  // Reset player position
  state.spaceInvaders.player = {
    x: canvasWidth / 2 - 20,
    y: canvasHeight - 60,
    width: 40,
    height: 30,
    speed: 5
  };
  
  // Clear bullets and explosions
  state.spaceInvaders.bullets = [];
  state.spaceInvaders.enemyBullets = [];
  state.spaceInvaders.explosions = [];
  
  // Reset invulnerability and death state
  state.spaceInvaders.isInvulnerable = false;
  state.spaceInvaders.invulnerabilityTimer = 0;
  state.spaceInvaders.isDying = false;
  state.spaceInvaders.deathTimer = 0;
  
  // Reset enemy direction
  state.spaceInvaders.enemyDirection = 1;
  
  // Bonus for completing level
  state.spaceInvaders.score += 100 * state.spaceInvaders.level;
  
  // Create more enemies with each level
  const enemies = [];
  const baseRows = 4;
  const baseCols = 8;
  const rows = Math.min(baseRows + Math.floor(state.spaceInvaders.level / 3), 6); // Max 6 rows
  const cols = Math.min(baseCols + Math.floor(state.spaceInvaders.level / 2), 10); // Max 10 cols
  const enemyWidth = 30;
  const enemyHeight = 25;
  const spacing = Math.max(10 - state.spaceInvaders.level, 5); // Tighter spacing at higher levels
  
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
  state.spaceInvaders.enemies = enemies;
}
