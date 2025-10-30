import { Platform } from 'quasar'
import * as CDA from "src/tools/CDA_H7_JSON"
import { log } from "src/tools/Logger"
import { encrypt, verify } from 'src/tools/hhash'
import { sendMail } from 'src/tools/mail'

export function loadNextQuest ({commit}) {
  commit("QUEST_LOAD_NEXT")
}

export function setProtectedMode ({commit}, payload) {
  commit("PROTECTED_MODE_SET", payload)
}

// CRUD STORE
export function updatePreset ({commit}, payload) {
  commit("PRESET_UPDATE", payload)
}

export function storePreset ({commit}, payload) {
  commit("PRESET_STORE", payload)
}

export function deletePreset ({commit}, payload) {
  commit("PRESET_DELETE", payload)
}

export function savePreset ({commit}) {
  commit("PRESET_SAVE")
}

export function loadPreset ({commit}) {
  commit("PRESET_LOAD")
}

export function clearPreset ({commit}) {
  commit("PRESET_CLEAR")
}

// STORAGE
export function storage_add({state, commit}, payload) {
  //first create a CDA document >> tested by storage_export_hl7.test.js
  const document = CDA.import_quest({
    data: {
      PID: payload.PID,
      quest: payload.quest
    },
    investigator: {
      uid: state.SETTINGS.user_uid,
      keyPair: state.SETTINGS.user_keyPair
    }
  })
  // now add the document to the storage
  commit("STORAGE_ADD", document)
}

export function storage_add_from_file({state, commit}, payload) {
  //first create a CDA document >> tested by storage_export_hl7.test.js
  return new Promise((res, rej) => {
    if (payload === undefined || payload.cda === undefined) {
      log({error: 'import fehlgeschlagen', data: payload})
      rej(false)
    }

    // add the document
    commit("STORAGE_ADD", payload)
    res(true)
  })

  
}

export function storage_encrypted_export({state}, payload) {
  log({message: 'storage_encrypted_export'})
  var document = payload.document
  if (document === undefined) document = state.STORAGE.get(-1)
  const publicKey = payload.pubKey //this is the pubkey as transmitted via the url
  if (document === undefined) return log({error: 'storage_encrypted_export: no cda found'})
  if (publicKey === undefined) return log({error: 'storage_encrypted_export: no publicKey found'})

  // do the encryption
  const enc = encrypt(JSON.stringify(document), publicKey)
  const filename = state.STORAGE._create_filename(document, 'json')

  // EXPORT THE FILE
  const status = state.STORAGE._export_file(filename, JSON.stringify(enc))

  // ADD TO EXPORT_DATA
    state.EXPORT_DATA.push({
      enc: enc,
      filename: filename,
      email: payload.email
    })
    
    
  return status
}

export function mail_exported_data({state, commit}) {
  log({message: 'mail_exported_data'})
  return new Promise ((resolve, reject) => {
    //prepare the message
    const data = state.EXPORT_DATA
    if (!data || data.length < 1) return reject(false)

    const message = {
      email: data[0].email,
      data: []
    }

    data.forEach(d => message.data.push(d.enc))

    console.log(message)

    sendMail(message)


    commit("EXPORT_CLEAR")
    return resolve(true)

  })
  


}


// verify a signature
export function verify_quest_signature({state}, payload) {
  return new Promise((resolve, reject) => {
    if (payload === undefined || payload.cda === undefined || payload.hash === undefined) reject("invalid data")
    const isverified = verify(payload.cda, payload.hash)
    if (!isverified) reject('could not verify document')
    // else
    resolve('document is valid')
  })
}

export function storage_update({state}, payload) {
  state.STORAGE.update(payload)
}

export function storage_load({state}) {
  state.STORAGE.load()
}

export function storage_save({state}) {
  state.STORAGE.save()
}

export function storage_clear({state}) {
  state.STORAGE.clear()
}

export function storage_export({state}, payload) {

  console.log('action: storage_export', payload)
  if (Platform.is.cordova ) return state.STORAGE.export_cordova(payload, {email: state.SETTINGS.email_export, subject: state.TEXT.email.subject, body: state.TEXT.email.body, export_format: state.SETTINGS.export_format})
  if (Platform.is.desktop || Platform.is.ios) return state.STORAGE.export_tofile(payload, {export_format: state.SETTINGS.export_format})
}

export function storage_export_notion({state}, uid) {
  const payload = {
    uid: uid,
    token: state.SETTINGS.notion_token,
    db: state.SETTINGS.notion_db
  }
  
  return state.STORAGE.export_notion(payload)
}

// SPACE INVADERS ACTIONS
export function si_initGame({commit}, payload) {
  commit('SI_INIT_GAME', payload);
}

export function si_movePlayer({commit}, direction) {
  commit('SI_MOVE_PLAYER', direction);
}

export function si_setPlayerX({commit}, x) {
  commit('SI_SET_PLAYER_X', x);
}

export function si_shoot({commit}) {
  commit('SI_SHOOT');
}

export function si_updateGame({commit, state}) {
  if (state.spaceInvaders.gameOver || state.spaceInvaders.isPaused) return;
  
  // Update bullets
  commit('SI_UPDATE_BULLETS');
  commit('SI_UPDATE_ENEMY_BULLETS');
  
  // Check collisions
  commit('SI_CHECK_COLLISIONS');
}

export function si_moveEnemies({commit, state}) {
  if (state.spaceInvaders.gameOver || state.spaceInvaders.isPaused) return;
  
  const enemies = state.spaceInvaders.enemies;
  const currentDirection = state.spaceInvaders.enemyDirection;
  let shouldMoveDown = false;
  let newDirection = currentDirection;
  
  // Check if any enemy will hit the edge in the NEXT move
  const aliveEnemies = enemies.filter(e => e.alive);
  if (aliveEnemies.length > 0) {
    const rightmost = Math.max(...aliveEnemies.map(e => e.x + e.width));
    const leftmost = Math.min(...aliveEnemies.map(e => e.x));
    
    // Check if moving in current direction would hit edge
    if (currentDirection > 0 && rightmost + 10 >= 320) {
      // Moving right and would hit right edge
      shouldMoveDown = true;
      newDirection = -1; // Next time move left
    } else if (currentDirection < 0 && leftmost - 10 <= 0) {
      // Moving left and would hit left edge
      shouldMoveDown = true;
      newDirection = 1; // Next time move right
    }
  }
  
  commit('SI_MOVE_ENEMIES', { shouldMoveDown, newDirection });
}

export function si_enemyShoot({commit, state}) {
  if (state.spaceInvaders.gameOver || state.spaceInvaders.isPaused) return;
  
  const aliveEnemies = state.spaceInvaders.enemies.filter(e => e.alive);
  if (aliveEnemies.length > 0 && Math.random() < 0.02) {
    const randomEnemy = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
    commit('SI_ENEMY_SHOOT', randomEnemy);
  }
}

export function si_togglePause({commit}) {
  commit('SI_TOGGLE_PAUSE');
}

export function si_resetGame({commit}, payload) {
  commit('SI_RESET_GAME', payload);
}

export function si_nextLevel({commit}, payload) {
  commit('SI_NEXT_LEVEL', payload);
}

export function si_checkLevelComplete({state}) {
  const aliveEnemies = state.spaceInvaders.enemies.filter(e => e.alive);
  return aliveEnemies.length === 0 && !state.spaceInvaders.gameOver;
}

export function si_respawnPlayer({commit}, payload) {
  commit('SI_RESPAWN_PLAYER', payload);
}
