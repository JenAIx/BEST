<template>
  <q-page class="si-page">
    <div class="game-container">
      <q-btn flat round dense color="grey-6" icon="arrow_back" class="back-btn" @click="goBack" />

      <!-- Game Info -->
      <div class="game-info" :style="{ width: displayW + 'px' }">
        <div class="info-item">LvL {{ game.level }}</div>
        <div class="info-item">{{ game.score }}</div>
        <div class="info-item">HI {{ game.highScore }}</div>
        <div class="info-item">{{ '▲'.repeat(game.lives) }}</div>
      </div>

      <!-- Canvas -->
      <div class="canvas-wrap" :style="{ width: displayW + 'px', height: displayH + 'px' }">
        <canvas
          ref="gameCanvas"
          :width="canvasWidth"
          :height="canvasHeight"
          :style="{ width: displayW + 'px', height: displayH + 'px' }"
          @touchstart.prevent="onCanvasTouchStart"
          @touchmove.prevent="onCanvasTouchMove"
          @touchend.prevent="onCanvasTouchEnd"
          @mousemove="handleMouseMove"
          @click="handleClick"
        ></canvas>

        <!-- Overlays liegen über dem Canvas -->
        <div v-if="game.gameOver" class="overlay">
          <h2 class="text-h4 text-green">GAME OVER</h2>
          <p class="text-subtitle1">Score: {{ game.score }}</p>
          <p v-if="game.score === game.highScore && game.score > 0" class="text-subtitle1 text-yellow">🏆 NEW HIGH SCORE!</p>
          <q-btn color="primary" label="Neues Spiel" @click="resetGame" class="q-mt-sm" />
        </div>

        <div v-else-if="game.isPaused" class="overlay">
          <h2 class="text-h4 text-green">PAUSE</h2>
          <q-btn color="primary" label="Fortsetzen" @click="togglePause" class="q-mt-sm" />
          <q-btn flat color="red-4" label="Abbrechen" icon="close" @click="goBack" class="q-mt-sm" />
        </div>

        <div v-else-if="levelTransition" class="overlay">
          <h2 class="text-h5 text-yellow">LEVEL {{ game.level }} GESCHAFFT!</h2>
          <p class="text-subtitle2 text-green">Nächster Level …</p>
        </div>

        <div v-else-if="game.isRespawning" class="overlay">
          <h2 v-if="respawnCountdownNumber > 0" class="text-h2 text-green countdown-number">{{ respawnCountdownNumber }}</h2>
          <h2 v-else-if="respawnCountdownNumber === 0" class="text-h4 text-yellow">START!</h2>
          <h3 v-else class="text-subtitle1 text-white">Neues Raumschiff …</h3>
          <p class="text-caption q-mt-xs">Leben: {{ '▲'.repeat(game.lives) }}</p>
        </div>
      </div>

      <!-- Mobile-/Touch-Steuerung -->
      <div class="controls" :style="{ width: displayW + 'px' }">
        <q-btn round color="primary" icon="chevron_left" class="ctrl-btn"
          @touchstart.prevent="startMoveLeft" @touchend.prevent="stopMove"
          @mousedown="startMoveLeft" @mouseup="stopMove" @mouseleave="stopMove" />
        <q-btn flat dense round color="grey-6" :icon="game.isPaused ? 'play_arrow' : 'pause'" class="ctrl-pause" @click="togglePause" />
        <q-btn color="green-13" text-color="black" icon="rocket_launch" class="ctrl-fire" label="FEUER" @click="shoot" />
        <q-btn flat dense round color="grey-6" icon="refresh" class="ctrl-pause" @click="resetGame" />
        <q-btn round color="primary" icon="chevron_right" class="ctrl-btn"
          @touchstart.prevent="startMoveRight" @touchend.prevent="stopMove"
          @mousedown="startMoveRight" @mouseup="stopMove" @mouseleave="stopMove" />
      </div>

      <div v-if="!isTouch" class="keyboard-info">
        ⌨️ ← →  bewegen · Leertaste/Klick  schießen · P  Pause · ziehen/tippen auf dem Feld
      </div>
    </div>
  </q-page>
</template>

<script>
import { useMainStore } from 'src/stores/main'
import { useSpaceInvadersStore } from 'src/stores/spaceInvaders'

