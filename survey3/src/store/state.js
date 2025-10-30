import TEXT from 'src/statics/Text.json'
import { SETTINGS } from 'src/tools/settings'

import { STORAGE } from 'src/tools/Storage'
// CREATE ID list FOR QUEST with FALSE

STORAGE.load()
STORAGE.load_presets()

import { QUESTS } from 'src/assets/questionnaires/list_quest'
import { QuestMan } from 'src/tools/QuestMan_class'

export default function () {
  return {
    ENV: TEXT.ENV,
    TEXT: TEXT,
    leftDrawerOpen: true,
    QuestMan: new QuestMan({ QUESTS: QUESTS }),
    STORAGE: STORAGE,
    SETTINGS: SETTINGS,
    debug: false,
    PROTECTED_MODE: false,
    editquest: undefined,
    EXPORT_DATA: [],
    // Space Invaders Game State
    spaceInvaders: {
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
}
