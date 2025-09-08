# SmartButton Plugin System

The SmartButton is a movable FAB (Floating Action Button) that supports a plugin architecture for adding additional functionality.

## Features

- **Movable FAB**: Drag the button around the screen
- **Plugin System**: Easily add new functionality as plugins
- **Dynamic Registration**: Plugins are automatically registered and displayed
- **Configurable**: Each plugin can have its own configuration

## Usage

The SmartButton is automatically included in `PublicLayout.vue` and `GridLayout.vue`. It will appear as a movable FAB in the bottom-right corner.

## Plugin Architecture

### Creating a Plugin

To create a new plugin, create a new file in `src/components/smartbtn/plugins/`:

```javascript
// MyPlugin.js
import { ref } from 'vue'

const MyPlugin = {
  id: 'my-plugin',                    // Unique identifier
  name: 'My Plugin',                  // Display name
  icon: 'my_icon',                    // Quasar icon name
  color: 'primary',                   // FAB action color
  tooltip: 'My Plugin Tooltip',       // Tooltip text
  component: {                        // Vue component
    template: `<div>My Plugin Content</div>`,
    setup() {
      // Component logic here
      return {}
    }
  },
  config: {                           // Plugin configuration
    persistent: false,                // Dialog persistence
    maxWidth: '400px'                 // Dialog max width
  }
}

export default MyPlugin
```

### Registering a Plugin

Add your plugin to `src/components/smartbtn/plugins/index.js`:

```javascript
import MyPlugin from './MyPlugin.js'

// Register the plugin
pluginManager.register(MyPlugin)
```

### Plugin Configuration Options

- `id`: Unique identifier for the plugin
- `name`: Display name shown in the dialog header
- `icon`: Quasar icon name for the FAB action
- `color`: Color for the FAB action button
- `tooltip`: Tooltip text for the FAB action
- `component`: Vue component object with template and setup
- `config`: Additional configuration object
  - `persistent`: Whether the dialog should be persistent (default: false)
  - `maxWidth`: Maximum width of the dialog (default: '500px')
  - `minWidth`: Minimum width of the dialog (default: '300px')

## Built-in Plugins

### Calculator Plugin
- **ID**: `calc`
- **Icon**: `calculate`
- **Description**: A basic calculator with arithmetic operations

### Notes Plugin
- **ID**: `notes`
- **Icon**: `note_add`
- **Description**: Quick notes taking with save/delete functionality

## Plugin Manager API

The plugin manager provides the following methods:

```javascript
import { pluginManager } from 'src/components/smartbtn'

// Register a plugin
pluginManager.register(plugin)

// Unregister a plugin
pluginManager.unregister(pluginId)

// Get all plugins
const plugins = pluginManager.getPlugins()

// Get a specific plugin
const plugin = pluginManager.getPlugin(pluginId)

// Set active plugin
pluginManager.setActivePlugin(pluginId)

// Get active plugin
const activePlugin = pluginManager.getActivePlugin()

// Clear active plugin
pluginManager.clearActivePlugin()

// Check if plugin is active
const isActive = pluginManager.isActive(pluginId)
```

## Example: Adding a New Plugin

Here's a complete example of adding a new plugin:

1. Create the plugin file:

```javascript
// src/components/smartbtn/plugins/WeatherPlugin.js
import { ref } from 'vue'

const WeatherPlugin = {
  id: 'weather',
  name: 'Weather',
  icon: 'wb_sunny',
  color: 'orange',
  tooltip: 'Check Weather',
  component: {
    template: `
      <div class="weather-plugin">
        <div class="text-h6">Weather Information</div>
        <q-input v-model="city" label="City" class="q-mb-md" />
        <q-btn color="primary" label="Get Weather" @click="getWeather" />
        <div v-if="weather" class="q-mt-md">
          <div>Temperature: {{ weather.temp }}°C</div>
          <div>Description: {{ weather.description }}</div>
        </div>
      </div>
    `,
    setup() {
      const city = ref('')
      const weather = ref(null)

      const getWeather = () => {
        // Weather API logic here
        weather.value = {
          temp: 22,
          description: 'Sunny'
        }
      }

      return { city, weather, getWeather }
    }
  },
  config: {
    persistent: false,
    maxWidth: '400px'
  }
}

export default WeatherPlugin
```

2. Register the plugin:

```javascript
// src/components/smartbtn/plugins/index.js
import WeatherPlugin from './WeatherPlugin.js'

pluginManager.register(WeatherPlugin)
```

The plugin will automatically appear as a new FAB action and be available in the SmartButton.
