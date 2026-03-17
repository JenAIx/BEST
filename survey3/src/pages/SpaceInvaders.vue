<template>
  <q-page class="flex flex-center" style="background: #000;">
    <div class="game-container">
      <!-- Back Button (upper left) -->
      <q-btn
        flat
        round
        dense
        color="grey-6"
        icon="arrow_back"
        class="back-btn"
        @click="goBack"
      />

      <!-- Game Info -->
      <div class="game-info">
        <div class="info-item">Level: {{ game.level }}</div>
        <div class="info-item">Score: {{ game.score }}</div>
        <div class="info-item">High: {{ game.highScore }}</div>
        <div class="info-item">Lives: {{ '❤️'.repeat(game.lives) }}</div>
      </div>

      <!-- Canvas -->
      <canvas 
        ref="gameCanvas" 
        :width="canvasWidth" 
        :height="canvasHeight"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
        @mousemove="handleMouseMove"
        @click="handleClick"
        style="border: 2px solid #0f0; background: #000;"
      ></canvas>

      <!-- Game Over Overlay -->
      <div v-if="game.gameOver" class="game-over-overlay">
        <div class="game-over-content">
          <h2 class="text-h3 text-green">GAME OVER</h2>
          <p class="text-h6">Score: {{ game.score }}</p>
          <p v-if="game.score === game.highScore && game.score > 0" class="text-h6 text-yellow">
            🏆 NEW HIGH SCORE! 🏆
          </p>
          <q-btn 
            color="primary" 
            label="Neues Spiel" 
            size="lg"
            @click="resetGame"
            class="q-mt-md"
          />
          <p class="q-mt-md text-grey-5">
            <small>oder Enter drücken</small>
          </p>
        </div>
      </div>

      <!-- Pause Overlay -->
      <div v-if="game.isPaused && !game.gameOver" class="pause-overlay">
        <div class="pause-content">
          <h2 class="text-h3 text-green">PAUSE</h2>
          <q-btn
            color="primary"
            label="Fortsetzen"
            size="lg"
            @click="togglePause"
            class="q-mt-md"
          />
          <div class="q-mt-lg">
            <q-btn
              flat
              color="red-4"
              label="Abbrechen"
              icon="close"
              @click="goBack"
            />
          </div>
        </div>
      </div>

      <!-- Level Complete Overlay -->
      <div v-if="levelTransition" class="game-over-overlay">
        <div class="game-over-content">
          <h2 class="text-h3 text-yellow">LEVEL {{ game.level }} COMPLETE!</h2>
          <p class="text-h6">Score: {{ game.score }}</p>
          <p class="text-h6 text-green q-mt-md">Nächster Level wird geladen...</p>
        </div>
      </div>

      <!-- Respawn Countdown Overlay -->
      <div v-if="game.isRespawning" class="game-over-overlay">
        <div class="game-over-content">
          <h2 v-if="respawnCountdownNumber > 0" class="text-h1 text-green countdown-number">
            {{ respawnCountdownNumber }}
          </h2>
          <h2 v-else-if="respawnCountdownNumber === 0" class="text-h2 text-yellow">
            START!
          </h2>
          <h3 v-else class="text-h4 text-white">
            Neues Raumschiff wird vorbereitet...
          </h3>
          <p class="text-h6 q-mt-md">Leben übrig: {{ game.lives }}</p>
        </div>
      </div>

      <!-- Controls -->
      <div class="controls">
        <!-- Keyboard Info -->
        <div class="keyboard-info q-mb-md">
          <small class="text-grey-5">
            ⌨️ Desktop: Maus/← → Pfeiltasten zum Bewegen, Leertaste/Klick zum Schießen, P für Pause
          </small>
        </div>
        
        <!-- Mobile Touch Controls -->
        <div class="mobile-controls q-mt-md">
          <q-btn 
            round 
            color="primary" 
            icon="chevron_left"
            size="lg"
            @touchstart="startMoveLeft"
            @touchend="stopMove"
            @mousedown="startMoveLeft"
            @mouseup="stopMove"
          />
          <q-btn 
            flat
            dense
            round 
            color="grey-6" 
            icon="pause"
            size="sm"
            @click="togglePause"
            class="q-mx-md pause-btn"
          />
          <q-btn 
            round 
            color="primary" 
            icon="chevron_right"
            size="lg"
            @touchstart="startMoveRight"
            @touchend="stopMove"
            @mousedown="startMoveRight"
            @mouseup="stopMove"
          />
        </div>
        
        <div class="q-mt-md">
          <q-btn 
            color="green" 
            label="🚀 FEUER" 
            size="lg"
            @click="shoot"
            style="width: 200px;"
          />
        </div>
      </div>

    </div>
  </q-page>
