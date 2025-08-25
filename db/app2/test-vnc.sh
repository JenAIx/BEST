#!/bin/bash

# Kill any existing processes
pkill -f "x11vnc" 2>/dev/null
pkill -f "xvfb" 2>/dev/null

echo "🧪 Testing VNC with simple window..."

# Start Xvfb and VNC with a simple test window
DISPLAY=:99 xvfb-run -a --server-args="-screen 0 1024x768x24 -ac -nolisten tcp -dpi 96" sh -c '
    # Start VNC server
    x11vnc -display :99 -bg -forever -nopw -quiet -listen localhost -xkb &
    
    # Wait a moment for VNC to start
    sleep 2
    
    # Create a simple test window using xmessage
    echo "Creating test window..."
    xmessage -geometry 400x200+100+100 -bg white -fg black "VNC Test Window - If you can see this, VNC is working!" &
    
    # Keep the script running
    echo "VNC server running on localhost:5900"
    echo "Test window should be visible"
    echo "Press Ctrl+C to stop"
    
    # Wait indefinitely
    while true; do
        sleep 10
        echo "VNC still running... ($(date))"
    done
'
