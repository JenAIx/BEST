#!/bin/bash
set +e  # Don't exit on non-zero commands

echo "🧪 Cypress E2E Testing in Headless Mode"

# Ensure cypress directories exist
mkdir -p tests/cypress/{e2e,fixtures,support,videos,screenshots}

echo "🚀 Starting headless test environment..."

# Run in virtual display without complex process management
DISPLAY=:99 ELECTRON_DISABLE_SECURITY_WARNINGS=true xvfb-run -a bash -c '
    echo "✅ Virtual display ready"
    
    # Start a simple HTTP server to serve the built app
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
        
        # Run tests with Cypress's Electron browser
        if [ -n "$1" ]; then
            echo "🧪 Running specific test: $1"
            timeout 120 npx cypress run --spec "tests/cypress/e2e/$1" --browser electron --headless
        else
            echo "🧪 Running all Cypress tests..."
            timeout 120 npx cypress run --browser electron --headless
        fi
        
        TEST_RESULT=$?
        echo "Test completed with exit code: $TEST_RESULT"
        
        # Cleanup
        echo "🧹 Cleaning up..."
        kill $HTTP_PID 2>/dev/null || true
        sleep 2
        
        exit $TEST_RESULT
    else
        echo "❌ HTTP server failed to start"
        exit 1
    fi
'
