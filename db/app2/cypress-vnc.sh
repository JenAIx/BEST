#!/bin/bash
set +e

echo "🖥️ Starting Cypress in VNC Mode for Interactive Testing"

# Ensure cypress directories exist
mkdir -p tests/cypress/{e2e,fixtures,support,videos,screenshots}

echo "🧹 Cleaning up any existing VNC processes on port 5901..."
pkill -f 'x11vnc.*5901' 2>/dev/null || true
pkill -f 'Xvfb.*:98' 2>/dev/null || true
sleep 2

echo "🚀 Starting VNC-accessible Cypress environment..."

# Use a specific display number to avoid conflicts
ELECTRON_DISABLE_SECURITY_WARNINGS=true xvfb-run -s "-screen 0 1600x900x24 -ac -nolisten tcp -dpi 96 +extension GLX" -n 98 bash -c '
    # Start VNC server for remote access  
    echo "📡 Starting VNC server on display $DISPLAY..."
    x11vnc -display $DISPLAY -bg -forever -nopw -quiet -listen localhost -rfbport 5901 -xkb &
    VNC_PID=$!
    
    # Wait for VNC to be ready
    sleep 3
    
    echo "✅ VNC server ready on localhost:5901"
    echo "🔍 Connect with VNC client to: localhost:5901"
    
    # Start HTTP server for the built app
    echo "📦 Starting HTTP server for built app..."
    cd dist/electron/UnPackaged
    python3 -m http.server 8080 > ../../../http-server.log 2>&1 &
    HTTP_PID=$!
    cd ../../..
    
    # Wait for HTTP server
    echo "⏳ Waiting for HTTP server..."
    sleep 5
    
    if curl -s http://localhost:8080 >/dev/null 2>&1; then
        echo "✅ HTTP server ready at http://localhost:8080"
        
        echo ""
        echo "🎯 ======================================================"
        echo "🎯 CYPRESS VNC MODE READY!"
        echo "🎯 ======================================================"
        echo "🎯 VNC Access: localhost:5901 (no password)"
        echo "🎯 App Server: http://localhost:8080"
        echo "🎯 Display: :98"
        echo "🎯 ======================================================"
        echo ""
        echo "📖 Instructions:"
        echo "1. Connect to localhost:5901 with a VNC client"
        echo "2. You will see the Cypress Test Runner interface"
        echo "3. Your app will be served at http://localhost:8080"
        echo "4. Click on test files to run them interactively"
        echo "5. Use Ctrl+C to stop when done"
        echo ""
        
        # Start Cypress in interactive mode (not headless)
        echo "🧪 Starting Cypress Test Runner..."
        
        # Give user time to connect via VNC before starting
        echo "⏳ Waiting 10 seconds for VNC connection..."
        sleep 10
        
        # Run Cypress in interactive mode
        npx cypress open --browser electron
        
        echo "✅ Cypress session ended"
    else
        echo "❌ HTTP server failed to start"
    fi
    
    # Cleanup
    echo "🧹 Cleaning up..."
    kill $HTTP_PID $VNC_PID 2>/dev/null || true
    
    echo "🏁 VNC session completed"
'

echo "🏁 Cypress VNC mode finished"
