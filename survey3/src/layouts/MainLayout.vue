<template>
  <q-layout view="lHh Lpr lFf" >
    <q-header  v-if="!mainStore.PROTECTED_MODE" class="bg-grey-2 " bordered >
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          color="black"
          icon="menu"
          aria-label="Menu"
          @click="mainStore.leftDrawerOpen = !mainStore.leftDrawerOpen"
          data-cy="main_drawer"
        />

        <q-toolbar-title @click="$router.push('/').catch(()=>{})" class="text-black">
          {{ $t('label') }}
        </q-toolbar-title>

        <div @click="$router.push('about').catch(()=>{})" class="text-grey-6"> {{ appVersion }}</div>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="mainStore.leftDrawerOpen"
      show-if-above
      bordered
      content-class="bg-grey-1"
    >

      <q-list>
        <q-item-label
          header
          class="text-grey-8"
        >
          <!-- Essential Links -->
        </q-item-label>
        <EssentialLink
          v-for="link in essentialLinks"
          :key="link.title"
          v-bind="link"
          :data-cy="'link_'+link.title"
        />

      </q-list>

      <div class="fixed-bottom text-center q-mb-xl" style="opacity: 0.5;">
        <q-img 
            src="assets/favicon.svg"
            style="height: 100px; width: 100px; "
            @click="mainStore.leftDrawerOpen = false, $router.push({name: 'about'}).catch(() => {})"
          />

      </div>

    </q-drawer>
    <q-page-container :class="bodysize">
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script>
import EssentialLink from 'components/EssentialLink.vue'
import { useMainStore } from 'src/stores/main'

export default {
  name: 'MainLayout',
  components: {
    EssentialLink
  },
  setup() {
    return { mainStore: useMainStore() }
  },
  mounted() {
    this.mainStore.leftDrawerOpen = false
  },
  data() {
    return {}
  },
  computed: {
    appVersion() {
      return `${process.env.APP_VERSION}-${process.env.APP_UPDATED}`
    },
    essentialLinks() {
      const links = [
        { key: 'start', icon: 'home', link: '/', name: 'start' },
        { key: 'select', icon: 'assignment', link: 'select', name: 'select' },
        { key: 'store_preset', icon: 'archive', link: 'store_preset', name: 'store_preset' },
        { key: 'storage', icon: 'inventory_2', link: 'storage', name: 'storage' },
        { key: 'separator' },
        { key: 'settings', icon: 'settings', link: 'settings', name: 'settings' },
        { key: 'about', icon: 'info', link: 'about', name: 'about' },
        { key: 'changelog', icon: 'update', link: 'changelog', name: 'changelog' },
      ]
      return links.map(l => {
        if (l.key === 'separator') return { title: 'separator' }
        return {
          title: this.$t(`nav.${l.key}.title`),
          caption: this.$t(`nav.${l.key}.caption`),
          icon: l.icon,
          link: l.link,
          name: l.name,
        }
      })
    },
    bodysize() {
      return {
        'body-normal': this.mainStore.SETTINGS.size === 'normal',
        'body-bigger': this.mainStore.SETTINGS.size === 'bigger',
        'body-biggest': this.mainStore.SETTINGS.size === 'biggest'
      }
    }
  }
}
</script>
