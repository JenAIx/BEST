/**
 * Rewrite Plugin for SmartButton
 * Uses OpenAI to rewrite selected text or user-provided text
 */

import RewritePluginWidget from '../RewritePlugin.vue'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'

const RewritePlugin = {
  id: 'rewrite',
  name: 'Rewrite',
  icon: 'edit',
  color: 'teal',
  tooltip: 'Rewrite selected text',
  component: RewritePluginWidget,
  config: {
    minWidth: '600px',
    maxWidth: '800px',
    persistent: false
  },
  // Disable if OpenAI key missing
  isDisabled: () => {
    try {
      const localSettingsStore = useLocalSettingsStore()
      return !localSettingsStore.hasOpenAIApiKey()
    } catch {
      return true
    }
  },
  disabledReason: () => 'OpenAI API key not configured. Please set it in Settings → Local Settings.'
}

export default RewritePlugin