// --- Pixel-Sprites (1 = Pixel). Silhouetten der klassischen Invader. ---
const SPRITES = {
  // type 0 = squid, 1 = crab, 2 = octopus — je 2 Marsch-Frames
  enemy: [
    [
      ['00011000', '00111100', '01111110', '11011011', '11111111', '00100100', '01011010', '10100101'],
      ['00011000', '00111100', '01111110', '11011011', '11111111', '01000010', '10000001', '01000010'],
    ],
    [
      ['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000'],
      ['00100000100', '10010001001', '10111111101', '11101110111', '11111111111', '00111111100', '00100000100', '01000000010'],
    ],
    [
      ['000011110000', '011111111110', '111111111111', '111001100111', '111111111111', '000111111000', '001100001100', '011000000110'],
      ['000011110000', '011111111110', '111111111111', '111001100111', '111111111111', '001111111100', '011100001110', '000110011000'],
    ],
  ],
  player: ['00000100000', '00001110000', '00001110000', '01111111110', '11111111111', '11111111111', '11111111111', '11111111111'],
  ufo: [
    '0000011111100000',
    '0001111111111000',
    '0011111111111100',
    '0110110110110110',
    '1111111111111111',
    '0011001100110000',
  ],
}
const ENEMY_COLORS = ['#5ad1ff', '#ffe14d', '#ff7a6b']

