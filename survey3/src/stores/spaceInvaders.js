import { defineStore } from 'pinia'

export const useSpaceInvadersStore = defineStore('spaceInvaders', {
  state: () => ({
    canvasWidth: 320,
    canvasHeight: 480,
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
    enemyDirection: 1,
    highScore: parseInt(localStorage.getItem('si_highscore') || '0'),
  }),

  actions: {
    si_initGame(payload) {
      const cw = payload.canvasWidth || 320
      const ch = payload.canvasHeight || 480

      this.canvasWidth = cw
      this.canvasHeight = ch

      this.player = {
        x: cw / 2 - 20,
        y: ch - 60,
        width: 40,
        height: 30,
        speed: 5,
      }
      this.bullets = []
      this.enemyBullets = []
      this.explosions = []
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

      this.enemies = this._createEnemyGrid(4, 8, 10)
    },

    _createEnemyGrid(rows, cols, spacing) {
      const enemyWidth = 30
      const enemyHeight = 25
      const gridWidth = cols * enemyWidth + (cols - 1) * spacing
      // Center the grid horizontally with room for at least one movement step (10px) on each side
      const minPadding = 15
      // If grid is too wide, reduce spacing to fit
      let actualSpacing = spacing
      let actualGridWidth = gridWidth
      if (gridWidth + minPadding * 2 > this.canvasWidth) {
        actualSpacing = Math.max(2, Math.floor((this.canvasWidth - minPadding * 2 - cols * enemyWidth) / (cols - 1)))
        actualGridWidth = cols * enemyWidth + (cols - 1) * actualSpacing
      }
      const startX = Math.floor((this.canvasWidth - actualGridWidth) / 2)

      const enemies = []
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          enemies.push({
            x: col * (enemyWidth + actualSpacing) + startX,
            y: row * (enemyHeight + actualSpacing) + 40,
            width: enemyWidth,
            height: enemyHeight,
            alive: true,
            type: row % 4,
          })
        }
      }
      return enemies
    },

    si_movePlayer(direction) {
      const player = this.player
      if (direction === 'left') {
        player.x = Math.max(0, player.x - player.speed)
      } else if (direction === 'right') {
        player.x = Math.min(this.canvasWidth - player.width, player.x + player.speed)
      }
    },

    si_setPlayerX(x) {
      const player = this.player
      player.x = Math.max(0, Math.min(this.canvasWidth - player.width, x - player.width / 2))
    },

    si_shoot() {
      if (this.gameOver) return
      const player = this.player
      this.bullets.push({
        x: player.x + player.width / 2 - 2,
        y: player.y,
        width: 4,
        height: 10,
        speed: 7,
      })
    },

    _updateBullets() {
      this.bullets = this.bullets.filter((bullet) => {
        bullet.y -= bullet.speed
        return bullet.y > 0
      })
    },

    _updateEnemyBullets() {
      this.enemyBullets = this.enemyBullets.filter((bullet) => {
        bullet.y += bullet.speed
        return bullet.y < this.canvasHeight
      })
    },

    _updateExplosions() {
      this.explosions = this.explosions.filter((explosion) => {
        explosion.radius += 2
        explosion.alpha -= 0.05
        return explosion.alpha > 0 && explosion.radius < explosion.maxRadius
      })
    },

    _moveEnemies(payload) {
      const enemies = this.enemies
      const shouldMoveDown = payload.shouldMoveDown || false
      const newDirection = payload.newDirection

      enemies.forEach((enemy) => {
        if (enemy.alive) {
          if (shouldMoveDown) {
            enemy.y += 20
          } else {
            enemy.x += this.enemyDirection * 10
          }
        }
      })

      if (shouldMoveDown && newDirection !== undefined) {
        this.enemyDirection = newDirection
      }
    },

    _enemyShoot(enemy) {
      this.enemyBullets.push({
        x: enemy.x + enemy.width / 2 - 2,
        y: enemy.y + enemy.height,
        width: 4,
        height: 15,
        speed: 4,
      })
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
        if (this.respawnCountdown <= 0) {
          this.isRespawning = false
        }
      }

      if (this.isInvulnerable) {
        this.invulnerabilityTimer--
        if (this.invulnerabilityTimer <= 0) {
          this.isInvulnerable = false
        }
      }
    },

    _checkCollisions() {
      const { bullets, enemies, enemyBullets, player, isInvulnerable, isDying, isRespawning } = this

      if (isDying || isRespawning) {
        this._updateTimers()
        return
      }

      // Check player bullets hitting enemies
      for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i]
        let bulletHit = false

        for (let j = 0; j < enemies.length; j++) {
          const enemy = enemies[j]
          if (
            enemy.alive &&
            bullet.x < enemy.x + enemy.width &&
            bullet.x + bullet.width > enemy.x &&
            bullet.y < enemy.y + enemy.height &&
            bullet.y + bullet.height > enemy.y
          ) {
            enemy.alive = false
            bulletHit = true
            this.score += (4 - enemy.type) * 10 * this.level

            this.explosions.push({
              x: enemy.x + enemy.width / 2,
              y: enemy.y + enemy.height / 2,
              radius: 5,
              maxRadius: 20,
              alpha: 1,
              type: 'enemy',
            })
            break
          }
        }

        if (bulletHit) {
          bullets.splice(i, 1)
        }
      }

      // Check enemy bullets hitting player
      if (!isInvulnerable) {
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
          const bullet = enemyBullets[i]
          if (
            bullet.x < player.x + player.width &&
            bullet.x + bullet.width > player.x &&
            bullet.y < player.y + player.height &&
            bullet.y + bullet.height > player.y
          ) {
            this.lives--

            this.explosions.push({
              x: player.x + player.width / 2,
              y: player.y + player.height / 2,
              radius: 10,
              maxRadius: 40,
              alpha: 1,
              type: 'player',
            })

            this.isDying = true
            this.deathTimer = 120
            this.enemyBullets = []

            this._updateTimers()
            return
          }
        }
      }

      // Check if enemies reached the bottom
      if (!isInvulnerable) {
        const dangerLine = player.y + player.height

        for (let i = 0; i < enemies.length; i++) {
          const enemy = enemies[i]
          if (enemy.alive && enemy.y + enemy.height >= dangerLine) {
            this.lives--

            this.explosions.push({
              x: player.x + player.width / 2,
              y: player.y + player.height / 2,
              radius: 10,
              maxRadius: 40,
              alpha: 1,
              type: 'player',
            })

            this.isDying = true
            this.deathTimer = 120
            this.enemyBullets = []
            enemy.alive = false

            this._updateTimers()
            return
          }
        }
      }

      this._updateTimers()
    },

    si_updateGame() {
      if (this.gameOver || this.isPaused) return

      this._updateBullets()
      this._updateEnemyBullets()
      this._updateExplosions()
      this._checkCollisions()
    },

    si_moveEnemies() {
      if (this.gameOver || this.isPaused) return

      const enemies = this.enemies
      const currentDirection = this.enemyDirection
      let shouldMoveDown = false
      let newDirection = currentDirection
      const moveStep = 10

      const aliveEnemies = enemies.filter((e) => e.alive)
      if (aliveEnemies.length > 0) {
        const rightmost = Math.max(...aliveEnemies.map((e) => e.x + e.width))
        const leftmost = Math.min(...aliveEnemies.map((e) => e.x))

        if (currentDirection > 0 && rightmost + moveStep > this.canvasWidth) {
          shouldMoveDown = true
          newDirection = -1
        } else if (currentDirection < 0 && leftmost - moveStep < 0) {
          shouldMoveDown = true
          newDirection = 1
        }
      }

      this._moveEnemies({ shouldMoveDown, newDirection })
    },

    si_enemyShoot() {
      if (this.gameOver || this.isPaused) return

      const aliveEnemies = this.enemies.filter((e) => e.alive)
      if (aliveEnemies.length > 0) {
        // Pick a random enemy from the bottom row of each column to shoot
        const bottomEnemies = this._getBottomEnemies(aliveEnemies)
        if (bottomEnemies.length > 0) {
          const shooter = bottomEnemies[Math.floor(Math.random() * bottomEnemies.length)]
          this._enemyShoot(shooter)
        }
      }
    },

    _getBottomEnemies(aliveEnemies) {
      // Group by approximate x position and return the lowest enemy in each column
      const columns = {}
      aliveEnemies.forEach((e) => {
        const col = Math.round(e.x / 10) // group by column
        if (!columns[col] || e.y > columns[col].y) {
          columns[col] = e
        }
      })
      return Object.values(columns)
    },

    si_togglePause() {
      this.isPaused = !this.isPaused
    },

    si_resetGame(payload) {
      this.si_initGame(payload)
    },

    si_respawnPlayer(payload) {
      const cw = payload.canvasWidth || this.canvasWidth
      const ch = payload.canvasHeight || this.canvasHeight

      this.player = {
        x: cw / 2 - 20,
        y: ch - 60,
        width: 40,
        height: 30,
        speed: 5,
      }

      this.bullets = []
      this.enemyBullets = []

      this.isInvulnerable = true
      this.invulnerabilityTimer = 180
      this.isRespawning = false
      this.respawnCountdown = 0

      let minY = 999
      this.enemies.forEach((enemy) => {
        if (enemy.alive && enemy.y < minY) {
          minY = enemy.y
        }
      })

      const resetOffset = minY - 40

      this.enemies.forEach((enemy) => {
        if (enemy.alive) {
          enemy.y = enemy.y - resetOffset
          if (enemy.y > 200) {
            enemy.y = 40 + (enemy.y % 100)
          }
        }
      })
    },

    si_nextLevel(payload) {
      const cw = payload.canvasWidth || this.canvasWidth
      const ch = payload.canvasHeight || this.canvasHeight

      this.canvasWidth = cw
      this.canvasHeight = ch
      this.level++

      this.player = {
        x: cw / 2 - 20,
        y: ch - 60,
        width: 40,
        height: 30,
        speed: 5,
      }

      this.bullets = []
      this.enemyBullets = []
      this.explosions = []

      this.isInvulnerable = false
      this.invulnerabilityTimer = 0
      this.isDying = false
      this.deathTimer = 0

      this.enemyDirection = 1

      this.score += 100 * this.level

      const baseRows = 4
      const baseCols = 8
      const rows = Math.min(baseRows + Math.floor(this.level / 3), 6)
      const cols = Math.min(baseCols + Math.floor(this.level / 2), 10)
      const spacing = Math.max(10 - this.level, 5)

      this.enemies = this._createEnemyGrid(rows, cols, spacing)
    },

    si_checkLevelComplete() {
      const aliveEnemies = this.enemies.filter((e) => e.alive)
      return aliveEnemies.length === 0 && !this.gameOver
    },
  },
})
