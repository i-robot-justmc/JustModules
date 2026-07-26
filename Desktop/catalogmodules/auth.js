const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const config = require('./config');
const models = require('./models');

passport.serializeUser((user, done) => {
  done(null, user.discord_id);
});

passport.deserializeUser(async (discordId, done) => {
  try {
    const user = await models.getUserByDiscordId(discordId);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

passport.use(new DiscordStrategy({
  clientID: config.clientId,
  clientSecret: config.clientSecret,
  callbackURL: config.redirectUri,
  scope: ['identify']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await models.getUserByDiscordId(profile.id);
    if (!user) {
      user = await models.createUser(
        profile.id,
        profile.username,
        `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
      );
    }
    done(null, user);
  } catch (err) {
    done(err);
  }
}));

module.exports = passport;