export default {
  name: 'SpaceInvaders',
  setup() {
    return { mainStore: useMainStore(), siStore: useSpaceInvadersStore() }
  },
  data() {
    return {
      canvasWidth: 320, // logische Auflösung (CSS skaliert scharf hoch)
      canvasHeight: 480,
      displayW: 320,
      displayH: 480,
      ctx: null,
      gameLoop: null,
      moveDirection: null,
      moveInterval: null,
      keysPressed: {},
      levelTransition: false,
      isTouch: false,
      touchMoved: false,
    }
  },
  computed: {
    game() {
      return this.siStore.$state
    },
    respawnCountdownNumber() {
      const c = this.game.respawnCountdown
      if (c > 180) return -1
      if (c > 120) return 3
      if (c > 60) return 2
      if (c > 20) return 1
      if (c > 0) return 0
      return -1
    },
  },
  mounted() {
    this.isTouch = !!(this.$q.platform.has && this.$q.platform.has.touch)
    this.computeSize()
    this.initCanvas()
    this.initGame()
    this.startGame()
    this.addKeyboardListeners()
    window.addEventListener('resize', this.computeSize)
  },
  beforeUnmount() {
    this.stopGame()
    this.removeKeyboardListeners()
    window.removeEventListener('resize', this.computeSize)
  },
  methods: {
    computeSize() {
      // Canvas füllt den verfügbaren Platz (Viewport minus Info/Controls), Seitenverhältnis 320:480
      const reserved = this.isTouch ? 150 : 180 // Info + Steuerung
      const availW = Math.min(window.innerWidth - 16, 520)
      const availH = window.innerHeight - reserved
      const scale = Math.min(availW / this.canvasWidth, availH / this.canvasHeight)
      this.displayW = Math.max(200, Math.floor(this.canvasWidth * scale))
      this.displayH = Math.floor(this.displayW * (this.canvasHeight / this.canvasWidth))
    },
    initCanvas() {
      this.ctx = this.$refs.gameCanvas.getContext('2d')
      this.ctx.imageSmoothingEnabled = false
    },
    initGame() {
      this.siStore.si_initGame({ canvasWidth: this.canvasWidth, canvasHeight: this.canvasHeight })
    },
    startGame() {
      this.gameLoop = setInterval(() => {
        if (!this.game.isPaused && !this.game.gameOver && !this.levelTransition) {
          this.siStore.si_updateGame()
          this.draw()
          this.checkLevelComplete()
          this.checkRespawn()
        }
      }, 1000 / 60)
    },
    stopGame() {
      if (this.gameLoop) clearInterval(this.gameLoop)
      if (this.moveInterval) clearInterval(this.moveInterval)
    },

    // ---------- Rendering ----------
    draw() {
      const ctx = this.ctx
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)
      this.drawBunkers()
      this.drawPlayer()
      this.drawBullets()
      this.drawEnemies()
      this.drawUfo()
      this.drawEnemyBullets()
      this.drawExplosions()
    },
    drawSprite(bitmap, x, y, boxW, boxH, color) {
      const ctx = this.ctx
      const rows = bitmap.length
      const cols = bitmap[0].length
      const cw = boxW / cols
      const ch = boxH / rows
      ctx.fillStyle = color
      for (let r = 0; r < rows; r++) {
        const row = bitmap[r]
        for (let c = 0; c < cols; c++) {
          if (row[c] === '1') ctx.fillRect(x + c * cw, y + r * ch, Math.ceil(cw), Math.ceil(ch))
        }
      }
    },
    drawPlayer() {
      if (this.game.isDying) return
      if (this.game.isInvulnerable && Math.floor(this.game.invulnerabilityTimer / 5) % 2 === 0) return
      const p = this.game.player
      this.drawSprite(SPRITES.player, p.x, p.y, p.width, p.height, '#39ff5b')
    },
    drawBullets() {
      this.ctx.fillStyle = '#aef'
      this.game.bullets.forEach((b) => this.ctx.fillRect(b.x, b.y, b.width, b.height))
    },
    drawEnemies() {
      const frame = this.game.animFrame
      this.game.enemies.forEach((e) => {
        if (!e.alive) return
        const bmp = SPRITES.enemy[e.type][frame]
        this.drawSprite(bmp, e.x, e.y, e.width, e.height, ENEMY_COLORS[e.type] || '#fff')
      })
    },
    drawUfo() {
      const u = this.game.ufo
      if (!u) return
      this.drawSprite(SPRITES.ufo, u.x, u.y, u.width, u.height, '#ff5cf0')
    },
    drawBunkers() {
      this.ctx.fillStyle = '#36e06a'
      this.game.bunkers.forEach((b) => {
        for (let r = 0; r < b.rows; r++) {
          for (let c = 0; c < b.cols; c++) {
            if (b.grid[r][c]) this.ctx.fillRect(b.x + c * b.cell, b.y + r * b.cell, b.cell, b.cell)
          }
        }
      })
    },
    drawEnemyBullets() {
      const ctx = this.ctx
      this.game.enemyBullets.forEach((b) => {
        const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.height)
        g.addColorStop(0, '#ff3b3b')
        g.addColorStop(0.5, '#ff8a3b')
        g.addColorStop(1, '#ff3b3b')
        ctx.fillStyle = g
        ctx.fillRect(b.x, b.y, b.width, b.height)
      })
    },
    drawExplosions() {
      const ctx = this.ctx
      this.game.explosions.forEach((ex) => {
        ctx.save()
        ctx.globalAlpha = ex.alpha
        const color = ex.type === 'player' ? '#ff3b3b' : ex.type === 'ufo' ? '#ff5cf0' : '#ffd23b'
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(ex.x, ex.y, ex.radius, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = color
        ctx.globalAlpha = ex.alpha * 0.3
        ctx.beginPath()
        ctx.arc(ex.x, ex.y, ex.radius * 0.6, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })
    },

    // ---------- Steuerung ----------
    shoot() {
      if (this.game.isDying) return
      this.siStore.si_shoot()
    },
    startMoveLeft() {
      this.stopMove()
      this.moveDirection = 'left'
      this.siStore.si_movePlayer('left')
      this.moveInterval = setInterval(() => this.siStore.si_movePlayer('left'), 30)
    },
    startMoveRight() {
      this.stopMove()
      this.moveDirection = 'right'
      this.siStore.si_movePlayer('right')
      this.moveInterval = setInterval(() => this.siStore.si_movePlayer('right'), 30)
    },
    stopMove() {
      if (this.moveInterval) {
        clearInterval(this.moveInterval)
        this.moveInterval = null
      }
      this.moveDirection = null
    },
    _logicalX(clientX) {
      const rect = this.$refs.gameCanvas.getBoundingClientRect()
      return (clientX - rect.left) * (this.canvasWidth / rect.width)
    },
    onCanvasTouchStart(e) {
      this.touchMoved = false
      this.siStore.si_setPlayerX(this._logicalX(e.touches[0].clientX))
    },
    onCanvasTouchMove(e) {
      this.touchMoved = true
      this.siStore.si_setPlayerX(this._logicalX(e.touches[0].clientX))
    },
    onCanvasTouchEnd() {
      // Tippen (ohne Ziehen) feuert
      if (!this.touchMoved) this.shoot()
    },
    handleMouseMove(e) {
      this.siStore.si_setPlayerX(this._logicalX(e.clientX))
    },
    handleClick() {
      this.shoot()
    },
    togglePause() {
      this.siStore.si_togglePause()
    },
    goBack() {
      if (!this.game.isPaused && !this.game.gameOver) {
        this.siStore.si_togglePause()
        return
      }
      this.stopGame()
      this.$router.push('/')
    },
    resetGame() {
      this.levelTransition = false
      this.stopGame()
      this.initGame()
      this.startGame()
    },
    checkLevelComplete() {
      if (this.game.enemies.filter((e) => e.alive).length === 0 && !this.game.gameOver && !this.levelTransition) {
        this.levelTransition = true
        setTimeout(() => this.nextLevel(), 1800)
      }
    },
    nextLevel() {
      this.siStore.si_nextLevel({ canvasWidth: this.canvasWidth, canvasHeight: this.canvasHeight })
      this.levelTransition = false
    },
    checkRespawn() {
      if (this.game.isRespawning && this.game.respawnCountdown === 1) {
        this.siStore.si_respawnPlayer({ canvasWidth: this.canvasWidth, canvasHeight: this.canvasHeight })
      }
    },
    addKeyboardListeners() {
      window.addEventListener('keydown', this.handleKeyDown)
      window.addEventListener('keyup', this.handleKeyUp)
    },
    removeKeyboardListeners() {
      window.removeEventListener('keydown', this.handleKeyDown)
      window.removeEventListener('keyup', this.handleKeyUp)
    },
    handleKeyDown(e) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault()
      if (this.keysPressed[e.key]) return
      this.keysPressed[e.key] = true
      switch (e.key) {
        case 'ArrowLeft': this.startMoveLeft(); break
        case 'ArrowRight': this.startMoveRight(); break
        case ' ': this.shoot(); break
        case 'p': case 'P': this.togglePause(); break
        case 'Enter': if (this.game.gameOver) this.resetGame(); break
      }
    },
    handleKeyUp(e) {
      this.keysPressed[e.key] = false
      if (e.key === 'ArrowLeft' && this.moveDirection === 'left') this.stopMove()
      else if (e.key === 'ArrowRight' && this.moveDirection === 'right') this.stopMove()
    },
  },
}
</script>

