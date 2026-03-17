<template>
  <div>
    <div class="column q-mt-lg">
      <div class="row">
        <div class="col">
          <!-- EMPTY -->
        </div>
        <div class="col-2 row" :class="{'col-10': ITEM.verylonganswers === true, 'col-8':  answers_only.length > 6,'col-6': ITEM.longanswers === true ||answers_only.length > 4, 'col-4': answers_only.length > 2}">
          <div class="col text-caption text-center q-mb-sm " :class="{'rotate-text': ITEM.rotate !== false, 'narrow-text': ITEM.rotate === false}"
            v-for="(answ, indansw) in answers_only" :key="indansw + 'answersonly'">
            {{answ}}
          </div>
        </div>
      </div>
      <!-- QUESTIONS -->
      <div class="row" v-for="(question, index) in ITEM.options.questions" :key="'item.tag' + question.tag">
        <div class="col q-mt-sm" >
          <span v-html="question.label"></span>
          <!-- {{question.label}} -->
        </div>
        <div class="col-2 row text-center q-mt-sm"
          :class="{'col-10': ITEM.verylonganswers === true, 'col-8': answers_only.length > 6,'col-6': ITEM.longanswers === true ||answers_only.length > 4, 'col-4': answers_only.length > 2}">

          <div class="col" v-for="(sa, indsa) in short_answers" :key="indsa + 'shortans'">

            <q-radio :model-value="val[index]" :val="sa.value" @update:model-value="onRadioChange(index, $event)">
               <q-tooltip anchor="top middle" self="center middle"> {{answers_only[indsa]}}</q-tooltip>
            </q-radio>
          </div>
        </div>
      </div>
    </div>
  </div>

</template>

<script>

export default {
  name: 'RenderMultipleRadio',
  props: ["ITEM"],
  computed: {
    val: {
      get() {
        if (this.ITEM.example_value) return this.ITEM.example_value
        if (this.ITEM.value && this.ITEM.value.length > 0) return this.ITEM.value
        return new Array(this.ITEM.options.questions.length).fill(null)
      },
      set(v) { this.$emit('emitValue', v) }
    },
    short_answers() {
      var out = [];
      this.ITEM.options.answers.forEach(v => {
        out.push({'label': '', "value": v.value})
      })
      return out
    },
    answers_only() {
      var out = [];
      this.ITEM.options.answers.forEach(v => {
        out.push(v.label)
      })
      return out
    }
  },
  methods: {
    onRadioChange(index, value) {
      const updated = [...this.val]
      updated[index] = value
      this.$emit('emitValue', updated)
    }
  }
}
</script>