</template>

<script>
import { useMainStore } from 'src/stores/main'
import { useSpaceInvadersStore } from 'src/stores/spaceInvaders'

export default {
  name: 'SpaceInvaders',
  setup() {
    return { mainStore: useMainStore(), siStore: useSpaceInvadersStore() }
  },
  data() {
    return {
      canvasWidth: 320,
      canvasHeight: 480,
      ctx: null,
      gameLoop: null,
      enemyMoveInterval: null,
      enemyShootInterval: null,
      moveDirection: null,
      moveInterval: null,
      keysPressed: {},
      levelTransition: false
    };
  },
  computed: {
    game() {
      return this.siStore.$state
    },
    respawnCountdownNumber() {
      // 240 frames total (4 seconds)
      // First 60 frames (1 sec): show message (return -1)
      // Next 180 frames (3 sec): show 3, 2, 1
      const countdown = this.game.respawnCountdown;
      if (countdown > 180) {
        return -1; // Show message
      } else if (countdown > 120) {
        return 3;
      } else if (countdown > 60) {
        return 2;
      } else if (countdown > 20) {
        return 1;
      } else if (countdown > 0) {
        return 0; // Show START
      }
      return -1;
    }
  },
  mounted() {
    this.mainStore.setProtectedMode(true);
    this.initCanvas();
    this.initGame();
    this.startGame();
    this.addKeyboardListeners();
  },
  beforeUnmount() {
    this.stopGame();
    this.removeKeyboardListeners();
  },
  methods: {
    initCanvas() {
      const canvas = this.$refs.gameCanvas;
      this.ctx = canvas.getContext('2d');
    },
    
    initGame() {
      this.siStore.si_initGame({
        canvasWidth: this.canvasWidth,
        canvasHeight: this.canvasHeight
      });
    },
    
    startGame() {
      // Main game loop
      this.gameLoop = setInterval(() => {
        if (!this.game.isPaused && !this.game.gameOver && !this.levelTransition) {
          this.siStore.si_updateGame();
          this.draw();
          this.checkLevelComplete();
          this.checkRespawn();
        }
      }, 1000 / 60); // 60 FPS
      
      // Enemy movement (gets faster with each level)
      const moveSpeed = Math.max(400, 800 - (this.game.level - 1) * 50);
      this.enemyMoveInterval = setInterval(() => {
        if (!this.levelTransition && !this.game.isRespawning) {
          this.siStore.si_moveEnemies();
        }
      }, moveSpeed);
      
      // Enemy shooting (more frequent with each level)
      const shootSpeed = Math.max(800, 1500 - (this.game.level - 1) * 100);
      this.enemyShootInterval = setInterval(() => {
        if (!this.levelTransition && !this.game.isRespawning) {
          this.siStore.si_enemyShoot();
        }
      }, shootSpeed);
    },
    
    stopGame() {
      if (this.gameLoop) clearInterval(this.gameLoop);
      if (this.enemyMoveInterval) clearInterval(this.enemyMoveInterval);
      if (this.enemyShootInterval) clearInterval(this.enemyShootInterval);
      if (this.moveInterval) clearInterval(this.moveInterval);
    },
    
    draw() {
      // Clear canvas
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
      
      // Draw player
      this.drawPlayer();
      
      // Draw bullets
      this.drawBullets();
      
      // Draw enemies
      this.drawEnemies();
      
      // Draw enemy bullets
      this.drawEnemyBullets();
      
      // Draw explosions
      this.drawExplosions();
    },
    
    drawPlayer() {
      // Don't draw player during death animation
      if (this.game.isDying) {
        return;
      }
      
      const p = this.game.player;
      
      // Blink when invulnerable
      if (this.game.isInvulnerable && Math.floor(this.game.invulnerabilityTimer / 5) % 2 === 0) {
        return; // Skip drawing every other interval to create blink effect
      }
      
      this.ctx.fillStyle = '#0f0';
      
      // Simple spaceship shape
      this.ctx.beginPath();
      this.ctx.moveTo(p.x + p.width / 2, p.y);
      this.ctx.lineTo(p.x, p.y + p.height);
      this.ctx.lineTo(p.x + p.width, p.y + p.height);
      this.ctx.closePath();
      this.ctx.fill();
    },
    
    drawBullets() {
      this.ctx.fillStyle = '#0f0';
      this.game.bullets.forEach(bullet => {
        this.ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
      });
    },
    
    drawEnemies() {
      this.game.enemies.forEach(enemy => {
        if (!enemy.alive) return;
        
        // Different colors for different enemy types
        const colors = ['#f00', '#f80', '#ff0', '#0ff'];
        this.ctx.fillStyle = colors[enemy.type] || '#f00';
        
        // Simple enemy shape (rectangle with eyes)
        this.ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
        
        // Eyes
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(enemy.x + 8, enemy.y + 8, 4, 4);
        this.ctx.fillRect(enemy.x + 18, enemy.y + 8, 4, 4);
      });
    },
    
    drawEnemyBullets() {
      this.game.enemyBullets.forEach(bullet => {
        // Draw laser beam with gradient
        const gradient = this.ctx.createLinearGradient(bullet.x, bullet.y, bullet.x, bullet.y + bullet.height);
        gradient.addColorStop(0, '#ff0000');
        gradient.addColorStop(0.5, '#ff6600');
        gradient.addColorStop(1, '#ff0000');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        
        // Add glow effect
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = '#ff0000';
        this.ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        this.ctx.shadowBlur = 0;
      });
    },
    
    drawExplosions() {
      this.game.explosions.forEach(explosion => {
        this.ctx.save();
        this.ctx.globalAlpha = explosion.alpha;
        
        // Different colors for different explosion types
        const color = explosion.type === 'player' ? '#ff0000' : '#ffaa00';
        
        // Draw expanding circle
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Draw inner glow
        this.ctx.fillStyle = color;
        this.ctx.globalAlpha = explosion.alpha * 0.3;
        this.ctx.beginPath();
        this.ctx.arc(explosion.x, explosion.y, explosion.radius * 0.6, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
      });
    },
    
    shoot() {
      // Can't shoot while dying
      if (this.game.isDying) return;
      this.siStore.si_shoot();
    },
    
    startMoveLeft() {
      this.stopMove();
      this.moveDirection = 'left';
      this.siStore.si_movePlayer('left');
      this.moveInterval = setInterval(() => {
        this.siStore.si_movePlayer('left');
      }, 50);
    },
    
    startMoveRight() {
      this.stopMove();
      this.moveDirection = 'right';
      this.siStore.si_movePlayer('right');
      this.moveInterval = setInterval(() => {
        this.siStore.si_movePlayer('right');
      }, 50);
    },
    
    stopMove() {
      if (this.moveInterval) {
        clearInterval(this.moveInterval);
        this.moveInterval = null;
      }
      this.moveDirection = null;
    },
    
    handleTouchStart(event) {
      event.preventDefault();
      const touch = event.touches[0];
      const rect = this.$refs.gameCanvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      
      this.siStore.si_setPlayerX(x);
    },
    
    handleTouchMove(event) {
      event.preventDefault();
      const touch = event.touches[0];
      const rect = this.$refs.gameCanvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      
      this.siStore.si_setPlayerX(x);
    },
    
    handleTouchEnd(event) {
      event.preventDefault();
      // Shoot on touch release
      this.shoot();
    },
    
    handleMouseMove(event) {
      // Move player to mouse position
      const rect = this.$refs.gameCanvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      
      this.siStore.si_setPlayerX(x);
    },
    
    handleClick(event) {
      // For desktop: click to shoot
      this.shoot();
    },
    
    togglePause() {
      this.siStore.si_togglePause();
    },

    goBack() {
      if (!this.game.isPaused && !this.game.gameOver) {
        this.siStore.si_togglePause();
        return;
      }
      this.stopGame();
      this.$router.push('/');
    },
    
    resetGame() {
      this.levelTransition = false;
      this.stopGame();
      this.initGame();
      this.startGame();
    },
    
    checkLevelComplete() {
      const aliveEnemies = this.game.enemies.filter(e => e.alive);
      if (aliveEnemies.length === 0 && !this.game.gameOver && !this.levelTransition) {
        this.levelTransition = true;
        
        // Show level complete screen for 2 seconds
        setTimeout(() => {
          this.nextLevel();
        }, 2000);
      }
    },
    
    nextLevel() {
      this.stopGame();
      this.siStore.si_nextLevel({
        canvasWidth: this.canvasWidth,
        canvasHeight: this.canvasHeight
      });
      this.levelTransition = false;
      this.startGame();
    },
    
    checkRespawn() {
      // If respawn countdown just finished
      if (this.game.isRespawning && this.game.respawnCountdown === 1) {
        // Respawn player
        this.siStore.si_respawnPlayer({
          canvasWidth: this.canvasWidth,
          canvasHeight: this.canvasHeight
        });
      }
    },
    
    addKeyboardListeners() {
      window.addEventListener('keydown', this.handleKeyDown);
      window.addEventListener('keyup', this.handleKeyUp);
    },
    
    removeKeyboardListeners() {
      window.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('keyup', this.handleKeyUp);
    },
    
    handleKeyDown(event) {
      // Prevent default for game keys
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) {
        event.preventDefault();
      }
      
      // Avoid key repeat
      if (this.keysPressed[event.key]) return;
      this.keysPressed[event.key] = true;
      
      // Handle specific keys
      switch(event.key) {
        case 'ArrowLeft':
          this.startMoveLeft();
          break;
        case 'ArrowRight':
          this.startMoveRight();
          break;
        case ' ': // Space
          this.shoot();
          break;
        case 'p':
        case 'P':
          this.togglePause();
          break;
        case 'Enter':
          if (this.game.gameOver) {
            this.resetGame();
          }
          break;
      }
    },
    
    handleKeyUp(event) {
      this.keysPressed[event.key] = false;
      
      // Stop movement when arrow key is released
      if (event.key === 'ArrowLeft' && this.moveDirection === 'left') {
        this.stopMove();
      } else if (event.key === 'ArrowRight' && this.moveDirection === 'right') {
        this.stopMove();
      }
    }
  }
};
</script>

