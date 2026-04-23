const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'state.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS plays (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    artist    TEXT,
    title     TEXT,
    ncm_id    TEXT,
    played_at INTEGER DEFAULT (strftime('%s','now'))
  );
  CREATE TABLE IF NOT EXISTS prefs (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
`);

function logPlay({ artist, title, ncm_id }) {
  db.prepare('INSERT INTO plays (artist, title, ncm_id) VALUES (?, ?, ?)').run(artist, title, ncm_id || null);
}

function getRecentPlays(n = 5) {
  return db.prepare('SELECT artist, title FROM plays ORDER BY played_at DESC LIMIT ?').all(n);
}

function getPref(key) {
  const row = db.prepare('SELECT value FROM prefs WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setPref(key, value) {
  db.prepare('INSERT OR REPLACE INTO prefs (key, value) VALUES (?, ?)').run(key, String(value));
}

module.exports = { logPlay, getRecentPlays, getPref, setPref };
