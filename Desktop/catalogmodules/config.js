require('dotenv').config();
module.exports = {
  clientId: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  botToken: process.env.DISCORD_BOT_TOKEN,
  redirectUri: process.env.DISCORD_REDIRECT_URI,
  botApiKey: process.env.BOT_API_KEY,
  sessionSecret: process.env.SESSION_SECRET,
  port: process.env.PORT || 3000
};