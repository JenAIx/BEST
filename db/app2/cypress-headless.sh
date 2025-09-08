#!/bin/bash
set +e  # Don't exit on non-zero commands

echo "🧪 Cypress E2E Testing in Headless Mode"

# Ensure cypress directories exist
mkdir -p tests/cypress/{e2e,fixtures,support,videos,screenshots}

echo "🚀 Starting headless test environment..."

# Run in virtual display without complex process management
DISPLAY=:99 ELECTRON_DISABLE_SECURITY_WARNINGS=true xvfb-run -a bash -c '
    echo "✅ Virtual display ready"
    
                # Run tests with Cypress's Electron browser (no HTTP server needed)
            echo "🚀 Running Cypress in true Electron mode..."
            
            # Ensure the Electron app exists  
            ELECTRON_APP="./dist/electron/Packaged/Best - Scientific DB Manager-linux-arm64/Best - Scientific DB Manager"
            if [ -f "$ELECTRON_APP" ]; then
                echo "✅ Electron app found: $ELECTRON_APP"
                
                if [ -n "$1" ]; then
                    echo "🧪 Running specific test: $1"
                    timeout 120 npx cypress run --spec "tests/cypress/e2e/$1" --browser electron --headless
                else
                    echo "🧪 Running all Cypress tests..."
                    timeout 120 npx cypress run --browser electron --headless
                fi

                TEST_RESULT=$?
                echo "Test completed with exit code: $TEST_RESULT"
                exit $TEST_RESULT
            else
                echo "❌ Electron app not found: $ELECTRON_APP"
                echo "Please run 'npm run build:electron' first"
                exit 1
            fi
'
