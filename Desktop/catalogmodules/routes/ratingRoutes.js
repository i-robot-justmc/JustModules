const router = require('express').Router();
const models = require('../models');

// Список всех пользователей
router.get('/users', async (req, res) => {
    const users = await models.getAllUsers();
    for (let u of users) {
        u.avgRating = await models.getUserAverageRating(u.id);
        u.ratingCount = await models.getUserRatingCount(u.id);
    }
    res.render('users', { user: req.user, users });
});

// Публичный профиль пользователя (исправлено)
router.get('/user/:id', async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) return res.status(400).send('Неверный ID');

    const target = await models.getUserById(userId);
    if (!target) return res.status(404).send('Пользователь не найден');

    const avgRating = await models.getUserAverageRating(target.id);
    const ratingCount = await models.getUserRatingCount(target.id);
    const comments = await models.getCommentsByUser(target.id);

    res.render('user', {
        user: req.user,
        targetUser: target,
        avgRating,
        ratingCount,
        comments
    });
});

// Оценка пользователя (доступно авторизованным)
router.post('/user/:id/rate', async (req, res) => {
    if (!req.user) return res.status(403).send('Авторизуйтесь');
    const userId = parseInt(req.params.id, 10);
    const score = parseInt(req.body.score, 10);
    if (isNaN(userId) || score < 1 || score > 5) return res.status(400).send('Неверные данные');

    await models.addRating(req.user.id, userId, score);
    res.redirect(`/user/${userId}`);
});

// Комментарий (доступно авторизованным)
router.post('/user/:id/comment', async (req, res) => {
    if (!req.user) return res.status(403).send('Авторизуйтесь');
    const userId = parseInt(req.params.id, 10);
    const text = req.body.text.trim();
    if (!text) return res.status(400).send('Комментарий не может быть пустым');

    await models.addComment(req.user.id, userId, text);
    res.redirect(`/user/${userId}`);
});

module.exports = router;