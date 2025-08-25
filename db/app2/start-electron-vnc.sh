#!/bin/bash

echo "🧹 Cleaning up previous instances..."
# Kill only x11vnc processes
pgrep -f 'x11vnc' | xargs -r kill 2>/dev/null
# Kill only electron dist processes
pgrep -f 'electron/dist/electron' | xargs -r kill 2>/dev/null
# Kill old Xvfb processes
pgrep -f 'Xvfb :99' | xargs -r kill 2>/dev/null

echo "⏳ Waiting for processes to terminate..."
sleep 2

echo "🚀 Starting Electron with VNC..."
DISPLAY=:99 ELECTRON_DISABLE_SECURITY_WARNINGS=true xvfb-run -a --server-args="-screen 0 1600x900x24 -ac -nolisten tcp -dpi 96 +extension GLX" sh -c '
    # Start VNC server
    x11vnc -display :99 -bg -forever -nopw -quiet -listen localhost -xkb &
    
    # Wait for VNC to start
    sleep 2
    
    echo "✅ VNC server started on localhost:5900"
    
    # Start Quasar in Electron mode
    echo "🚀 Starting Electron application..."
    exec quasar dev -m electron
'