<style scoped>
.game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  position: relative;
}

.back-btn {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 50;
  opacity: 0.5;
  transition: opacity 0.3s;
}

.back-btn:hover {
  opacity: 1;
}

.game-info {
  display: flex;
  justify-content: space-around;
  width: 100%;
  max-width: 400px;
  margin-bottom: 10px;
  color: #0f0;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  font-weight: bold;
  flex-wrap: wrap;
  gap: 5px;
}

.info-item {
  padding: 4px 8px;
  background: rgba(0, 255, 0, 0.1);
  border: 1px solid #0f0;
  border-radius: 4px;
  flex: 1;
  min-width: 80px;
  text-align: center;
}

.controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 20px;
}

.keyboard-info {
  text-align: center;
  font-family: 'Courier New', monospace;
}

.mobile-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.pause-btn {
  opacity: 0.5;
  transition: opacity 0.3s;
}

.pause-btn:hover {
  opacity: 1;
}

.game-over-overlay,
.pause-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.game-over-content,
.pause-content {
  text-align: center;
  color: white;
  padding: 30px;
}

.text-green {
  color: #0f0;
}

.text-yellow {
  color: #ff0;
  animation: pulse 1s infinite;
}

.countdown-number {
  font-size: 120px !important;
  animation: countdown-pulse 0.8s ease-in-out;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes countdown-pulse {
  0% { 
    transform: scale(0.5);
    opacity: 0;
  }
  50% { 
    transform: scale(1.2);
  }
  100% { 
    transform: scale(1);
    opacity: 1;
  }
}

canvas {
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  cursor: crosshair;
}
</style>

