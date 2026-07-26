const router = require('express').Router();
const models = require('../models');

function ensureAdmin(req, res, next) {
    if (!req.isAuthenticated()) return res.redirect('/auth/discord');
    if (req.user.discord_username !== 'sk1mix_justmc') {
        return res.status(403).send('Доступ запрещён');
    }
    next();
}

router.get('/admin', ensureAdmin, async (req, res) => {
    const modules = await models.getAllModulesAdmin();
    const users = await models.getAllUsers();
    res.render('admin', { user: req.user, modules, users });
});

router.post('/admin/module/:id/delete', ensureAdmin, async (req, res) => {
    const mod = await models.getModuleById(req.params.id);
    if (mod) await models.deleteModule(mod.id, mod.owner_id);
    res.redirect('/admin');
});

router.post('/admin/user/:id/ban', ensureAdmin, async (req, res) => {
    await models.deleteUser(req.params.id);
    res.redirect('/admin');
});

module.exports = router;