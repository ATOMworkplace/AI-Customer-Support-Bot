const sqlite3 = require('sqlite3').verbose();
const { databasePath } = require('../config');

const db = new sqlite3.Database(databasePath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        sessionId TEXT PRIMARY KEY,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        messageId INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId TEXT NOT NULL,
        sender TEXT NOT NULL CHECK(sender IN ('user', 'ai')),
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sessionId) REFERENCES sessions (sessionId)
      )
    `);
  }
});

module.exports = db;