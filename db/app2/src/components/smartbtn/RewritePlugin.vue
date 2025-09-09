<template>
  <div class="rewrite-plugin">
    <q-banner v-if="!hasApiKey" class="q-mb-md bg-orange-2 text-orange-10" rounded>
      <div class="row items-center">
        <q-icon name="warning" class="q-mr-sm" />
        <div>OpenAI API key not configured. Set it in Local Settings to enable rewriting.</div>
      </div>
    </q-banner>
    <div class="q-mb-md">
      <q-input v-model="inputText" type="textarea" autogrow outlined dense :placeholder="placeholder" />
      <div class="q-mt-xs text-grey-7 text-caption">
        {{ contextInfo }}
      </div>
    </div>

    <div class="row q-col-gutter-sm q-mb-md">
      <div class="col-12 col-md-6">
        <q-select v-model="tone" :options="toneOptions" outlined dense label="Tone/Style" emit-value map-options />
      </div>
      <div class="col-12 col-md-6">
        <q-select v-model="length" :options="lengthOptions" outlined dense label="Length" emit-value map-options />
      </div>
    </div>

    <div class="row items-center q-gutter-sm q-mb-md">
      <q-btn :disable="!hasApiKey || isLoading || !canRewrite" :loading="isLoading" color="teal" icon="auto_fix_high" label="Rewrite" @click="rewrite" />
      <q-btn flat color="grey-7" icon="content_copy" label="Copy" @click="copyOutput" />
      <q-space />
    </div>

    <q-separator />

    <div class="q-mt-md" style="position: relative;">
      <q-input v-model="outputText" type="textarea" autogrow outlined dense placeholder="Rewritten text will appear here" />
      <q-inner-loading :showing="isLoading">
        <q-spinner-dots color="teal" size="32px" />
      </q-inner-loading>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useOpenAIStore } from 'src/stores/openai-store'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'

const $q = useQuasar()
const ai = useOpenAIStore()
const localSettingsStore = useLocalSettingsStore()

const inputText = ref('')
const outputText = ref('')
const isLoading = computed(() => ai.isLoading)
const hasApiKey = computed(() => localSettingsStore.hasOpenAIApiKey())

const tone = ref('clear')
const length = ref('concise')

const toneOptions = [
  { label: 'Clear and clinical', value: 'clear' },
  { label: 'Formal', value: 'formal' },
  { label: 'Friendly', value: 'friendly' },
]

const lengthOptions = [
  { label: 'Concise', value: 'concise' },
  { label: 'Moderate', value: 'moderate' },
  { label: 'Detailed', value: 'detailed' },
]

const placeholder = computed(() => 'Enter or paste text to rewrite')

const contextInfo = computed(() => {
  const ctx = window.__smartRewriteContext
  if (ctx?.selectedText) {
    return `Loaded selection (${ctx.selectedText.length} chars)${ctx.isEditable ? ' from an editable field' : ''}`
  }
  return 'No selection found. Enter text to rewrite.'
})

const canRewrite = computed(() => {
  return (inputText.value && inputText.value.trim().length > 0)
})

const buildPrompt = () => {
  const goals = [
    tone.value === 'clear' ? 'Make it clear, clinical, and unambiguous.' :
    tone.value === 'formal' ? 'Make it formal and professional.' :
    'Make it friendly and approachable.',
    length.value === 'concise' ? 'Keep it concise.' : length.value === 'detailed' ? 'Provide enough detail without verbosity.' : 'Balance brevity and completeness.'
  ]

  return `Rewrite the following text and keep the original language. ${goals.join(' ')}
Text:
"""
${inputText.value}
"""`
}

const rewrite = async () => {
  if (!canRewrite.value) return
  if (!hasApiKey.value) {
    $q.notify({ type: 'warning', message: 'Configure OpenAI API key first (Local Settings).', position: 'top' })
    return
  }
  try {
    outputText.value = ''
    const prompt = buildPrompt()
    const result = await ai.sendPrompt(prompt)
    outputText.value = result
  } catch (e) {
    console.error('Rewrite failed:', e)
    $q.notify({ type: 'negative', message: 'Rewrite failed', position: 'top' })
  }
}


const copyOutput = async () => {
  try {
    if (!outputText.value) return
    await navigator.clipboard.writeText(outputText.value)
    $q.notify({ type: 'positive', message: 'Copied', position: 'top' })
  } catch (e) {
    console.error('Copy failed:', e)
    $q.notify({ type: 'negative', message: 'Copy failed', position: 'top' })
  }
}

onMounted(() => {
  // Load selection into input on open
  const ctx = window.__smartRewriteContext
  if (ctx?.selectedText && ctx.selectedText.trim()) {
    inputText.value = ctx.selectedText
  } else {
    inputText.value = ''
  }
})
</script>

<style lang="scss" scoped>
.rewrite-plugin {
  min-width: 480px;
}
</style>


