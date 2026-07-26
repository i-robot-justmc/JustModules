const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const path = require('path');
const fs = require('fs');
const passport = require('./auth');
const models = require('./models');

const authRoutes = require('./routes/authRoutes');
const mainRoutes = require('./routes/mainRoutes');
const profileRoutes = require('./routes/profileRoutes');
const apiRoutes = require('./routes/apiRoutes');
const ratingRoutes = require('./routes/ratingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const bot = require('./bot');

const app = express();

// Глобальные переменные для шаблонов
app.locals.models = models;

// Сессии
app.use(session({
  store: new FileStore({
    path: path.join(__dirname, 'sessions'),
    ttl: 30 * 24 * 60 * 60,
    retries: 0
  }),
  secret: process.env.SESSION_SECRET || 'default-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true
  }
}));

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Шаблонизатор
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Маршруты
app.use('/auth', authRoutes);
app.use('/', mainRoutes);
app.use('/', profileRoutes);
app.use('/', ratingRoutes);
app.use('/api', apiRoutes);
app.use('/', adminRoutes);

// Статические файлы загрузок (используем переменные окружения или пути по умолчанию)
const dataDir = process.env.DATA_DIR || __dirname;
const uploadsPath = process.env.UPLOADS_PATH || path.join(dataDir, 'uploads');
const avatarsPath = process.env.AVATARS_PATH || path.join(__dirname, 'public', 'avatars');

// Создаём папки, если их нет
[uploadsPath, avatarsPath].forEach(p => {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

app.use('/uploads', express.static(uploadsPath));
app.use('/avatars', express.static(avatarsPath));

// Запуск сервера
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});

// Запуск Discord-бота
if (process.env.DISCORD_BOT_TOKEN) {
  bot.login(process.env.DISCORD_BOT_TOKEN);
} else {
  console.error('DISCORD_BOT_TOKEN не установлен! Бот не запущен.');
}
