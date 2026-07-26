const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const models = require('../models');
const bot = require('../bot');
const { getDatabase } = require('../database');

function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/auth/discord');
}

// Настройка multer для скриншотов (до 5 файлов)
const screenshotStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/screenshots/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = req.user.minecraft_nickname + '_' + Date.now() + ext;
    cb(null, safeName);
  }
});
const screenshotUpload = multer({
  storage: screenshotStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.mimetype))
      return cb(new Error('Только PNG/JPG'));
    cb(null, true);
  }
}).array('screenshots', 5);

// Настройка multer для аватара
const avatarStorage = multer.diskStorage({
  destination: 'public/avatars/',
  filename: (req, file, cb) => cb(null, req.user.discord_id + '_' + Date.now() + path.extname(file.originalname))
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/png','image/jpeg','image/gif'].includes(file.mimetype))
      return cb(new Error('Только изображения'));
    cb(null, true);
  }
}).single('avatar');

// Профиль
router.get('/profile', ensureAuth, async (req, res) => {
  const modules = await models.getModulesByUser(req.user.id);
  const avgRating = await models.getUserAverageRating(req.user.id);
  const ratingCount = await models.getUserRatingCount(req.user.id);
  res.render('profile', { user: req.user, modules, avgRating, ratingCount });
});

// Загрузка аватара
router.post('/profile/avatar', ensureAuth, (req, res) => {
  avatarUpload(req, res, async (err) => {
    if (err) return res.send(err.message);
    if (!req.file) return res.send('Файл не выбран');
    const filePath = '/avatars/' + req.file.filename;
    await models.setCustomAvatar(req.user.discord_id, filePath);
    req.user.custom_avatar = filePath;
    res.redirect('/profile');
  });
});

// Форма загрузки модуля
router.get('/profile/upload', ensureAuth, (req, res) => {
  if (!req.user.minecraft_nickname) return res.redirect('/profile');
  res.render('upload', { user: req.user });
});

// Загрузка модуля
router.post('/profile/upload', ensureAuth, (req, res) => {
  screenshotUpload(req, res, async (err) => {
    if (err) return res.send(err.message);
    const name = req.body.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const description = req.body.description || '';
    const category = req.body.category || 'разное';
    try {
      const newModule = await models.createModule(req.user.id, name, description, category);
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          await models.addModuleScreenshot(newModule.id, file.path);
        }
      }
      res.redirect('/profile');
    } catch (e) {
      res.send(e.message === 'UNIQUE' ? 'Модуль с таким названием уже существует' : 'Ошибка базы данных');
    }
  });
});

// Привязка ника
router.post('/profile/link-request', ensureAuth, async (req, res) => {
  if (req.user.minecraft_nickname) return res.status(400).json({ error: 'Ник уже привязан' });
  const existing = await models.getPendingLink(req.user.discord_id);
  if (existing) return res.status(400).json({ error: 'Заявка уже активна, проверьте ЛС' });
  await models.createPendingLink(req.user.discord_id);
  try {
    const discordUser = await bot.users.fetch(req.user.discord_id);
    await discordUser.send('Привет! Чтобы привязать Minecraft-аккаунт, ответь на это сообщение своим ником (только латиница, цифры, подчёркивания).');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось отправить сообщение. Убедитесь, что вы разрешили личные сообщения от участников сервера.' });
  }
});

// Удаление модуля
router.post('/module/:id/delete', ensureAuth, async (req, res) => {
  const moduleId = parseInt(req.params.id);
  const mod = await models.getModuleById(moduleId);
  if (!mod) return res.status(404).render('error', { code: 404, user: req.user });
  if (mod.owner_id !== req.user.id) return res.status(403).render('error', { code: 403, user: req.user });
  const success = await models.deleteModule(moduleId, req.user.id);
  if (success) res.redirect('/profile');
  else res.status(404).render('error', { code: 404, user: req.user });
});

// Страница редактирования модуля
router.get('/module/:id/edit', ensureAuth, async (req, res) => {
  const moduleId = parseInt(req.params.id);
  const mod = await models.getModuleById(moduleId);
  if (!mod) return res.status(404).render('error', { code: 404, user: req.user });
  if (mod.owner_id !== req.user.id) return res.status(403).render('error', { code: 403, user: req.user });
  const screenshots = await models.getModuleScreenshots(moduleId);
  res.render('edit_module', { user: req.user, mod, screenshots });
});

// Сохранение изменений модуля
router.post('/module/:id/edit', ensureAuth, async (req, res) => {
  const moduleId = parseInt(req.params.id);
  const name = req.body.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const description = req.body.description || '';
  const mod = await models.getModuleById(moduleId);
  if (!mod) return res.status(404).render('error', { code: 404, user: req.user });
  if (mod.owner_id !== req.user.id) return res.status(403).render('error', { code: 403, user: req.user });
  await models.updateModule(moduleId, req.user.id, name, description);
  res.redirect('/profile');
});

// Загрузка дополнительных скриншотов при редактировании
router.post('/module/:id/screenshots', ensureAuth, (req, res) => {
  screenshotUpload(req, res, async (err) => {
    if (err) return res.send(err.message);
    const moduleId = parseInt(req.params.id);
    const mod = await models.getModuleById(moduleId);
    if (!mod || mod.owner_id !== req.user.id) return res.status(403).render('error', { code: 403, user: req.user });
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await models.addModuleScreenshot(moduleId, file.path);
      }
    }
    res.redirect(`/module/${moduleId}/edit`);
  });
});

// Удаление отдельного скриншота
router.post('/module/screenshot/:id/delete', ensureAuth, async (req, res) => {
  const screenshotId = parseInt(req.params.id);
  const db = await getDatabase();
  const stmt = db.prepare('SELECT * FROM module_screenshots WHERE id = ?');
  stmt.bind([screenshotId]);
  if (!stmt.step()) { stmt.free(); return res.status(404).render('error', { code: 404, user: req.user }); }
  const screenshot = stmt.getAsObject();
  stmt.free();
  const mod = await models.getModuleById(screenshot.module_id);
  if (!mod || mod.owner_id !== req.user.id) return res.status(403).render('error', { code: 403, user: req.user });
  await models.deleteModuleScreenshot(screenshotId);
  res.redirect(`/module/${screenshot.module_id}/edit`);
});

module.exports = router;