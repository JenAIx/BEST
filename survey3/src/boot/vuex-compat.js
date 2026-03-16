import { boot } from 'quasar/wrappers'
import { Notify } from 'quasar'
import { useMainStore } from 'src/stores/main'
import { useSpaceInvadersStore } from 'src/stores/spaceInvaders'

Notify.setDefaults({ timeout: 250 })

// Mutation name -> Pinia action mapping
const MUTATION_MAP = {
  PROTECTED_MODE_SET: 'setProtectedMode',
  PRESET_STORE: 'presetStore',
  PRESET_UPDATE: 'presetUpdate',
  PRESET_DELETE: 'presetDelete',
  PRESET_LOAD: 'presetLoad',
  PRESET_CLEAR: 'presetClear',
  EXPORT_CLEAR: 'exportClear',
  STORAGE_LOAD: 'storageLoad',
  STORAGE_ADD: 'storageAdd',
  STORAGE_REMOVE: 'storageRemove',
  SETTINGS_SET: 'settingsSet',
}

// Space Invaders mutation name -> Pinia action mapping
const SI_MUTATION_MAP = {
  SI_INIT_GAME: 'si_initGame',
  SI_MOVE_PLAYER: 'si_movePlayer',
  SI_SET_PLAYER_X: 'si_setPlayerX',
  SI_SHOOT: 'si_shoot',
  SI_UPDATE_BULLETS: '_updateBullets',
  SI_UPDATE_ENEMY_BULLETS: '_updateEnemyBullets',
  SI_MOVE_ENEMIES: '_moveEnemies',
  SI_ENEMY_SHOOT: '_enemyShoot',
  SI_CHECK_COLLISIONS: '_checkCollisions',
  SI_UPDATE_TIMERS: '_updateTimers',
  SI_TOGGLE_PAUSE: 'si_togglePause',
  SI_RESET_GAME: 'si_resetGame',
  SI_RESPAWN_PLAYER: 'si_respawnPlayer',
  SI_NEXT_LEVEL: 'si_nextLevel',
}

// Getter name -> { store, prop } mapping
// Getters whose name collides with state use a renamed getter in Pinia
const GETTER_MAP = {
  ENV: { prop: 'getEnv' },
  SETTINGS: { prop: 'getSettings' },
  PROTECTED_MODE: { prop: 'getProtectedMode' },
  STORAGE: { prop: 'getStorage' },
  // Non-colliding getters map directly
  ACTIVE_QUEST_LABEL: { prop: 'ACTIVE_QUEST_LABEL' },
  ACTIVE_QUEST: { prop: 'ACTIVE_QUEST' },
  QUEST_LIST: { prop: 'QUEST_LIST' },
  QUESTMAN: { prop: 'QUESTMAN' },
  PRESET_STORE: { prop: 'PRESET_STORE' },
  DEBUG_MODE: { prop: 'DEBUG_MODE' },
}

export default boot(({ app }) => {
  // Stores are lazily initialized on first access
  let _main = null
  let _si = null

  function main() {
    if (!_main) _main = useMainStore()
    return _main
  }

  function si() {
    if (!_si) _si = useSpaceInvadersStore()
    return _si
  }

  const stateProxy = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === 'spaceInvaders') return si().$state
        return main()[prop]
      },
      set(_, prop, value) {
        if (prop === 'spaceInvaders') return false
        main()[prop] = value
        return true
      },
    }
  )

  const gettersProxy = new Proxy(
    {},
    {
      get(_, prop) {
        const mapping = GETTER_MAP[prop]
        if (mapping) return main()[mapping.prop]
        // Fallback: try direct property on main store
        return main()[prop]
      },
    }
  )

  app.config.globalProperties.$store = {
    get state() {
      return stateProxy
    },
    get getters() {
      return gettersProxy
    },
    commit(name, payload) {
      // Check SI mutations first
      const siAction = SI_MUTATION_MAP[name]
      if (siAction) {
        si()[siAction](payload)
        return
      }
      // Main store mutations
      const action = MUTATION_MAP[name]
      if (action) {
        main()[action](payload)
        return
      }
      console.warn(`[vuex-compat] Unknown mutation: ${name}`)
    },
    dispatch(name, payload) {
      // Space Invaders actions (si_ prefix)
      if (name.startsWith('si_')) {
        const fn = si()[name]
        if (typeof fn === 'function') return fn(payload)
        console.warn(`[vuex-compat] Unknown SI action: ${name}`)
        return
      }
      // Main store actions
      const fn = main()[name]
      if (typeof fn === 'function') return fn(payload)
      console.warn(`[vuex-compat] Unknown action: ${name}`)
    },
  }
})
