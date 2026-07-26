const { getDatabase, saveDatabase } = require('./database');

module.exports = {
  // ========== Пользователи ==========
  getUserByDiscordId: async (discordId) => {
    const db = await getDatabase();
    const stmt = db.prepare('SELECT * FROM users WHERE discord_id = ?');
    stmt.bind([discordId]);
    if (stmt.step()) { const row = stmt.getAsObject(); stmt.free(); return row; }
    stmt.free(); return null;
  },
  getUserById: async (id) => {
    const db = await getDatabase();
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) { const row = stmt.getAsObject(); stmt.free(); return row; }
    stmt.free(); return null;
  },
  getAllUsers: async () => {
    const db = await getDatabase();
    const stmt = db.prepare('SELECT id, discord_username, avatar_url, custom_avatar, minecraft_nickname, highest_role FROM users');
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free(); return rows;
  },
  createUser: async (discordId, username, avatar) => {
    const db = await getDatabase();
    db.run('INSERT INTO users (discord_id, discord_username, avatar_url, custom_avatar) VALUES (?, ?, ?, ?)',
      [discordId, username, avatar, null]);
    saveDatabase();
    return { discord_id: discordId, discord_username: username, avatar_url: avatar, custom_avatar: null, minecraft_nickname: null, highest_role: 'None' };
  },
  setMinecraftNickname: async (discordId, nickname) => {
    const db = await getDatabase();
    db.run('UPDATE users SET minecraft_nickname = ? WHERE discord_id = ?', [nickname, discordId]);
    saveDatabase();
  },
  setHighestRole: async (discordId, role) => {
    const db = await getDatabase();
    db.run('UPDATE users SET highest_role = ?, role_updated_at = datetime("now") WHERE discord_id = ?', [role, discordId]);
    saveDatabase();
  },
  setCustomAvatar: async (discordId, filePath) => {
    const db = await getDatabase();
    db.run('UPDATE users SET custom_avatar = ? WHERE discord_id = ?', [filePath, discordId]);
    saveDatabase();
  },

  // ========== Привязка ника ==========
  getPendingLink: async (discordId) => {
    const db = await getDatabase();
    const stmt = db.prepare('SELECT * FROM pending_links WHERE discord_id = ? AND active = 1 ORDER BY id DESC LIMIT 1');
    stmt.bind([discordId]);
    if (stmt.step()) { const row = stmt.getAsObject(); stmt.free(); return row; }
    stmt.free(); return null;
  },
  createPendingLink: async (discordId) => {
    const db = await getDatabase();
    db.run('INSERT INTO pending_links (discord_id) VALUES (?)', [discordId]);
    saveDatabase();
  },
  deactivatePendingLink: async (id) => {
    const db = await getDatabase();
    db.run('UPDATE pending_links SET active = 0 WHERE id = ?', [id]);
    saveDatabase();
  },

  // ========== Модули ==========
  getModulesByUser: async (userId) => {
    const db = await getDatabase();
    const stmt = db.prepare('SELECT * FROM modules WHERE owner_id = ? ORDER BY created_at DESC');
    stmt.bind([userId]); const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free(); return rows;
  },
  getAllModules: async () => {
    const db = await getDatabase();
    const stmt = db.prepare(`
      SELECT modules.*, users.minecraft_nickname, users.highest_role
      FROM modules JOIN users ON modules.owner_id = users.id
      ORDER BY modules.created_at DESC
    `);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free(); return rows;
  },
  getModuleById: async (id) => {
    const db = await getDatabase();
    const stmt = db.prepare(`
      SELECT modules.*, users.minecraft_nickname, users.highest_role
      FROM modules JOIN users ON modules.owner_id = users.id
      WHERE modules.id = ?
    `);
    stmt.bind([id]);
    if (stmt.step()) { const row = stmt.getAsObject(); stmt.free(); return row; }
    stmt.free(); return null;
  },
  createModule: async (ownerId, name, description, category = 'разное') => {
    const db = await getDatabase();
    try {
      db.run('INSERT INTO modules (owner_id, name, description, category, file_path) VALUES (?, ?, ?, ?, ?)',
        [ownerId, name, description, category, '']);
      saveDatabase();
      const result = db.exec('SELECT last_insert_rowid()');
      const lastId = result[0].values[0][0];
      return { id: lastId };
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE constraint failed')) throw new Error('UNIQUE');
      throw e;
    }
  },
  incrementDownload: async (id) => {
    const db = await getDatabase();
    db.run('UPDATE modules SET downloads = downloads + 1 WHERE id = ?', [id]);
    saveDatabase();
  },
  deleteModule: async (moduleId, ownerId) => {
    const db = await getDatabase();
    const mod = db.prepare('SELECT * FROM modules WHERE id = ? AND owner_id = ?').get(moduleId, ownerId);
    if (!mod) return false;
    db.run('DELETE FROM module_screenshots WHERE module_id = ?', [moduleId]);
    db.run('DELETE FROM module_ratings WHERE module_id = ?', [moduleId]);
    db.run('DELETE FROM module_comments WHERE module_id = ?', [moduleId]);
    db.run('DELETE FROM favorites WHERE module_id = ?', [moduleId]);
    db.run('DELETE FROM modules WHERE id = ?', [moduleId]);
    saveDatabase();
    return true;
  },
  updateModule: async (moduleId, ownerId, name, description) => {
    const db = await getDatabase();
    const mod = db.prepare('SELECT * FROM modules WHERE id = ? AND owner_id = ?').get(moduleId, ownerId);
    if (!mod) return false;
    db.run('UPDATE modules SET name = ?, description = ? WHERE id = ?', [name, description, moduleId]);
    saveDatabase();
    return true;
  },

  // ========== Рейтинг пользователей ==========
  addRating: async (fromUserId, toUserId, score) => {
    const db = await getDatabase();
    const existing = db.prepare('SELECT id FROM ratings WHERE from_user_id = ? AND to_user_id = ?');
    existing.bind([fromUserId, toUserId]);
    if (existing.step()) {
      db.run('UPDATE ratings SET score = ? WHERE from_user_id = ? AND to_user_id = ?', [score, fromUserId, toUserId]);
    } else {
      db.run('INSERT INTO ratings (from_user_id, to_user_id, score) VALUES (?, ?, ?)', [fromUserId, toUserId, score]);
    }
    existing.free(); saveDatabase();
  },
  getUserAverageRating: async (userId) => {
    const db = await getDatabase();
    const stmt = db.prepare('SELECT AVG(score) as avg FROM ratings WHERE to_user_id = ?');
    stmt.bind([userId]);
    if (stmt.step()) { const avg = stmt.getAsObject().avg; stmt.free(); return avg ? parseFloat(avg).toFixed(1) : '0'; }
    stmt.free(); return '0';
  },
  getUserRatingCount: async (userId) => {
    const db = await getDatabase();
    const stmt = db.prepare('SELECT COUNT(*) as count FROM ratings WHERE to_user_id = ?');
    stmt.bind([userId]);
    if (stmt.step()) { const count = stmt.getAsObject().count; stmt.free(); return count; }
    stmt.free(); return 0;
  },

  // ========== Комментарии пользователей ==========
  addComment: async (authorId, targetUserId, text) => {
    const db = await getDatabase();
    db.run('INSERT INTO comments (author_id, target_user_id, text) VALUES (?, ?, ?)', [authorId, targetUserId, text]);
    saveDatabase();
  },
  getCommentsByUser: async (targetUserId) => {
    const db = await getDatabase();
    const stmt = db.prepare(`
      SELECT comments.*, users.discord_username, users.minecraft_nickname, users.highest_role
      FROM comments JOIN users ON comments.author_id = users.id
      WHERE comments.target_user_id = ?
      ORDER BY comments.created_at DESC
    `);
    stmt.bind([targetUserId]); const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free(); return rows;
  },

  // ========== Рейтинг модулей ==========
  addModuleRating: async (userId, moduleId, score) => {
    const db = await getDatabase();
    const existing = db.prepare('SELECT id FROM module_ratings WHERE user_id = ? AND module_id = ?');
    existing.bind([userId, moduleId]);
    if (existing.step()) {
      db.run('UPDATE module_ratings SET score = ? WHERE user_id = ? AND module_id = ?', [score, userId, moduleId]);
    } else {
      db.run('INSERT INTO module_ratings (user_id, module_id, score) VALUES (?, ?, ?)', [userId, moduleId, score]);
    }
    existing.free(); saveDatabase();
  },
  getModuleAverageRating: async (moduleId) => {
    const db = await getDatabase();
    const stmt = db.prepare('SELECT AVG(score) as avg FROM module_ratings WHERE module_id = ?');
    stmt.bind([moduleId]);
    if (stmt.step()) { const avg = stmt.getAsObject().avg; stmt.free(); return avg ? parseFloat(avg).toFixed(1) : '0'; }
    stmt.free(); return '0';
  },
  getModuleRatingCount: async (moduleId) => {
    const db = await getDatabase();
    const stmt = db.prepare('SELECT COUNT(*) as count FROM module_ratings WHERE module_id = ?');
    stmt.bind([moduleId]);
    if (stmt.step()) { const count = stmt.getAsObject().count; stmt.free(); return count; }
    stmt.free(); return 0;
  },

  // ========== Комментарии модулей ==========
  addModuleComment: async (authorId, moduleId, text) => {
    const db = await getDatabase();
    db.run('INSERT INTO module_comments (author_id, module_id, text) VALUES (?, ?, ?)', [authorId, moduleId, text]);
    saveDatabase();
  },
  getModuleComments: async (moduleId) => {
    const db = await getDatabase();
    const stmt = db.prepare(`
      SELECT module_comments.*, users.discord_username, users.minecraft_nickname, users.highest_role
      FROM module_comments JOIN users ON module_comments.author_id = users.id
      WHERE module_comments.module_id = ?
      ORDER BY module_comments.created_at DESC
    `);
    stmt.bind([moduleId]); const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free(); return rows;
  },

  // ========== Скриншоты модулей ==========
  getModuleScreenshots: async (moduleId) => {
    const db = await getDatabase();
    const stmt = db.prepare('SELECT * FROM module_screenshots WHERE module_id = ?');
    stmt.bind([moduleId]); const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free(); return rows;
  },
  addModuleScreenshot: async (moduleId, path) => {
    const db = await getDatabase();
    db.run('INSERT INTO module_screenshots (module_id, path) VALUES (?, ?)', [moduleId, path]);
    saveDatabase();
  },
  deleteModuleScreenshot: async (screenshotId) => {
    const db = await getDatabase();
    db.run('DELETE FROM module_screenshots WHERE id = ?', [screenshotId]);
    saveDatabase();
  },

  // ========== Фильтрация и поиск ==========
  getFilteredModules: async ({ search, category, sort }) => {
    const db = await getDatabase();
    let query = 'SELECT modules.*, users.minecraft_nickname, users.highest_role FROM modules JOIN users ON modules.owner_id = users.id WHERE 1=1';
    const params = [];
    if (search) { query += ' AND modules.name LIKE ?'; params.push(`%${search}%`); }
    if (category && category !== 'all') { query += ' AND modules.category = ?'; params.push(category); }
    switch (sort) {
      case 'oldest': query += ' ORDER BY modules.created_at ASC'; break;
      case 'popular': query += ' ORDER BY modules.downloads DESC'; break;
      case 'rating':
        query += ' LEFT JOIN (SELECT module_id, AVG(score) as avg_rating FROM module_ratings GROUP BY module_id) mr ON modules.id = mr.module_id ORDER BY avg_rating DESC';
        break;
      default: query += ' ORDER BY modules.created_at DESC';
    }
    const stmt = db.prepare(query);
    if (params.length) stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free(); return rows;
  },
  getCategories: async () => {
    const db = await getDatabase();
    const stmt = db.prepare('SELECT DISTINCT category FROM modules ORDER BY category');
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject().category);
    stmt.free(); return rows;
  },

  // ========== Рекомендованные модули (только с рейтингом) ==========
  getRecommendedModules: async (limit = 6) => {
    const db = await getDatabase();
    const query = `
      SELECT modules.*, users.minecraft_nickname, users.highest_role, AVG(module_ratings.score) as avg_rating
      FROM modules
      JOIN users ON modules.owner_id = users.id
      JOIN module_ratings ON modules.id = module_ratings.module_id
      GROUP BY modules.id
      HAVING avg_rating > 0
      ORDER BY avg_rating DESC, modules.downloads DESC
      LIMIT ?
    `;
    const stmt = db.prepare(query);
    stmt.bind([limit]);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free(); return rows;
  },

  // ========== Избранное ==========
  addFavorite: async (userId, moduleId) => {
    const db = await getDatabase();
    db.run('INSERT OR IGNORE INTO favorites (user_id, module_id) VALUES (?, ?)', [userId, moduleId]);
    saveDatabase();
  },
  removeFavorite: async (userId, moduleId) => {
    const db = await getDatabase();
    db.run('DELETE FROM favorites WHERE user_id = ? AND module_id = ?', [userId, moduleId]);
    saveDatabase();
  },
  isFavorite: async (userId, moduleId) => {
    const db = await getDatabase();
    const stmt = db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND module_id = ?');
    stmt.bind([userId, moduleId]);
    const exists = stmt.step();
    stmt.free(); return !!exists;
  },
  getFavorites: async (userId) => {
    const db = await getDatabase();
    const stmt = db.prepare(`
      SELECT modules.*, users.minecraft_nickname, users.highest_role
      FROM favorites JOIN modules ON favorites.module_id = modules.id
      JOIN users ON modules.owner_id = users.id
      WHERE favorites.user_id = ?
      ORDER BY modules.created_at DESC
    `);
    stmt.bind([userId]); const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free(); return rows;
  },

  // ========== Админские методы ==========
  getAllModulesAdmin: async () => {
    const db = await getDatabase();
    const stmt = db.prepare(`
      SELECT modules.*, users.minecraft_nickname, users.discord_username
      FROM modules JOIN users ON modules.owner_id = users.id
      ORDER BY modules.created_at DESC
    `);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  },
  deleteUser: async (userId) => {
    const db = await getDatabase();
    // Удаляем всё, что связано с пользователем
    db.run('DELETE FROM favorites WHERE user_id = ?', [userId]);
    db.run('DELETE FROM comments WHERE author_id = ? OR target_user_id = ?', [userId, userId]);
    db.run('DELETE FROM ratings WHERE from_user_id = ? OR to_user_id = ?', [userId, userId]);
    db.run('DELETE FROM module_comments WHERE author_id = ?', [userId]);
    db.run('DELETE FROM module_ratings WHERE user_id = ?', [userId]);
    db.run('DELETE FROM modules WHERE owner_id = ?', [userId]);
    db.run('DELETE FROM users WHERE id = ?', [userId]);
    saveDatabase();
  },
  isModerator: (user) => {
    if (!user) return false;
    const priority = { 'admin': 1, 'dev': 2, 'sr.mod': 3, 'mod': 4 };
    return (user.highest_role && priority[user.highest_role.toLowerCase()] <= 4);
  }
};