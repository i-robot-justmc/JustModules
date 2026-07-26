const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config');
const models = require('./models');

const client = new Client({
    intents: [
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel] // обязательно для DM
});

client.once('ready', () => {
    console.log(`🤖 Бот ${client.user.tag} готов к работе`);
});

client.on('messageCreate', async (message) => {
    // Игнорируем ботов и сообщения не в ЛС
    if (message.author.bot) return;
    if (message.channel.type !== 1) return; // 1 = DM в discord.js v14

    const discordId = message.author.id;
    const pending = await models.getPendingLink(discordId);
    if (!pending) return; // нет активной заявки

    const nickname = message.content.trim();
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(nickname)) {
        return message.reply('❌ Некорректный никнейм. Только латиница, цифры, подчёркивания, 3-16 символов.');
    }

    // Завершаем привязку через внутренний API
    try {
        const res = await fetch(`http://localhost:${config.port}/api/bot/link`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': config.botApiKey
            },
            body: JSON.stringify({ discordId, nickname })
        });
        if (res.ok) {
            await models.deactivatePendingLink(pending.id);
            message.reply(`✅ Никнейм **${nickname}** успешно привязан!`);
        } else {
            const data = await res.json();
            message.reply(`❌ Ошибка: ${data.error || 'неизвестная ошибка'}`);
        }
    } catch (err) {
        console.error(err);
        message.reply('❌ Внутренняя ошибка сервера.');
    }
});

module.exports = client;