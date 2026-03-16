import { createStore } from 'vuex'
import { store } from 'quasar/wrappers'
import { Notify } from 'quasar'

Notify.setDefaults({timeout: 250})

import state from './state'
import * as getters from './getters'
import * as mutations from './mutations'
import * as actions from './actions'
import spaceInvaders from './spaceInvaders'

export default store(function (/* { ssrContext } */) {
  const Store = createStore({
    state,
    getters,
    mutations,
    actions,
    modules: {
      spaceInvaders
    }
  })

  return Store
})
