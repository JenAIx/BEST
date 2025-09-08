/**
 * Ask AI Plugin for SmartButton
 * Provides AI chat functionality using OpenAI GPT-3.5-turbo
 */

import AskAIWidget from '../AskAIWidget.vue'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'

const localSettingsStore = useLocalSettingsStore()

const AskAIPlugin = {
  id: 'ask-ai',
  name: 'Ask AI',
  icon: 'smart_toy',
  color: 'accent',
  tooltip: 'Ask AI Assistant', // Will be overridden dynamically
  component: AskAIWidget,
  config: {
    minWidth: '500px',
    maxWidth: '600px',
    persistent: false
  },
  // Check if plugin should be disabled
  isDisabled: () => !localSettingsStore.hasOpenAIApiKey(),
  // Get disabled reason
  disabledReason: () => 'OpenAI API key not configured. Please set it in Settings → Local Settings.'
}

export default AskAIPlugin
