const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;

// Путь к базе данных: можно задать через переменную окружения DATABASE_PATH,
// иначе будет использоваться catalog.db в корне проекта.
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'catalog.db');

async function getDatabase() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Включаем поддержку внешних ключей
  db.run('PRAGMA foreign_keys = ON');

  // Создаём все таблицы (без ON DELETE CASCADE, так как sql.js может ругаться)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT UNIQUE NOT NULL,
      discord_username TEXT NOT NULL,
      avatar_url TEXT,
      custom_avatar TEXT,
      minecraft_nickname TEXT UNIQUE,
      highest_role TEXT DEFAULT 'None',
      role_updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS pending_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER REFERENCES users(id),
      name TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'разное',
      file_path TEXT DEFAULT '',
      screenshot_path TEXT,
      downloads INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(owner_id, name)
    );

    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER REFERENCES users(id),
      to_user_id INTEGER REFERENCES users(id),
      score INTEGER CHECK(score >= 1 AND score <= 5),
      UNIQUE(from_user_id, to_user_id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER REFERENCES users(id),
      target_user_id INTEGER REFERENCES users(id),
      text TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS module_ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      module_id INTEGER REFERENCES modules(id),
      score INTEGER CHECK(score >= 1 AND score <= 5),
      UNIQUE(user_id, module_id)
    );

    CREATE TABLE IF NOT EXISTS module_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER REFERENCES users(id),
      module_id INTEGER REFERENCES modules(id),
      text TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS module_screenshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id INTEGER REFERENCES modules(id),
      path TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS favorites (
      user_id INTEGER REFERENCES users(id),
      module_id INTEGER REFERENCES modules(id),
      UNIQUE(user_id, module_id)
    );
  `);

  // Добавляем колонку category, если её ещё нет (для старых баз)
  try {
    db.run('ALTER TABLE modules ADD COLUMN category TEXT DEFAULT "разное"');
  } catch (e) {
    // колонка уже существует – игнорируем ошибку
  }

  saveDatabase();
  return db;
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    // Создаём директорию, если её нет (на случай, если путь содержит подпапки)
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dbPath, buffer);
  }
}

module.exports = { getDatabase, saveDatabase };