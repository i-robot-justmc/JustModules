const router = require('express').Router();
const models = require('../models');

router.get('/', async (req, res) => {
  const { search, category, sort } = req.query;
  const modules = await models.getFilteredModules({ search, category, sort });
  const categories = await models.getCategories();
  const recommended = await models.getRecommendedModules(4);
  res.render('index', {
    user: req.user,
    modules,
    categories,
    recommended,
    currentCategory: category || 'all',
    currentSort: sort || 'newest',
    search: search || ''
  });
});

router.get('/module/:id', async (req, res) => {
  const mod = await models.getModuleById(req.params.id);
  if (!mod) return res.status(404).render('error', { code: 404, user: req.user });
  const screenshots = await models.getModuleScreenshots(mod.id);
  const avgRating = await models.getModuleAverageRating(mod.id);
  const ratingCount = await models.getModuleRatingCount(mod.id);
  const comments = await models.getModuleComments(mod.id);
  const isFav = req.user ? await models.isFavorite(req.user.id, mod.id) : false;
  res.render('module', {
    user: req.user,
    mod,
    screenshots,
    avgRating,
    ratingCount,
    comments,
    isFavorite: isFav
  });
});

router.post('/module/:id/rate', async (req, res) => {
  if (!req.user) return res.status(403).send('Авторизуйтесь');
  const moduleId = parseInt(req.params.id, 10);
  const score = parseInt(req.body.score, 10);
  if (isNaN(moduleId) || score < 1 || score > 5) return res.status(400).send('Неверные данные');
  await models.addModuleRating(req.user.id, moduleId, score);
  res.redirect(`/module/${moduleId}`);
});

router.post('/module/:id/comment', async (req, res) => {
  if (!req.user) return res.status(403).send('Авторизуйтесь');
  const moduleId = parseInt(req.params.id, 10);
  const text = req.body.text.trim();
  if (!text) return res.status(400).send('Комментарий не может быть пустым');
  await models.addModuleComment(req.user.id, moduleId, text);
  res.redirect(`/module/${moduleId}`);
});

router.post('/module/:id/favorite', async (req, res) => {
  if (!req.user) return res.status(403).send('Авторизуйтесь');
  const moduleId = parseInt(req.params.id, 10);
  const isFav = await models.isFavorite(req.user.id, moduleId);
  if (isFav) await models.removeFavorite(req.user.id, moduleId);
  else await models.addFavorite(req.user.id, moduleId);
  res.redirect(`/module/${moduleId}`);
});

router.get('/favorites', async (req, res) => {
  if (!req.user) return res.redirect('/auth/discord');
  const modules = await models.getFavorites(req.user.id);
  res.render('favorites', { user: req.user, modules });
});

module.exports = router;