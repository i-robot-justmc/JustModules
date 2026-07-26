const express = require('express');
const session = require('express-session');
const path = require('path');
const config = require('./config');
const passport = require('./auth');

const authRoutes = require('./routes/authRoutes');
const mainRoutes = require('./routes/mainRoutes');
const profileRoutes = require('./routes/profileRoutes');
const apiRoutes = require('./routes/apiRoutes');
const ratingRoutes = require('./routes/ratingRoutes');
const bot = require('./bot');

const app = express();

// Сессии и Passport
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false
}));
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

// Статические файлы загрузок
app.use('/uploads', express.static('uploads'));

// Запуск
app.listen(config.port, () => {
  console.log(`Сервер запущен на http://localhost:${config.port}`);
});

bot.login(config.botToken);