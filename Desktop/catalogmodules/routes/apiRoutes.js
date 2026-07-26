const router = require('express').Router();
const config = require('../config');
const models = require('../models');

const ROLE_PRIORITY = {
  'admin': 1, 'dev': 2, 'sr.mod': 3, 'mod': 4, 'support': 6,
  'nova': 7, 'galaxy': 8, 'star': 9, 'planet': 10, 'moon': 11, 'meteor': 12
};

function getHighestRole(roles) {
  if (!Array.isArray(roles)) return 'None';
  const matched = roles
    .map(r => r.toLowerCase())
    .filter(r => r in ROLE_PRIORITY)
    .sort((a, b) => ROLE_PRIORITY[a] - ROLE_PRIORITY[b]);
  return matched[0] || 'None';
}

router.post('/bot/link', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== config.botApiKey) return res.status(403).json({ error: 'Forbidden' });
  const { discordId, nickname } = req.body;
  if (!discordId || !nickname) return res.status(400).json({ error: 'discordId and nickname required' });

  await models.setMinecraftNickname(discordId, nickname);
  try {
    const apiRes = await fetch(`https://website.justmc.io/user/${nickname}`);
    if (apiRes.ok) {
      const data = await apiRes.json();
      const highest = getHighestRole(data.roles || []);
      await models.setHighestRole(discordId, highest);
    } else {
      await models.setHighestRole(discordId, 'None');
    }
  } catch (err) {
    await models.setHighestRole(discordId, 'None');
  }
  res.json({ success: true });
});

module.exports = router;