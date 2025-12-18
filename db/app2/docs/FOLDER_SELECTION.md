# Universal Folder Selection Tool

## Overview
The BEST Medical System now includes a universal, cross-platform folder selection tool for configuring custom database paths. This feature works seamlessly on Windows, Linux, and macOS.

## Features

### Cross-Platform Compatibility
- **Windows**: Native folder dialog with Windows Explorer integration
- **Linux**: Native folder dialog with file manager integration
- **macOS**: Native folder dialog with Finder integration

### Smart Default Paths
The folder selection dialog intelligently determines the best starting location:

1. **Previously Selected Path**: If you've already selected a custom folder, it starts there
2. **Current Database Path**: If a custom path is already configured for the selected database, it starts from that location
3. **Default Database Folder**: If the `./database/` folder exists, it opens there
4. **App Directory**: Otherwise, it defaults to the application's installation directory

### User Interface

#### Database Selection
On the login page, you can select from three pre-configured databases:
- Production Database (`production.db`)
- Development Database (`development.db`)
- Demo Database (`demo.db`)

#### Folder Configuration
1. Click the **three-dot menu icon (⋮)** next to any database in the dropdown
2. The "Configure Database Folder" dialog opens
3. Click the **folder icon** ("Ordner durchsuchen" / "Browse folder") button
4. Select your desired folder in the native OS dialog
5. Click **Save** to apply the custom path

#### Visual Feedback
- The selected path is displayed in the input field
- A success notification confirms the folder selection
- The current custom path and full database path are shown below the input

### Technical Implementation

#### Electron Integration
The folder selection uses Electron's native dialog API:

```javascript
// Preload Script (electron-preload.js)
contextBridge.exposeInMainWorld('electron', {
  dialog: {
    showOpenDialog: (options) => ipcRenderer.invoke('dialog:openDirectory', options),
  },
  appPath: process.cwd(),
  platform: os.platform(),
  // ... other APIs
})
```

#### IPC Handler (electron-main.js)
```javascript
ipcMain.handle('dialog:openDirectory', async (event, options) => {
  const dialogOptions = {
    properties: ['openDirectory'],
    title: 'Select Folder',
    defaultPath: options?.defaultPath || app.getPath('userData'),
    ...options,
  }
  return await dialog.showOpenDialog(mainWindow, dialogOptions)
})
```

#### Frontend Usage (LoginPage.vue)
```javascript
const selectCustomFolder = async () => {
  // Determine best default path
  let defaultPath = window.electron.appPath || window.electron.homedir
  
  // Show native folder dialog
  const result = await window.electron.dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Database Folder',
    defaultPath: defaultPath,
    buttonLabel: 'Select Folder',
  })
  
  if (!result.canceled && result.filePaths?.length > 0) {
    customFolderPath.value = result.filePaths[0]
  }
}
```

### Path Storage
Custom database paths are stored in localStorage using the `useLocalSettingsStore`:

```javascript
// Set custom path
localSettingsStore.setDatabaseCustomPath('production', '/path/to/custom/folder')

// Get custom path
const customPath = localSettingsStore.getDatabaseCustomPath('production')

// Build full database path
const fullPath = localSettingsStore.buildDatabasePath('production', 'production.db')
// Result: /path/to/custom/folder/production.db
```

### Fallback Behavior
If running in a web browser (non-Electron environment):
- The native dialog is not available
- Users are prompted to enter the path manually
- A notification informs them of the manual entry requirement

## Usage Instructions

### For End Users
1. **Launch the application**
2. **On the login page**, look for the database dropdown
3. **Click the ⋮ icon** next to your desired database
4. **Click the folder icon** in the dialog that appears
5. **Navigate** to your desired folder in the file browser
6. **Select** the folder and confirm
7. **Save** the configuration

### For Developers
To add folder selection to other parts of the app:

```javascript
// In your component
const selectFolder = async () => {
  if (window.electron?.dialog) {
    const result = await window.electron.dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Your Folder',
      defaultPath: '/your/default/path',
    })
    
    if (!result.canceled) {
      const selectedPath = result.filePaths[0]
      // Use the selected path
    }
  }
}
```

## Platform-Specific Notes

### Windows
- Paths use backslashes: `C:\Users\YourName\Documents\database`
- UNC network paths are supported: `\\server\share\database`
- Drive letters are automatically resolved

### Linux
- Paths use forward slashes: `/home/username/database`
- Hidden folders (starting with `.`) are accessible
- Symlinks are resolved automatically

### macOS
- Paths use forward slashes: `/Users/YourName/Documents/database`
- Application sandboxing is handled automatically
- iCloud and network drives are supported

## Security Considerations

- Custom paths are stored in localStorage (per-browser, not encrypted)
- The application validates path existence before connecting
- Database files are created automatically if they don't exist
- Parent directories are created recursively if needed

## Troubleshooting

### Dialog doesn't appear
- **Cause**: Running in web browser mode
- **Solution**: Run the Electron application

### Can't access certain folders
- **Windows**: Check folder permissions
- **Linux/macOS**: Ensure read/write permissions (`chmod` if needed)
- **macOS**: May need to grant accessibility permissions in System Preferences

### Path doesn't save
- **Cause**: localStorage quota exceeded or disabled
- **Solution**: Clear browser cache or check localStorage settings

## Future Enhancements
- [ ] Recent folders history
- [ ] Folder validation before saving
- [ ] Network path testing
- [ ] Folder creation dialog
- [ ] Path suggestions based on common locations

