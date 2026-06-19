import { defineStore } from 'pinia'

// Logische (interne) Auflösung — das Canvas wird per CSS scharf hochskaliert.
const LOGICAL_W = 320
const LOGICAL_H = 480

export const useSpaceInvadersStore = defineStore('spaceInvaders', {
  state: () => ({
    canvasWidth: LOGICAL_W,
    canvasHeight: LOGICAL_H,
    player: { x: 150, y: 0, width: 30, height: 18, speed: 5 },
    bullets: [],
    enemies: [],
    enemyBullets: [],
    explosions: [],
    bunkers: [],
    ufo: null,
    ufoTimer: 0,
    animFrame: 0, // 0/1 — Marsch-Animation der Invader
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
    enemyDirection: 1,
    _stepTimer: 0, // Frames bis zum nächsten Invader-Schritt
    _shootTimer: 0, // Frames bis zum nächsten Gegner-Schuss
    highScore: parseInt(localStorage.getItem('si_highscore') || '0'),
  }),

  actions: {
    si_initGame(payload) {
      const cw = (payload && payload.canvasWidth) || LOGICAL_W
      const ch = (payload && payload.canvasHeight) || LOGICAL_H

      this.canvasWidth = cw
      this.canvasHeight = ch

      this._resetPlayer()
      this.bullets = []
      this.enemyBullets = []
      this.explosions = []
      this.ufo = null
      this.ufoTimer = this._nextUfoDelay()
      this.animFrame = 0
      this.score = 0
      this.lives = 3
      this.level = 1
      this.gameOver = false
      this.isPaused = false
      this.isInvulnerable = false
      this.invulnerabilityTimer = 0
      this.isDying = false
      this.deathTimer = 0
      this.isRespawning = false
      this.respawnCountdown = 0
      this.enemyDirection = 1
      this._stepTimer = 0
      this._shootTimer = 60

      this.enemies = this._createEnemyGrid(5, 8, 10)
      this.bunkers = this._createBunkers()
    },

    _resetPlayer() {
      this.player = {
        x: Math.round(this.canvasWidth / 2 - 15),
        y: this.canvasHeight - 40,
        width: 30,
        height: 18,
        speed: 5,
      }
    },

    _createEnemyGrid(rows, cols, spacing) {
      const enemyWidth = 24
      const enemyHeight = 18
      const minPadding = 15
      let actualSpacing = spacing
      let gridWidth = cols * enemyWidth + (cols - 1) * actualSpacing
      if (gridWidth + minPadding * 2 > this.canvasWidth) {
        actualSpacing = Math.max(2, Math.floor((this.canvasWidth - minPadding * 2 - cols * enemyWidth) / (cols - 1)))
        gridWidth = cols * enemyWidth + (cols - 1) * actualSpacing
      }
      const startX = Math.floor((this.canvasWidth - gridWidth) / 2)

      // Typ je Reihe: 0 = squid (oben, am meisten Punkte), 1 = crab, 2 = octopus
      const typeForRow = (r) => (r === 0 ? 0 : r <= 2 ? 1 : 2)

      const enemies = []
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          enemies.push({
            x: col * (enemyWidth + actualSpacing) + startX,
            y: row * (enemyHeight + spacing) + 50,
            width: enemyWidth,
            height: enemyHeight,
            alive: true,
            type: typeForRow(row),
          })
        }
      }
      return enemies
    },

    _createBunkers() {
      const count = 4
      const cols = 11
      const rows = 8
      const cell = 3
      const bw = cols * cell
      const gap = (this.canvasWidth - count * bw) / (count + 1)
      const y = this.player.y - 70
      const mid = Math.floor(cols / 2)

      const bunkers = []
      for (let i = 0; i < count; i++) {
        const grid = []
        for (let r = 0; r < rows; r++) grid.push(new Array(cols).fill(1))
        // abgerundete obere Ecken
        grid[0][0] = grid[0][1] = grid[0][cols - 1] = grid[0][cols - 2] = 0
        grid[1][0] = grid[1][cols - 1] = 0
        // Tür-Bogen unten mittig
        for (let r = rows - 3; r < rows; r++) {
          for (let c = mid - 1; c <= mid + 1; c++) grid[r][c] = 0
        }
        bunkers.push({ x: Math.round(gap * (i + 1) + bw * i), y, cols, rows, cell, grid })
      }
      return bunkers
    },

    si_movePlayer(direction) {
      const p = this.player
      if (direction === 'left') p.x = Math.max(0, p.x - p.speed)
      else if (direction === 'right') p.x = Math.min(this.canvasWidth - p.width, p.x + p.speed)
    },

    si_setPlayerX(x) {
      const p = this.player
      p.x = Math.max(0, Math.min(this.canvasWidth - p.width, x - p.width / 2))
    },

    si_shoot() {
      if (this.gameOver || this.isDying) return
      // Klassisch: nur ein Spieler-Schuss gleichzeitig in der Luft
      if (this.bullets.length > 0) return
      const p = this.player
      this.bullets.push({ x: p.x + p.width / 2 - 2, y: p.y, width: 4, height: 10, speed: 8 })
    },

    _updateBullets() {
      this.bullets = this.bullets.filter((b) => {
        b.y -= b.speed
        return b.y > 0 && !this._hitBunkers(b)
      })
    },

    _updateEnemyBullets() {
      this.enemyBullets = this.enemyBullets.filter((b) => {
        b.y += b.speed
        return b.y < this.canvasHeight && !this._hitBunkers(b)
      })
    },

    _updateExplosions() {
      this.explosions = this.explosions.filter((ex) => {
        ex.radius += 2
        ex.alpha -= 0.05
        return ex.alpha > 0 && ex.radius < ex.maxRadius
      })
    },

    // Bunker-Treffer: erodiert die getroffene Zelle (+ Umgebung), gibt true bei Treffer.
    _hitBunkers(bullet) {
      for (const b of this.bunkers) {
        const c = Math.floor((bullet.x + bullet.width / 2 - b.x) / b.cell)
        if (c < 0 || c >= b.cols) continue
        const rA = Math.floor((bullet.y - b.y) / b.cell)
        const rB = Math.floor((bullet.y + bullet.height - b.y) / b.cell)
        const lo = Math.max(0, Math.min(rA, rB))
        const hi = Math.min(b.rows - 1, Math.max(rA, rB))
        for (let r = lo; r <= hi; r++) {
          if (b.grid[r][c]) {
            this._erodeBunker(b, r, c)
            return true
          }
        }
      }
      return false
    },

    _erodeBunker(b, r, c) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr
          const cc = c + dc
          if (rr >= 0 && rr < b.rows && cc >= 0 && cc < b.cols && Math.random() < 0.65) {
            b.grid[rr][cc] = 0
          }
        }
      }
      b.grid[r][c] = 0
    },

    _enemyStepFrames() {
      const alive = this.enemies.filter((e) => e.alive).length
      // viele Gegner -> langsam, wenige -> schnell (klassische Beschleunigung); höhere Level schneller
      return Math.max(4, Math.round(alive * 0.85) + 6 - this.level)
    },

    _stepEnemies() {
      const alive = this.enemies.filter((e) => e.alive)
      if (!alive.length) return
      const moveStep = 10
      let down = false
      let dir = this.enemyDirection
      const right = Math.max(...alive.map((e) => e.x + e.width))
      const left = Math.min(...alive.map((e) => e.x))
      if (dir > 0 && right + moveStep > this.canvasWidth) {
        down = true
        dir = -1
      } else if (dir < 0 && left - moveStep < 0) {
        down = true
        dir = 1
      }
      this.enemies.forEach((e) => {
        if (!e.alive) return
        if (down) e.y += 16
        else e.x += this.enemyDirection * moveStep
      })
      if (down) this.enemyDirection = dir
      this.animFrame = this.animFrame ? 0 : 1
    },

    _enemyShoot(enemy) {
      this.enemyBullets.push({
        x: enemy.x + enemy.width / 2 - 2,
        y: enemy.y + enemy.height,
        width: 4,
        height: 12,
        speed: 4,
      })
    },

    _updateEnemyFire() {
      if (this._shootTimer > 0) {
        this._shootTimer--
        return
      }
      const alive = this.enemies.filter((e) => e.alive)
      if (alive.length && this.enemyBullets.length < 2 + this.level) {
        const bottom = this._getBottomEnemies(alive)
        if (bottom.length) this._enemyShoot(bottom[Math.floor(Math.random() * bottom.length)])
      }
      this._shootTimer = Math.max(15, 70 - this.level * 5 - Math.floor(Math.random() * 40))
    },

    _getBottomEnemies(aliveEnemies) {
      const columns = {}
      aliveEnemies.forEach((e) => {
        const col = Math.round(e.x / 10)
        if (!columns[col] || e.y > columns[col].y) columns[col] = e
      })
      return Object.values(columns)
    },

    _nextUfoDelay() {
      return 900 + Math.floor(Math.random() * 1100) // ~15–33 s bei 60 fps
    },

    _updateUfo() {
      if (this.ufo) {
        this.ufo.x += this.ufo.dir * this.ufo.speed
        if (this.ufo.x > this.canvasWidth + 30 || this.ufo.x + this.ufo.width < -30) this.ufo = null
        return
      }
      if (this.ufoTimer > 0) {
        this.ufoTimer--
        return
      }
      if (this.isDying || this.isRespawning) return
      const fromLeft = Math.random() < 0.5
      const width = 36
      this.ufo = {
        x: fromLeft ? -width : this.canvasWidth,
        y: 22,
        width,
        height: 14,
        dir: fromLeft ? 1 : -1,
        speed: 1.3,
        points: [50, 100, 150, 300][Math.floor(Math.random() * 4)],
      }
      this.ufoTimer = this._nextUfoDelay()
    },

    _updateTimers() {
      if (this.isDying) {
        this.deathTimer--
        if (this.deathTimer <= 0) {
          this.isDying = false
          if (this.lives <= 0) {
            this.gameOver = true
            if (this.score > this.highScore) {
              this.highScore = this.score
              localStorage.setItem('si_highscore', this.score.toString())
            }
          } else {
            this.isRespawning = true
            this.respawnCountdown = 240
          }
        }
      }

      if (this.isRespawning) {
        this.respawnCountdown--
        if (this.respawnCountdown <= 0) this.isRespawning = false
      }

      if (this.isInvulnerable) {
        this.invulnerabilityTimer--
        if (this.invulnerabilityTimer <= 0) this.isInvulnerable = false
      }
    },

    _playerHit() {
      this.lives--
      this.explosions.push({
        x: this.player.x + this.player.width / 2,
        y: this.player.y + this.player.height / 2,
        radius: 10,
        maxRadius: 40,
        alpha: 1,
        type: 'player',
      })
      this.isDying = true
      this.deathTimer = 120
      this.enemyBullets = []
    },

    _checkCollisions() {
      const { bullets, enemies, enemyBullets, player } = this

      if (this.isDying || this.isRespawning) {
        this._updateTimers()
        return
      }

      // Spieler-Schüsse: Gegner + UFO
      for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i]
        let hit = false

        // UFO
        if (this.ufo && this._overlap(bullet, this.ufo)) {
          this.score += this.ufo.points
          this.explosions.push({ x: this.ufo.x + this.ufo.width / 2, y: this.ufo.y + this.ufo.height / 2, radius: 6, maxRadius: 26, alpha: 1, type: 'ufo' })
          this.ufo = null
          hit = true
        }

        if (!hit) {
          for (let j = 0; j < enemies.length; j++) {
            const enemy = enemies[j]
            if (enemy.alive && this._overlap(bullet, enemy)) {
              enemy.alive = false
              hit = true
              // squid (0) gibt am meisten
              this.score += (enemy.type === 0 ? 30 : enemy.type === 1 ? 20 : 10) * this.level
              this.explosions.push({ x: enemy.x + enemy.width / 2, y: enemy.y + enemy.height / 2, radius: 5, maxRadius: 18, alpha: 1, type: 'enemy' })
              break
            }
          }
        }

        if (hit) bullets.splice(i, 1)
      }

      // Gegner-Schüsse: Spieler
      if (!this.isInvulnerable) {
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
          if (this._overlap(enemyBullets[i], player)) {
            this._playerHit()
            this._updateTimers()
            return
          }
        }
      }

      // Gegner erreichen die Spielerhöhe
      if (!this.isInvulnerable) {
        const dangerLine = player.y + player.height
        for (let i = 0; i < enemies.length; i++) {
          const e = enemies[i]
          if (e.alive && e.y + e.height >= dangerLine) {
            e.alive = false
            this._playerHit()
            this._updateTimers()
            return
          }
        }
      }

      this._updateTimers()
    },

    _overlap(a, b) {
      return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
    },

    si_updateGame() {
      if (this.gameOver || this.isPaused) return

      this._updateBullets()
      this._updateEnemyBullets()
      this._updateExplosions()
      this._updateUfo()

      if (!this.isDying && !this.isRespawning) {
        if (this._stepTimer > 0) this._stepTimer--
        else {
          this._stepEnemies()
          this._stepTimer = this._enemyStepFrames()
        }
        this._updateEnemyFire()
      }

      this._checkCollisions()
    },

    si_togglePause() {
      this.isPaused = !this.isPaused
    },

    si_resetGame(payload) {
      this.si_initGame(payload)
    },

    si_respawnPlayer(payload) {
      this.canvasWidth = (payload && payload.canvasWidth) || this.canvasWidth
      this.canvasHeight = (payload && payload.canvasHeight) || this.canvasHeight

      this._resetPlayer()
      this.bullets = []
      this.enemyBullets = []
      this.isInvulnerable = true
      this.invulnerabilityTimer = 180
      this.isRespawning = false
      this.respawnCountdown = 0

      // Gegner, die zu weit unten stehen, etwas nach oben zurücksetzen
      let minY = 999
      this.enemies.forEach((e) => {
        if (e.alive && e.y < minY) minY = e.y
      })
      const resetOffset = minY - 50
      this.enemies.forEach((e) => {
        if (e.alive) {
          e.y = e.y - resetOffset
          if (e.y > 220) e.y = 50 + (e.y % 100)
        }
      })
    },

    si_nextLevel(payload) {
      this.canvasWidth = (payload && payload.canvasWidth) || this.canvasWidth
      this.canvasHeight = (payload && payload.canvasHeight) || this.canvasHeight
      this.level++

      this._resetPlayer()
      this.bullets = []
      this.enemyBullets = []
      this.explosions = []
      this.ufo = null
      this.ufoTimer = this._nextUfoDelay()
      this.isInvulnerable = false
      this.invulnerabilityTimer = 0
      this.isDying = false
      this.deathTimer = 0
      this.enemyDirection = 1
      this._stepTimer = 0
      this._shootTimer = 60
      this.score += 100 * this.level

      const rows = Math.min(5 + Math.floor(this.level / 3), 6)
      const cols = Math.min(8 + Math.floor(this.level / 2), 10)
      const spacing = Math.max(10 - this.level, 5)
      this.enemies = this._createEnemyGrid(rows, cols, spacing)
      this.bunkers = this._createBunkers()
    },

    si_checkLevelComplete() {
      return this.enemies.filter((e) => e.alive).length === 0 && !this.gameOver
    },
  },
})
