/**
 * Dialog Manager Composable
 * 
 * Provides centralized dialog state management to reduce boilerplate
 * Manages multiple dialog visibility states with a clean API
 */

import { ref } from 'vue'

/**
 * Composable for managing multiple dialog states
 * @param {Array<string>} dialogNames - Array of dialog names to manage
 * @returns {Object} Dialog state and control methods
 */
export function useDialogManager(dialogNames = []) {
  // Initialize dialog states
  const dialogs = ref({})
  
  dialogNames.forEach((name) => {
    dialogs.value[name] = ref(false)
  })

  /**
   * Open a dialog by name
   * @param {string} name - Dialog name
   */
  const open = (name) => {
    if (dialogs.value[name]) {
      dialogs.value[name].value = true
    }
  }

  /**
   * Close a dialog by name
   * @param {string} name - Dialog name
   */
  const close = (name) => {
    if (dialogs.value[name]) {
      dialogs.value[name].value = false
    }
  }

  /**
   * Toggle a dialog by name
   * @param {string} name - Dialog name
   */
  const toggle = (name) => {
    if (dialogs.value[name]) {
      dialogs.value[name].value = !dialogs.value[name].value
    }
  }

  /**
   * Check if a dialog is open
   * @param {string} name - Dialog name
   * @returns {boolean} True if dialog is open
   */
  const isOpen = (name) => {
    return dialogs.value[name]?.value || false
  }

  /**
   * Close all dialogs
   */
  const closeAll = () => {
    Object.keys(dialogs.value).forEach((name) => {
      dialogs.value[name].value = false
    })
  }

  /**
   * Get ref for a specific dialog (for v-model binding)
   * @param {string} name - Dialog name
   * @returns {Ref<boolean>} Ref for the dialog state
   */
  const dialogModel = (name) => {
    // Ensure the dialog exists (should already be initialized, but just in case)
    if (!dialogs.value[name]) {
      dialogs.value[name] = ref(false)
    }
    // Return the ref directly - v-model works with refs
    return dialogs.value[name]
  }

  return {
    // State
    dialogs,

    // Methods
    open,
    close,
    toggle,
    isOpen,
    closeAll,
    dialogModel,
  }
}

