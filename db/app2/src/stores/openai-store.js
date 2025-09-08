import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useLocalSettingsStore } from './local-settings-store'
import OpenAI from 'openai'

// Optimized OpenAI Pinia store
export const useOpenAIStore = defineStore('openai', () => {
  const localSettingsStore = useLocalSettingsStore()

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
    return new OpenAI({ apiKey: apiKey.value, dangerouslyAllowBrowser: true })
  })

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
      const response = await client.value.responses.create({
        model: 'gpt-5-mini',
        input: prompt,
        max_output_tokens: 256,
        ...options,
      })
      const outputText = response.output_text || 'No response received'
      lastResponse.value = outputText
      return outputText
    } catch (err) {
      console.error('OpenAI API error:', err)
      error.value = err.message || 'Failed to get response from OpenAI'
      throw err
    } finally {
      isLoading.value = false
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
      const response = await client.value.responses.create({
        model: 'gpt-5-mini',
        input: formattedInput,
        max_output_tokens: 256,
        ...options,
      })
      const outputText = response.output_text || 'No response received'
      lastResponse.value = outputText
      return outputText
    } catch (err) {
      console.error('OpenAI API error with history:', err)
      error.value = err.message || 'Failed to get response from OpenAI'
      throw err
    } finally {
      isLoading.value = false
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