// Mock Electron APIs for Cypress testing
// This provides the same window.electron APIs that the real Electron preload script provides

// Add electron APIs to the window object in Cypress
Cypress.Commands.add('setupElectronAPIs', () => {
  cy.window().then((win) => {
    // Only setup if not already present
    if (win.electron) {
      cy.log('✅ window.electron already available')
      return
    }

    cy.log('🔧 Setting up window.electron APIs for database access...')

    // Access Node.js modules through Cypress's top-level window/global context
    // Since we confirmed Node.js APIs work in basic tests
    const path = require('path')
    const fs = require('fs')
    const os = require('os')
    const sqlite3 = require('sqlite3')

    // Create database manager (similar to preload script)
    const dbman = {
      database: null,

      status() {
        return !!this.database
      },

      connect(filename) {
        const absolutePath = path.isAbsolute(filename) ? filename : path.join(process.cwd(), filename)

        console.log('Cypress: Connecting to database:', absolutePath)

        if (this.database) {
          this.database.close()
        }

        // Create database file if it doesn't exist
        if (!fs.existsSync(absolutePath)) {
          console.log('Cypress: Creating database file:', absolutePath)
          const dir = path.dirname(absolutePath)
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
          }
          try {
            const tempDb = new sqlite3.Database(absolutePath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE)
            tempDb.close()
          } catch (error) {
            console.error('Cypress: Failed to create database:', error)
            return false
          }
        }

        try {
          this.database = new sqlite3.Database(absolutePath, sqlite3.OPEN_READWRITE, (err) => {
            if (err) {
              console.error('Cypress: Database connection error:', err.message)
              return false
            }
            console.log('Cypress: Connected to SQLite database:', absolutePath)
          })

          // Configure SQLite (similar to preload script)
          this.database.serialize(() => {
            this.database.run('PRAGMA journal_mode = DELETE')
            this.database.run('PRAGMA synchronous = FULL')
            this.database.run('PRAGMA foreign_keys = ON')
          })

          return true
        } catch (error) {
          console.error('Cypress: Database connection failed:', error)
          return false
        }
      },

      close() {
        if (this.database) {
          this.database.close()
          this.database = null
          return true
        }
        return false
      },

      // Execute query and return results
      query(sql, params = []) {
        return new Promise((resolve, reject) => {
          if (!this.database) {
            reject(new Error('Database not connected'))
            return
          }

          this.database.all(sql, params, (err, rows) => {
            if (err) {
              console.error('Cypress: Query error:', err.message)
              reject(err)
            } else {
              resolve(rows)
            }
          })
        })
      },

      // Execute command (INSERT, UPDATE, DELETE)
      run(sql, params = []) {
        return new Promise((resolve, reject) => {
          if (!this.database) {
            reject(new Error('Database not connected'))
            return
          }

          this.database.serialize(() => {
            this.database.run(sql, params, function (err) {
              if (err) {
                console.error('Cypress: Run error:', err.message)
                reject(err)
              } else {
                resolve({
                  lastID: this.lastID,
                  changes: this.changes,
                })
              }
            })
          })
        })
      },
    }

    // Set up window.electron with the same structure as the preload script
    win.electron = {
      // Database manager
      dbman: dbman,

      // File system operations
      fs: {
        existsSync: fs.existsSync,
        readFileSync: fs.readFileSync,
        writeFileSync: fs.writeFileSync,
        readdirSync: fs.readdirSync,
        statSync: fs.statSync,
      },

      // Path operations
      path: {
        resolve: path.resolve,
        join: path.join,
        dirname: path.dirname,
        basename: path.basename,
        extname: path.extname,
      },

      // System info
      homedir: os.homedir(),
      platform: os.platform(),
      publicFolder: path.resolve(process.cwd(), 'public'),
    }

    cy.log('✅ window.electron APIs set up successfully!')
    cy.log(`Database manager available: ${!!win.electron.dbman}`)
    cy.log(`Filesystem APIs available: ${!!win.electron.fs}`)
  })
})
