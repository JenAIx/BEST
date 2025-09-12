import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useLocalSettingsStore } from './local-settings-store'
import { useLoggingStore } from 'src/stores/logging-store'
import OpenAI from 'openai'

/**
 * OpenAI Pinia store for managing AI interactions
 * Provides methods for sending prompts and managing chat conversations
 */
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
  
  /**
   * Creates and caches OpenAI client instance
   * @returns {OpenAI} OpenAI client configured for browser use
   * @throws {Error} When API key is not configured
   */
  const client = computed(() => {
    if (!hasApiKey.value) throw new Error('OpenAI API key not configured.')
    const createdClient = new OpenAI({ apiKey: apiKey.value, dangerouslyAllowBrowser: true })
    logger.debug('Created OpenAI client', { browserMode: true })
    return createdClient
  })

  /**
   * Extracts text content from OpenAI API response
   * @param {Object} response - OpenAI API response object
   * @returns {string} Extracted text content or empty string
   */
  const extractOutputText = (response) => {
    if (!response) {
      logger.warn('extractOutputText: null or undefined response')
      return ''
    }

    // Standard OpenAI chat completions response format
    const content = response?.choices?.[0]?.message?.content
    if (typeof content === 'string') {
      return content.trim()
    }

    // Legacy format fallback
    if (typeof response === 'string') {
      return response.trim()
    }

    logger.warn('extractOutputText: unexpected response format', { 
      responseType: typeof response,
      hasChoices: !!response?.choices,
      choicesLength: response?.choices?.length,
      firstChoiceContent: response?.choices?.[0]?.message?.content
    })

    return ''
  }

  /**
   * Creates a summary of the OpenAI API response for logging
   * @param {Object} response - OpenAI API response
   * @param {string} extractedText - Extracted text content
   * @returns {Object} Response summary object
   */
  const summarizeResponse = (response, extractedText) => {
    try {
      return {
        model: response?.model || 'unknown',
        choicesLength: Array.isArray(response?.choices) ? response.choices.length : 0,
        finishReason: response?.choices?.[0]?.finish_reason || 'unknown',
        usage: response?.usage || null,
        extractedPreview: (extractedText || '').slice(0, 120),
        hasUsage: !!response?.usage,
        tokensUsed: response?.usage?.total_tokens || 0
      }
    } catch (err) {
      logger.error('Failed to summarize response', err)
      return { error: 'summarize_failed', message: err.message }
    }
  }

  /**
   * Compacts message history to stay within token limits
   * Keeps recent messages and adds system summary if available
   * @param {Array} messages - Array of conversation messages
   * @returns {Array} Compacted messages array
   */
  const MAX_TURNS = 4
  const compactMessages = (messages) => {
    if (!Array.isArray(messages)) {
      logger.warn('compactMessages: messages is not an array', { messages })
      return []
    }
    
    const recent = messages.slice(-MAX_TURNS)
    const system = systemSummary.value
      ? [{ role: 'system', content: `Conversation summary:\n${systemSummary.value}` }]
      : []
    
    logger.debug('Compacted messages', {
      original: messages.length,
      compacted: recent.length,
      hasSystemSummary: !!systemSummary.value
    })
    
    return [...system, ...recent]
  }

  /**
   * Core function to send messages to OpenAI API
   * @param {Array} messages - Array of message objects
   * @param {Object} options - API options (model, max_tokens, etc.)
   * @returns {Promise<string>} Response text from AI
   * @throws {Error} When API call fails
   */
  const _sendToOpenAI = async (messages, options = {}) => {
    if (!hasApiKey.value) {
      throw new Error('OpenAI API key not configured.')
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Messages array is required and cannot be empty')
    }

    const startTimeMs = performance.now()
    const apiOptions = {
      model: 'gpt-3.5-turbo',
      max_tokens: 1500,
      temperature: 0.7,
      ...options
    }

    logger.info('OpenAI API call start', {
      model: apiOptions.model,
      messageCount: messages.length,
      maxTokens: apiOptions.max_tokens,
    })

    try {
      const response = await client.value.chat.completions.create({
        ...apiOptions,
        messages
      })
      
      const extracted = extractOutputText(response)
      const outputText = extracted || 'No response received'
      const durationMs = performance.now() - startTimeMs
      
      logger.success('OpenAI API call success', {
        durationMs: durationMs.toFixed(1),
        summary: summarizeResponse(response, extracted),
        responseLength: outputText.length,
      })
      
      lastResponse.value = outputText
      return outputText
      
    } catch (err) {
      const errorMessage = err.message || 'Failed to get response from OpenAI'
      logger.error('OpenAI API call failed', {
        error: err,
        message: errorMessage,
        model: apiOptions.model
      })
      error.value = errorMessage
      throw err
    }
  }

  /**
   * Send a single prompt to OpenAI
   * @param {string} prompt - User prompt text
   * @param {Object} options - API options
   * @returns {Promise<string>} AI response text
   */
  const sendPrompt = async (prompt, options = {}) => {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Prompt must be a non-empty string')
    }

    isLoading.value = true
    error.value = null

    try {
      const messages = [{ role: 'user', content: prompt.trim() }]
      return await _sendToOpenAI(messages, options)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Send a prompt with full conversation history to OpenAI
   * @param {Array} conversationMessages - Array of conversation messages
   * @param {Object} options - API options
   * @returns {Promise<string>} AI response text
   */
  const sendPromptWithHistory = async (conversationMessages, options = {}) => {
    if (!Array.isArray(conversationMessages) || conversationMessages.length === 0) {
      throw new Error('Messages array is required and cannot be empty')
    }

    isLoading.value = true
    error.value = null

    try {
      // Format and compact messages to stay within token limits
      const formattedMessages = conversationMessages.map(msg => ({
        role: msg.role || 'user',
        content: (msg.content || '').toString().trim()
      })).filter(msg => msg.content) // Remove empty messages
      
      const compactedMessages = compactMessages(formattedMessages)
      
      logger.debug('Sending prompt with history', {
        originalCount: conversationMessages.length,
        formattedCount: formattedMessages.length,
        compactedCount: compactedMessages.length
      })
      
      return await _sendToOpenAI(compactedMessages, options)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Clears the last response and any error state
   */
  const clearResponse = () => {
    lastResponse.value = null
    error.value = null
  }

  /**
   * Adds a message to the chat history
   * @param {Object} message - Message object with role, content, timestamp
   */
  const addMessage = (message) => {
    if (!message || !message.content) {
      logger.warn('addMessage: invalid message', { message })
      return
    }
    
    const formattedMessage = {
      role: message.role || 'user',
      content: message.content,
      timestamp: message.timestamp || new Date()
    }
    
    chatMessages.value.push(formattedMessage)
    logger.debug('Message added to chat', {
      role: formattedMessage.role,
      contentLength: formattedMessage.content.length,
      totalMessages: chatMessages.value.length
    })
  }

  /**
   * Clears all chat messages
   */
  const clearChatMessages = () => {
    const previousCount = chatMessages.value.length
    chatMessages.value = []
    logger.debug('Chat messages cleared', { previousCount })
  }

  /**
   * Gets all chat messages
   * @returns {Array} Array of chat messages
   */
  const getChatMessages = () => chatMessages.value

  /**
   * Gets current store status
   * @returns {Object} Status object with loading, error, and API key state
   */
  const getStatus = () => ({
    hasApiKey: hasApiKey.value,
    isLoading: isLoading.value,
    hasError: !!error.value,
    lastResponse: lastResponse.value,
    error: error.value,
    messageCount: chatMessages.value.length
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