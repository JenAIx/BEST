import { contextBridge } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import sqlite3 from 'sqlite3'

// Use process.cwd() since we're compiled to CommonJS
const __dirname = process.cwd()

console.log('electron-preload.js loaded')

// Database manager - similar to original app
const dbman = {
  database: null,
  
  status() {
    return !!this.database
  },
  
  connect(filename) {
    // Convert relative path to absolute
    const absolutePath = path.isAbsolute(filename) 
      ? filename 
      : path.join(process.cwd(), filename)
    
    console.log('Connecting to database:', absolutePath)
    console.log('Working directory:', process.cwd())
    
    if (this.database) {
      this.database.close()
    }
    
    // Create database file if it doesn't exist
    if (!fs.existsSync(absolutePath)) {
      console.log(`Database file does not exist, creating: ${absolutePath}`)
      // Ensure directory exists
      const dir = path.dirname(absolutePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      // Create empty database file
      try {
        const tempDb = new sqlite3.Database(absolutePath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE)
        tempDb.close()
        console.log(`Created database file: ${absolutePath}`)
      } catch (error) {
        console.error(`Failed to create database file: ${absolutePath}`, error)
        return false
      }
    }
    
    try {
      // Open database with explicit file storage
      this.database = new sqlite3.Database(absolutePath, sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
          console.error('Database connection error:', err.message)
          return false
        }
        console.log('Connected to SQLite database:', absolutePath)
      })
      
      // CRITICAL: Configure SQLite for immediate persistence
      // These must complete before any other operations
      this.database.serialize(() => {
        // Force rollback journal mode (most compatible, immediate writes)
        this.database.run('PRAGMA journal_mode = DELETE', (err) => {
          if (err) console.error('Failed to set journal mode:', err)
          else console.log('Journal mode set to DELETE (immediate writes)')
        })
        
        // Force all transactions to disk immediately
        this.database.run('PRAGMA synchronous = FULL', (err) => {
          if (err) console.error('Failed to set synchronous mode:', err)
          else console.log('Synchronous mode set to FULL (maximum durability)')
        })
        
        // Disable memory caching
        this.database.run('PRAGMA cache_size = 0', (err) => {
          if (err) console.error('Failed to set cache size:', err)
          else console.log('Cache disabled for immediate persistence')
        })
        
        // Enable foreign keys
        this.database.run('PRAGMA foreign_keys = ON', (err) => {
          if (err) console.error('Failed to enable foreign keys:', err)
          else console.log('Foreign keys enabled')
        })
        
        // Verify we're not using temp storage
        this.database.get('PRAGMA temp_store', (err, row) => {
          if (!err) console.log('Temp store setting:', row)
        })
        
        // Verify database file
        this.database.get('PRAGMA database_list', (err, row) => {
          if (!err) console.log('Database file location:', row)
        })
      })
      
      return true
    } catch (error) {
      console.error('Database connection failed:', error)
      return false
    }
  },
  
  close() {
    if (this.database) {
      this.database.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message)
        } else {
          console.log('Database connection closed')
        }
      })
      this.database = null
      return true
    }
    return false
  },
  
  create(filename) {
    try {
      const database = new sqlite3.Database(filename, 
        sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
        (err) => {
          if (err) {
            console.error('Error creating database:', err.message)
            return false
          }
          console.log('Database created:', filename)
        }
      )
      database.close()
      return true
    } catch (error) {
      console.error('Database creation failed:', error)
      return false
    }
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
          console.error('Query error:', err.message)
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
      
      // Handle multi-statement SQL (like migrations)
      if (sql.includes(';') && sql.trim().split(';').filter(s => s.trim()).length > 1) {
        this.runMultipleStatements(sql).then(resolve).catch(reject)
        return
      }
      
      // Use serialize to ensure operations complete in order
      this.database.serialize(() => {
        this.database.run(sql, params, function(err) {
          if (err) {
            console.error('Run error:', err.message)
            reject(err)
          } else {
            const result = {
              lastID: this.lastID,
              changes: this.changes
            }
            console.log(`SQL executed: ${sql.substring(0, 50)}... Changes: ${result.changes}`)
            
            // CRITICAL: For COMMIT statements, force a checkpoint to ensure data is written
            if (sql.trim().toUpperCase() === 'COMMIT') {
              console.log('Forcing database checkpoint after COMMIT...')
              // Get reference to database before callback
              const db = dbman.database
              // Force SQLite to write all pending changes to disk
              db.run('PRAGMA wal_checkpoint(TRUNCATE)', (checkErr) => {
                if (checkErr) {
                  console.log('Checkpoint not needed (not in WAL mode)')
                } else {
                  console.log('Database checkpoint completed')
                }
                resolve(result)
              })
            } else {
              resolve(result)
            }
          }
        }.bind(this)) // Bind this to preserve context
      })
    })
  },
  
  // Execute multiple SQL statements
  runMultipleStatements(sql) {
    return new Promise((resolve, reject) => {
      if (!this.database) {
        reject(new Error('Database not connected'))
        return
      }
      
      // Split SQL into individual statements
      const statements = sql.split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0)
      
      console.log(`Executing ${statements.length} SQL statements`)
      
      let completed = 0
      let lastResult = { lastID: null, changes: 0 }
      
      const executeNext = (index) => {
        if (index >= statements.length) {
          console.log(`All ${completed} statements executed successfully`)
          resolve(lastResult)
          return
        }
        
        const statement = statements[index]
        this.database.run(statement, [], function(err) {
          if (err) {
            console.error(`Statement ${index + 1} error:`, err.message)
            console.error('Failed statement:', statement.substring(0, 100) + '...')
            reject(err)
            return
          }
          
          completed++
          lastResult = {
            lastID: this.lastID,
            changes: this.changes
          }
          
          // Execute next statement
          executeNext(index + 1)
        })
      }
      
      executeNext(0)
    })
  }
}

// Expose APIs to renderer process
contextBridge.exposeInMainWorld('electron', {
  // File system operations
  fs: {
    existsSync: fs.existsSync,
    readFileSync: fs.readFileSync,
    writeFileSync: fs.writeFileSync,
    readdirSync: fs.readdirSync,
    statSync: fs.statSync
  },
  
  // Path operations
  path: {
    resolve: path.resolve,
    join: path.join,
    dirname: path.dirname,
    basename: path.basename,
    extname: path.extname
  },
  
  // Database manager
  dbman: dbman,
  
  // System info
  homedir: os.homedir(),
  platform: os.platform(),
  
  // Environment
  publicFolder: path.resolve(__dirname, process.env.QUASAR_PUBLIC_FOLDER || '../public')
})
