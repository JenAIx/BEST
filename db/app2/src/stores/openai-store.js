import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useLocalSettingsStore } from './local-settings-store'
import { useLoggingStore } from 'src/stores/logging-store'
import OpenAI from 'openai'

// Optimized OpenAI Pinia store
export const useOpenAIStore = defineStore('openai', () => {
  const localSettingsStore = useLocalSettingsStore()
  const loggingStore = useLoggingStore()
  const logger = loggingStore.createLogger('OpenAIStore')

  // Reactive state
  const isLoading = ref(false)
  const lastResponse = ref(null)
  const error = ref(null)
  const chatMessages = ref([])
  const systemSummary = ref('') // rolling conversation summary

  // Computed properties
  const hasApiKey = computed(() => localSettingsStore.hasOpenAIApiKey())
  const apiKey = computed(() => localSettingsStore.getOpenAIApiKey())
  const client = computed(() => {
    if (!hasApiKey.value) throw new Error('OpenAI API key not configured.')
    const createdClient = new OpenAI({ apiKey: apiKey.value, dangerouslyAllowBrowser: true })
    logger.debug('Created OpenAI client', { browserMode: true })
    return createdClient
  })

  // Extract text from standard OpenAI Chat Completions API response
  const extractOutputText = (response) => {
    if (!response) return ''

    // Standard OpenAI chat completions response format
    if (response?.choices && Array.isArray(response.choices) && response.choices.length > 0) {
      const firstChoice = response.choices[0]
      if (firstChoice?.message?.content) {
        return firstChoice.message.content.trim()
      }
    }

    // Fallback to other possible formats
    const choiceText = response?.choices?.[0]?.message?.content || response?.choices?.[0]?.text
    if (typeof choiceText === 'string' && choiceText.trim()) return choiceText

    // Legacy format
    if (typeof response === 'string') return response

    logger.warn('extractOutputText: unexpected response format', { 
      responseType: typeof response,
      hasChoices: !!response?.choices,
      choicesLength: response?.choices?.length 
    })

    return ''
  }

  const summarizeResponse = (response, extractedText) => {
    try {
      return {
        model: response?.model || 'unknown',
        choicesLength: Array.isArray(response?.choices) ? response.choices.length : 0,
        finishReason: response?.choices?.[0]?.finish_reason || 'unknown',
        usage: response?.usage || null,
        extractedPreview: (extractedText || '').slice(0, 120),
      }
    } catch {
      return { error: 'summarize_failed' }
    }
  }

  // Utility to compact history
  const MAX_TURNS = 4
  const compactMessages = (messages) => {
    const recent = messages.slice(-MAX_TURNS)
    const system = systemSummary.value
      ? [{ role: 'system', content: `Conversation summary:\n${systemSummary.value}` }]
      : []
    return [...system, ...recent]
  }

  // Send a single prompt (streaming for faster UX)
  const sendPrompt = async (prompt, options = {}) => {
    if (!hasApiKey.value) throw new Error('OpenAI API key not configured.')

    isLoading.value = true
    error.value = null

    try {
      const startTimeMs = performance.now()
      logger.info('sendPrompt: start', {
        model: options?.model || 'gpt-3.5-turbo',
        promptLength: String(prompt ?? '').length,
        maxTokens: options?.max_tokens || 256,
      })
      // Use the standard OpenAI chat completions API
      const response = await client.value.chat.completions.create({
        model: 'gpt-3.5-turbo', // Use a standard model
        messages: [
          { role: 'user', content: String(prompt ?? '') }
        ],
        max_tokens: 256,
        temperature: 0.7,
        ...options,
      })
      const extracted = extractOutputText(response)
      const outputText = extracted && extracted.trim().length > 0 ? extracted : 'No response received'
      const durationMs = performance.now() - startTimeMs
      logger.success('sendPrompt: success', {
        durationMs: durationMs.toFixed(1),
        summary: summarizeResponse(response, extracted),
        returnedTextLength: (outputText || '').length,
        emptyFallbackUsed: !(extracted && extracted.trim().length > 0),
      })
      lastResponse.value = outputText
      return outputText
    } catch (err) {
      console.error('OpenAI API error:', err)
      logger.error('sendPrompt: error', err)
      error.value = err.message || 'Failed to get response from OpenAI'
      throw err
    } finally {
      isLoading.value = false
      logger.debug('sendPrompt: finished')
    }
  }

  // Send a prompt with conversation history (streaming for faster UX)
  const sendPromptWithHistory = async (conversationMessages, options = {}) => {
    if (!hasApiKey.value) throw new Error('OpenAI API key not configured.')
    if (!Array.isArray(conversationMessages) || conversationMessages.length === 0) {
      throw new Error('Messages array is required and cannot be empty')
    }

    isLoading.value = true
    error.value = null

    const formattedInput = compactMessages(
      conversationMessages.map(msg => ({
        role: msg.role || 'user',
        content: msg.content || ''
      }))
    )

    try {
      const startTimeMs = performance.now()
      logger.info('sendPromptWithHistory: start', {
        model: options?.model || 'gpt-3.5-turbo',
        turns: formattedInput.length,
        maxTokens: options?.max_tokens || 256,
      })
      // Use the standard OpenAI chat completions API
      const response = await client.value.chat.completions.create({
        model: 'gpt-3.5-turbo', // Use a standard model
        messages: formattedInput,
        max_tokens: 256,
        temperature: 0.7,
        ...options,
      })
      const extracted = extractOutputText(response)
      const outputText = extracted && extracted.trim().length > 0 ? extracted : 'No response received'
      const durationMs = performance.now() - startTimeMs
      logger.success('sendPromptWithHistory: success', {
        durationMs: durationMs.toFixed(1),
        summary: summarizeResponse(response, extracted),
        returnedTextLength: (outputText || '').length,
        emptyFallbackUsed: !(extracted && extracted.trim().length > 0),
      })
      lastResponse.value = outputText
      return outputText
    } catch (err) {
      console.error('OpenAI API error with history:', err)
      logger.error('sendPromptWithHistory: error', err)
      error.value = err.message || 'Failed to get response from OpenAI'
      throw err
    } finally {
      isLoading.value = false
      logger.debug('sendPromptWithHistory: finished')
    }
  }

  // Clear response and error
  const clearResponse = () => {
    lastResponse.value = null
    error.value = null
  }

  // Chat message management
  const addMessage = (message) => {
    chatMessages.value.push({
      ...message,
      timestamp: message.timestamp || new Date()
    })
  }

  const clearChatMessages = () => {
    chatMessages.value = []
  }

  const getChatMessages = () => chatMessages.value

  // Get status information
  const getStatus = () => ({
    hasApiKey: hasApiKey.value,
    isLoading: isLoading.value,
    hasError: !!error.value,
    lastResponse: lastResponse.value,
    error: error.value
  })

  return {
    // State
    isLoading,
    lastResponse,
    error,
    chatMessages,
    systemSummary,

    // Computed
    hasApiKey,
    apiKey,
    client,

    // Methods
    sendPrompt,
    sendPromptWithHistory,
    clearResponse,
    getStatus,
    addMessage,
    clearChatMessages,
    getChatMessages,
  }
})