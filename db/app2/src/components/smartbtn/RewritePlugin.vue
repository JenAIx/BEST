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
        <q-select v-model="tone" :options="toneOptions" outlined dense :label="$t('smartButton.toneStyle')" emit-value map-options />
      </div>
      <div class="col-12 col-md-6">
        <q-select v-model="length" :options="lengthOptions" outlined dense :label="$t('smartButton.length')" emit-value map-options />
      </div>
    </div>

    <div class="row items-center q-gutter-sm q-mb-md">
      <q-btn :disable="!hasApiKey || isLoading || !canRewrite" :loading="isLoading" color="teal" icon="auto_fix_high" :label="$t('smartButton.rewrite')" @click="rewrite" />
      <q-btn flat color="grey-7" icon="content_copy" :label="$t('common.copy')" @click="copyOutput" />
      <q-space />
    </div>

    <q-separator />

    <div class="q-mt-md" style="position: relative">
      <q-input v-model="outputText" type="textarea" autogrow outlined dense :placeholder="$t('smartButton.rewrittenTextPlaceholder')" />
      <q-inner-loading :showing="isLoading">
        <q-spinner-dots color="teal" size="32px" />
      </q-inner-loading>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useNotify } from 'src/composables/useNotify'
import { useOpenAIStore } from 'src/stores/openai-store'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'

const notify = useNotify()
const ai = useOpenAIStore()
const localSettingsStore = useLocalSettingsStore()

// Define props to receive initial state
const props = defineProps({
  initialState: {
    type: Object,
    default: () => ({}),
  },
})

// Reactive state with initial values from props
const inputText = ref(props.initialState.inputText || '')
const outputText = ref(props.initialState.outputText || '')
const isLoading = computed(() => ai.isLoading)
const hasApiKey = computed(() => localSettingsStore.hasOpenAIApiKey())

const tone = ref(props.initialState.tone || 'clear')
const length = ref(props.initialState.length || 'concise')

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
  return inputText.value && inputText.value.trim().length > 0
})

// State management functions for minimize/expand
const getState = () => ({
  inputText: inputText.value,
  outputText: outputText.value,
  tone: tone.value,
  length: length.value,
})

// Expose getState function for external access
defineExpose({
  getState,
})

const buildPrompt = () => {
  const goals = [
    'CRITICAL: Maintain the EXACT same language as the original text. Do NOT translate, switch languages, or change the language in any way.',
    'Preserve all technical terms, proper nouns, medical terminology, and domain-specific vocabulary in their original form.',
    tone.value === 'clear' ? 'Make it clear, clinical, and unambiguous.' : tone.value === 'formal' ? 'Make it formal and professional.' : 'Make it friendly and approachable.',
    length.value === 'concise' ? 'Keep it concise.' : length.value === 'detailed' ? 'Provide enough detail without verbosity.' : 'Balance brevity and completeness.',
  ]

  return `Rewrite the following text. ${goals.join(' ')}

IMPORTANT: The rewritten text MUST be in the same language as the original text. If the original is in German, respond in German. If it's in French, respond in French. If it's in Spanish, respond in Spanish. Never switch to English unless the original text is already in English.

Original text:
"""
${inputText.value}
"""

Rewritten text (same language, same terminology):`
}

const rewrite = async () => {
  if (!canRewrite.value) return
  if (!hasApiKey.value) {
    notify.warning('Configure OpenAI API key first (Local Settings).')
    return
  }
  try {
    outputText.value = ''
    const prompt = buildPrompt()
    const result = await ai.sendPrompt(prompt)
    outputText.value = result
  } catch (e) {
    console.error('Rewrite failed:', e)
    notify.error('Rewrite failed')
  }
}

const copyOutput = async () => {
  try {
    if (!outputText.value) return
    await navigator.clipboard.writeText(outputText.value)
    notify.success('Copied')
  } catch (e) {
    console.error('Copy failed:', e)
    notify.error('Copy failed')
  }
}

onMounted(() => {
  // Only load selection if we don't have initial state (i.e., not restored from minimize)
  if (!props.initialState.inputText) {
    // Load selection into input on open
    const ctx = window.__smartRewriteContext
    if (ctx?.selectedText && ctx.selectedText.trim()) {
      inputText.value = ctx.selectedText
    }
  }
})
</script>

<style lang="scss" scoped>
.rewrite-plugin {
  min-width: 480px;
}
</style>
