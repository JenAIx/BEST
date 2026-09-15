import { contextBridge, ipcRenderer } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import sqlite3 from 'sqlite3'

// Use process.cwd() since we're compiled to CommonJS
const __dirname = process.cwd()

console.log('electron-preload.js loaded')

// Database manager - similar to original app
// Split SQL into statements while respecting string literals, comments and
// BEGIN…END / CASE…END blocks — a naive split(';') cuts CREATE TRIGGER
// bodies in half ("incomplete input"), which is how every trigger migration
// silently failed to create its triggers through this preload. Mirror of
// splitSqlStatements() in src/core/database/sqlite/real-connection.js
// (kept in sync by hand: the preload cannot import from src/).
function splitSqlStatements(sql) {
  const statements = []
  const len = sql.length
  let buf = ''
  let i = 0
  let depth = 0
  const isWordChar = (c) => /[A-Za-z0-9_]/.test(c)
  while (i < len) {
    const c = sql[i]
    const next = sql[i + 1]
    if (c === '-' && next === '-') {
      while (i < len && sql[i] !== '\n') { buf += sql[i]; i++ }
      continue
    }
    if (c === '/' && next === '*') {
      buf += c; buf += next; i += 2
      while (i < len && !(sql[i] === '*' && sql[i + 1] === '/')) { buf += sql[i]; i++ }
      if (i < len) { buf += sql[i]; buf += sql[i + 1]; i += 2 }
      continue
    }
    if (c === "'" || c === '"') {
      const q = c
      buf += c; i++
      while (i < len) {
        if (sql[i] === q && sql[i + 1] === q) { buf += q + q; i += 2; continue }
        buf += sql[i]
        if (sql[i] === q) { i++; break }
        i++
      }
      continue
    }
    const prevChar = i === 0 ? '\0' : sql[i - 1]
    if (!isWordChar(prevChar)) {
      const rest = sql.slice(i, i + 5).toUpperCase()
      if ((rest.startsWith('BEGIN') && !isWordChar(sql[i + 5] || ' ')) || (rest.startsWith('CASE') && !isWordChar(sql[i + 4] || ' '))) {
        depth++
      } else if (rest.startsWith('END') && !isWordChar(sql[i + 3] || ' ')) {
        depth = Math.max(0, depth - 1)
      }
    }
    if (c === ';' && depth === 0) {
      const stmt = buf.trim()
      if (stmt) statements.push(stmt)
      buf = ''
      i++
      continue
    }
    buf += c
    i++
  }
  const tail = buf.trim()
  if (tail) statements.push(tail)
  return statements
}

const dbman = {
  database: null,

  status() {
    return !!this.database
  },

  async connect(filename) {
    // Convert relative path to absolute
    const absolutePath = path.isAbsolute(filename) ? filename : path.join(process.cwd(), filename)

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

      // Durability-first profile: rollback journal + full sync. Cache stays at the
      // SQLite default (~2000 pages / 8 MiB) instead of the previous 0, which
      // forced every query through the disk page cache and tanked import/joins.
      // Run sequentially so connect() doesn't return before PRAGMAs are applied.
      const runPragma = (sql) =>
        new Promise((resolve, reject) =>
          this.database.run(sql, (err) => (err ? reject(err) : resolve())),
        )
      try {
        await runPragma('PRAGMA journal_mode = DELETE')
        await runPragma('PRAGMA synchronous = FULL')
        await runPragma('PRAGMA foreign_keys = ON')
      } catch (err) {
        console.error('Failed to apply connection PRAGMAs:', err)
        return false
      }

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
      const database = new sqlite3.Database(filename, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) {
          console.error('Error creating database:', err.message)
          return false
        }
        console.log('Database created:', filename)
      })
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

      // Handle multi-statement SQL (like migrations). A single CREATE TRIGGER
      // contains semicolons inside BEGIN…END — the splitter keeps it whole.
      if (sql.includes(';') && splitSqlStatements(sql).length > 1) {
        this.runMultipleStatements(sql).then(resolve).catch(reject)
        return
      }

      // Use serialize to ensure operations complete in order.
      // IMPORTANT: the run callback must NOT be bound — sqlite3 exposes
      // lastID/changes on the callback's own `this` (the statement context).
      // The previous `.bind(this)` rebound it to the preload object, so
      // lastID/changes were always undefined and every repository had to
      // fall back to fragile "fetch the most recent row" workarounds.
      this.database.serialize(() => {
        this.database.run(sql, params, function (err) {
          if (err) {
            console.error('Run error:', err.message)
            reject(err)
          } else {
            const result = {
              lastID: this.lastID,
              changes: this.changes,
            }
            console.log(`SQL executed: ${sql.substring(0, 50)}... Changes: ${result.changes}`)
            resolve(result)
          }
        })
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

      // Split SQL into individual statements (BEGIN…END aware)
      const statements = splitSqlStatements(sql)

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
        this.database.run(statement, [], function (err) {
          if (err) {
            console.error(`Statement ${index + 1} error:`, err.message)
            console.error('Failed statement:', statement.substring(0, 100) + '...')
            reject(err)
            return
          }

          completed++
          lastResult = {
            lastID: this.lastID,
            changes: this.changes,
          }

          // Execute next statement
          executeNext(index + 1)
        })
      }

      executeNext(0)
    })
  },
}

// Expose APIs to renderer process
contextBridge.exposeInMainWorld('electron', {
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

  // Database manager
  dbman: dbman,

  // System info
  homedir: os.homedir(),
  platform: os.platform(),
  appPath: process.cwd(),

  // Dialog API for folder/file selection
  dialog: {
    showOpenDialog: (options) => ipcRenderer.invoke('dialog:openDirectory', options),
  },

  // Environment
  publicFolder: path.resolve(__dirname, process.env.QUASAR_PUBLIC_FOLDER || '../public'),
})
