<template>
  <q-page data-cy="page_index" class="page-size">
    <div class="column items-center justify-around" style="height: 100%">

      <!-- STATS -->
      <div class="col-auto q-pt-lg">
        <div class="row q-gutter-sm justify-center">
          <div class="idx-stat-card" @click="$router.push('select')">
            <div class="idx-stat-value">{{ questCount }}</div>
            <div class="idx-stat-label">{{ $t('index.stat_quests') }}</div>
          </div>
          <div class="idx-stat-card" @click="$router.push('storage')">
            <div class="idx-stat-value">{{ storageCount }}</div>
            <div class="idx-stat-label">{{ $t('index.stat_stored') }}</div>
          </div>
          <div class="idx-stat-card" @click="$router.push('store_preset')">
            <div class="idx-stat-value">{{ presetCount }}</div>
            <div class="idx-stat-label">{{ $t('index.stat_presets') }}</div>
          </div>
          <div class="idx-stat-card" data-cy="stat_patients" @click="$router.push('patients')">
            <div class="idx-stat-value">{{ patientCount }}</div>
            <div class="idx-stat-label">{{ $t('index.stat_patients') }}</div>
          </div>
          <div class="idx-stat-card" v-if="openExports > 0" @click="$router.push('storage')">
            <div class="idx-stat-value text-warning">{{ openExports }}</div>
            <div class="idx-stat-label">{{ $t('index.stat_open_exports') }}</div>
          </div>
        </div>
      </div>

      <!-- QUESTS -->
      <div class="col-2">
          <q-item data-cy="btn_quest" clickable v-ripple class="my-btn-item q-my-sm" @click="mainStore.leftDrawerOpen = false, $router.push('select')">
            <q-item-section avatar>
              <q-icon name="summarize" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{$t('index.btn_select')}}</q-item-label>
              <q-item-label caption>{{$t('index.text_select')}}</q-item-label>
            </q-item-section>
          </q-item>
      </div>

      <!-- PRESETS -->
      <div class="col-2">
          <q-item data-cy="btn_presets" clickable v-ripple class="my-btn-item q-my-sm" @click="mainStore.leftDrawerOpen = false, $router.push('store_preset')">
            <q-item-section avatar>
              <q-icon name="archive" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{$t('index.btn_preset')}}</q-item-label>
              <q-item-label caption>{{$t('index.text_preset')}}</q-item-label>
            </q-item-section>
          </q-item>
      </div>

      <!-- PATIENTS & VISITS -->
      <div class="col-2">
          <q-item data-cy="btn_patients" clickable v-ripple class="my-btn-item q-my-sm" @click="mainStore.leftDrawerOpen = false, $router.push('patients')">
            <q-item-section avatar>
              <q-icon name="people" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{$t('index.btn_patients')}}</q-item-label>
              <q-item-label caption>{{$t('index.text_patients')}}</q-item-label>
            </q-item-section>
          </q-item>
      </div>

      <!-- LAST ACTIVITY -->
      <div v-if="lastEntry" class="col-auto q-pb-md">
        <div class="text-caption text-grey-6 text-center">
          {{ $t('index.last_entry') }}: {{ lastEntry }}
        </div>
      </div>

    </div>
  </q-page>
</template>

<script>
  import myMixins from 'src/mixins/modes'
  import { useMainStore } from 'src/stores/main'

  export default {
    name: 'PageIndex',
    mixins: [myMixins],
    setup() {
      return { mainStore: useMainStore() }
    },
    data() {
      return {}
    },
    computed: {
      questCount() {
        return this.mainStore.QUEST_LIST?.length || 0
      },
      storageCount() {
        const items = this.mainStore.STORAGE?.get()
        return items?.length || 0
      },
      presetCount() {
        const presets = this.mainStore.PRESET_STORE
        return presets?.length || 0
      },
      patientCount() {
        return this.mainStore.PATIENTS?.length || 0
      },
      openExports() {
        const items = this.mainStore.STORAGE?.get() || []
        return items.filter(i => !i.exported).length
      },
      lastEntry() {
        const items = this.mainStore.STORAGE?.get() || []
        if (items.length === 0) return null
        const sorted = [...items].sort((a, b) => {
          const da = a.info?.date || ''
          const db = b.info?.date || ''
          return da > db ? -1 : 1
        })
        const last = sorted[0]
        if (!last?.info) return null
        const title = last.info.title || last.info.label || ''
        const pid = last.cda?.subject?.display || last.info.PID || ''
        return `${title} (${pid})`
      }
    }
  }
</script>

<style scoped lang="sass">
.idx-stat-card
  background: $grey-2
  border-radius: 8px
  padding: 12px 20px
  text-align: center
  min-width: 80px
  cursor: pointer
  transition: background 0.15s
  &:hover
    background: $grey-3

.idx-stat-value
  font-size: 1.4rem
  font-weight: 700
  color: $primary
  line-height: 1.2

.idx-stat-label
  font-size: 0.7rem
  color: $grey-7
  margin-top: 2px
</style>
