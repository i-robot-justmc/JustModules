passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: "/auth/discord/callback",
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    // найти или создать пользователя в БД по profile.id
    User.findOrCreate({ discordId: profile.id }, {
        discordUsername: profile.username,
        avatar: profile.avatar
    }).then(user => done(null, user));
}));