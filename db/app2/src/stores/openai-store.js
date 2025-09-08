import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import OpenAI from 'openai'
import { useLocalSettingsStore } from './local-settings-store'

export const useOpenAIStore = defineStore('openai', () => {
  const localSettingsStore = useLocalSettingsStore()

  // Reactive state
  const isLoading = ref(false)
  const lastResponse = ref(null)
  const error = ref(null)

  // Computed properties
  const hasApiKey = computed(() => localSettingsStore.hasOpenAIApiKey())
  const apiKey = computed(() => localSettingsStore.getOpenAIApiKey())

  // Get OpenAI client instance
  const getClient = () => {
    if (!hasApiKey.value) {
      throw new Error('OpenAI API key not configured. Please set it in Settings.')
    }

    return new OpenAI({
      apiKey: apiKey.value,
      dangerouslyAllowBrowser: true // Allow browser usage (for development)
    })
  }

  // Send a prompt to GPT-3.5-turbo
  const sendPrompt = async (prompt, options = {}) => {
    if (!hasApiKey.value) {
      throw new Error('OpenAI API key not configured. Please set it in Settings.')
    }

    isLoading.value = true
    error.value = null

    try {
      const client = getClient()

      const completion = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: options.maxTokens || 500,
        temperature: options.temperature || 0.7,
        ...options
      })

      const response = completion.choices[0]?.message?.content || 'No response received'
      lastResponse.value = response

      return response
    } catch (err) {
      console.error('OpenAI API error:', err)
      error.value = err.message || 'Failed to get response from OpenAI'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Clear last response and error
  const clearResponse = () => {
    lastResponse.value = null
    error.value = null
  }

  // Get status information
  const getStatus = () => {
    return {
      hasApiKey: hasApiKey.value,
      isLoading: isLoading.value,
      hasError: !!error.value,
      lastResponse: lastResponse.value,
      error: error.value
    }
  }

  return {
    // State
    isLoading,
    lastResponse,
    error,

    // Computed
    hasApiKey,
    apiKey,

    // Methods
    sendPrompt,
    clearResponse,
    getStatus,
    getClient
  }
})
