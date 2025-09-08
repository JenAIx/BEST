/**
 * Notes Plugin for SmartButton
 * Example plugin for taking quick notes
 */

import NotesWidget from '../NotesWidget.vue'

const NotesPlugin = {
  id: 'notes',
  name: 'Quick Notes',
  icon: 'note_add',
  color: 'secondary',
  tooltip: 'Quick Notes',
  component: NotesWidget,
  config: {
    persistent: false,
    maxWidth: '500px'
  }
}

export default NotesPlugin