<style scoped>
.si-page {
  background: #000;
  display: flex;
  justify-content: center;
  min-height: 100vh;
}
.game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 8px calc(8px + env(safe-area-inset-bottom));
  position: relative;
}
.back-btn {
  position: absolute;
  top: 4px;
  left: 4px;
  z-index: 50;
  opacity: 0.45;
}
.game-info {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 6px;
  color: #39ff5b;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  font-weight: bold;
}
.info-item {
  padding: 3px 8px;
  background: rgba(57, 255, 91, 0.08);
  border: 1px solid rgba(57, 255, 91, 0.5);
  border-radius: 4px;
  text-align: center;
  white-space: nowrap;
}
.canvas-wrap {
  position: relative;
}
canvas {
  display: block;
  border: 2px solid #1f7a33;
  background: #000;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}
.overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #fff;
  z-index: 20;
}
.controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
}
.ctrl-btn {
  font-size: 22px;
}
.ctrl-fire {
  flex: 1;
  max-width: 180px;
  font-weight: bold;
  height: 52px;
}
.ctrl-pause {
  opacity: 0.6;
}
.keyboard-info {
  margin-top: 10px;
  color: #6b6b6b;
  font-family: 'Courier New', monospace;
  font-size: 11px;
  text-align: center;
  max-width: 360px;
}
.text-green { color: #39ff5b; }
.text-yellow { color: #ff0; animation: pulse 1s infinite; }
.countdown-number { animation: countdown-pulse 0.8s ease-in-out; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
@keyframes countdown-pulse { 0% { transform: scale(0.5); opacity: 0; } 50% { transform: scale(1.2); } 100% { transform: scale(1); opacity: 1; } }
</style>
