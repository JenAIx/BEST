// Geteilte Fragebogen-Auswahl-Helfer (Mixin, wie mixins/modes.js).
// Verwendet von Visit.vue und VisitTemplates.vue. Erwartet `this.mainStore`.
export default {
  data() {
    return { questFilter: null }
  },
  methods: {
    // Menschlicher Titel zu einem short_title (Fallback: der short_title selbst)
    questTitle(short_title) {
      const q = this.mainStore.QUESTMAN.get(short_title)
      return q && q.title ? q.title : short_title
    },
    // q-select @filter-Handler
    filterQuests(val, update) {
      update(() => {
        this.questFilter = val ? val.toLowerCase() : null
      })
    },
  },
}
