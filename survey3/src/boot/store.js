import { boot } from 'quasar/wrappers'
import { createStore } from 'vuex'
import { Notify } from 'quasar'

import state from '../store/state'
import * as getters from '../store/getters'
import * as mutations from '../store/mutations'
import * as actions from '../store/actions'
import spaceInvaders from '../store/spaceInvaders'

Notify.setDefaults({ timeout: 250 })

const store = createStore({
  state,
  getters,
  mutations,
  actions,
  modules: {
    spaceInvaders
  }
})

export default boot(({ app }) => {
  app.use(store)
})

export { store }
