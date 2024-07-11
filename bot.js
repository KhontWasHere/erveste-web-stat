const { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, Events } = require('discord.js');
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const User = require('./models/User');
const GiveawayParticipant = require('./models/GiveawayParticipant');
const { token, clientId, guildId, mongoUri, leaderboardChannelName, giveawayChannelName } = require('./config.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences
    ]
});
const app = express();
const port = 3000;
/////caldasatmasikmiyimsonra/////caldasatmasikmiyimsonra/////caldasatmasikmiyimsonra/////caldasatmasikmiyimsonra/////caldasatmasikmiyimsonra/////caldasatmasikmiyimsonra/////caldasatmasikmiyimsonra/////caldasatmasikmiyimsonra
mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB bağlantısı kuruldu'))
    .catch(err => console.error('MongoDB bağlantı hatası:', err));

let leaderboardMessageId = null;
let giveawayMessageId = null;
let giveawayParticipants = [];
let lastJoinedMember = null;
let lastLeftMember = null;

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    client.guilds.cache.get(guildId).invites.fetch().then(invites => {
        client.invites = invites;
    });

    setInterval(async () => {
        const channel = await findChannelByName(leaderboardChannelName);
        if (channel) {
            await updateLeaderboard(channel);
        }
    }, 60000);
});

let voiceTimes = {};
/////caldasatmasikmiyimsonra/////caldasatmasikmiyimsonra/////caldasatmasikmiyimsonra/////caldasatmasikmiyimsonra
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const userId = message.author.id;
    await User.findOneAndUpdate(
        { userId },
        { $inc: { messages: 1 } },
        { new: true, upsert: true }
    );

    if (message.content.startsWith('!giveaway')) {
        const args = message.content.split(' ');
        if (args.length < 3) {
            message.reply('Lütfen geçerli bir süre ve başlık girin. Örneğin: `!giveaway 1h title Çekiliş Başlığı desc Çekiliş Açıklaması`');
            return;
        }
        const duration = args[1];
        const titleIndex = args.indexOf('title');
        const descIndex = args.indexOf('desc');
        const title = titleIndex !== -1 ? args.slice(titleIndex + 1, descIndex).join(' ') : 'Çekiliş';
        const description = descIndex !== -1 ? args.slice(descIndex + 1).join(' ') : 'Çekilişe katılın ve kazanma şansını yakalayın!';

        const channel = await findChannelByName(giveawayChannelName);
        if (channel) {
            await startGiveaway(channel, duration, title, description);
        }
    }
});

client.on('inviteCreate', async invite => {
    client.invites.set(invite.code, invite);
});

client.on('guildMemberAdd', async member => {
    const newInvites = await member.guild.invites.fetch();
    const oldInvites = client.invites;
    const invite = newInvites.find(i => i.uses > (oldInvites.get(i.code)?.uses || 0));

    if (invite) {
        const inviterId = invite.inviter.id;
        await User.findOneAndUpdate(
            { userId: inviterId },
            { $inc: { invites: 1 } },
            { new: true, upsert: true }
        );
        client.invites = newInvites;
    }

    lastJoinedMember = member.user.tag;
});

client.on('guildMemberRemove', member => {
    lastLeftMember = member.user.tag;
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = newState.id;

    if (newState.channelId && !oldState.channelId) {
        voiceTimes[userId] = Date.now();
    } else if (!newState.channelId && oldState.channelId) {
        if (voiceTimes[userId]) {
            const timeSpent = Date.now() - voiceTimes[userId];
            await User.findOneAndUpdate(
                { userId },
                { $inc: { voice: timeSpent } },
                { new: true, upsert: true }
            );
            delete voiceTimes[userId];
        }
    }
});

client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isButton()) {
        if (interaction.customId === 'enter_giveaway') {
            if (!giveawayParticipants.includes(interaction.user.id)) {
                giveawayParticipants.push(interaction.user.id);
                await GiveawayParticipant.create({
                    userId: interaction.user.id,
                    username: interaction.user.tag,
                    giveawayId: giveawayMessageId
                });
                await interaction.reply({ content: 'Çekilişe katıldınız!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'Zaten çekilişe katıldınız!', ephemeral: true });
            }
        }
    }
});

async function updateLeaderboard(channel) {
    const topMessages = await User.find().sort({ messages: -1 }).limit(10);
    const topInvites = await User.find().sort({ invites: -1 }).limit(10);
    const topVoice = await User.find().sort({ voice: -1 }).limit(10);

    let messageLeaderboard = 'Mesaj Sıralaması:\n';
    for (let i = 0; i < topMessages.length; i++) {
        if (!topMessages[i].userId) continue;
        let user = await client.users.fetch(topMessages[i].userId).catch(() => null);
        if (user) {
            messageLeaderboard += `${i + 1}. ${user.tag} - Mesajlar: ${topMessages[i].messages}\n`;
        }
    }

    let inviteLeaderboard = 'Davet Sıralaması:\n';
    for (let i = 0; i < topInvites.length; i++) {
        if (!topInvites[i].userId) continue;
        let user = await client.users.fetch(topInvites[i].userId).catch(() => null);
        if (user) {
            inviteLeaderboard += `${i + 1}. ${user.tag} - Davetler: ${topInvites[i].invites}\n`;
        }
    }

    let voiceLeaderboard = 'Ses Süresi Sıralaması:\n';
    for (let i = 0; i < topVoice.length; i++) {
        if (!topVoice[i].userId) continue;
        let user = await client.users.fetch(topVoice[i].userId).catch(() => null);
        if (user) {
            let voiceTime = Math.floor(topVoice[i].voice / 60000);
            voiceLeaderboard += `${i + 1}. ${user.tag} - Ses Süresi: ${voiceTime} dakika\n`;
        }
    }

    const guild = client.guilds.cache.get(guildId);
    let imageUrl = guild.splashURL({ size: 2048 }) || guild.bannerURL({ size: 2048 }) || guild.iconURL({ size: 2048 });

    if (!imageUrl) {
        imageUrl = 'https://via.placeholder.com/2048x1152.png?text=No+Server+Banner';
    }

    const embed = new EmbedBuilder()
        .setTitle('Lider Tablosu')
        .setDescription(`${messageLeaderboard}\n${inviteLeaderboard}\n${voiceLeaderboard}`)
        .setImage(imageUrl)
        .setFooter({ text: `Son güncelleme: ${new Date().toLocaleString()}` })
        .setColor('#00FF00');

    try {
        if (leaderboardMessageId) {
            const leaderboardMessage = await channel.messages.fetch(leaderboardMessageId).catch(() => null);
            if (leaderboardMessage) {
                await leaderboardMessage.edit({ embeds: [embed] });
            } else {
                const newMessage = await channel.send({ embeds: [embed] });
                leaderboardMessageId = newMessage.id;
            }
        } else {
            const newMessage = await channel.send({ embeds: [embed] });
            leaderboardMessageId = newMessage.id;
        }
    } catch (error) {
        console.error('Lider tablosu güncellenirken bir hata oluştu:', error);
    }
}

async function findChannelByName(name) {
    const guild = client.guilds.cache.get(guildId);
    const channel = guild.channels.cache.find(channel => channel.name === name && channel.type === 0);
    if (!channel) {
        console.error(`Channel with name ${name} not found`);
    }
    return channel;
}

async function startGiveaway(channel, duration, title, description) {
    if (!duration) {
        console.error('Çekiliş süresi belirtilmedi.');
        return;
    }

    giveawayParticipants = [];
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor('#FF0000');

    const button = new ButtonBuilder()
        .setCustomId('enter_giveaway')
        .setLabel('Katıl')
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder()
        .addComponents(button);

    const message = await channel.send({
        embeds: [embed],
        components: [row]
    });

    giveawayMessageId = message.id;

    setTimeout(async () => {
        if (giveawayParticipants.length > 0) {
            const winnerId = giveawayParticipants[Math.floor(Math.random() * giveawayParticipants.length)];
            const winner = await client.users.fetch(winnerId);

            await channel.send(`🎉 Tebrikler ${winner.tag}, çekilişi kazandınız!`);
        } else {
            await channel.send('Çekilişe katılan olmadı.');
        }
    }, parseDuration(duration));
}

function parseDuration(duration) {
    if (!duration) return 0;

    const regex = /(\d+)([smhd])/;
    const match = duration.match(regex);
    if (!match) return 0;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
        case 's': return value * 1000;
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        default: return 0;
    }
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', async (req, res) => {
    const topMessages = await User.find().sort({ messages: -1 }).limit(10);
    const topInvites = await User.find().sort({ invites: -1 }).limit(10);
    const topVoice = await User.find().sort({ voice: -1 }).limit(10);
    const guild = client.guilds.cache.get(guildId);
    const totalMembers = guild.memberCount;
    const onlineMembers = guild.members.cache.filter(member => member.presence && member.presence.status !== 'offline').size;/////caldasatmasikmiyimsonra/////caldasatmasikmiyimsonra/////caldasatmasikmiyimsonra/////caldasatmasikmiyimsonra/////caldasatmasikmiyimsonra/////caldasatmasikmiyimsonra
    
    let messageLeaderboard = '<h2>Mesaj Sıralaması:</h2><ul>';
    for (let i = 0; i < topMessages.length; i++) {
        if (!topMessages[i].userId) continue;
        let user = await client.users.fetch(topMessages[i].userId).catch(() => null);
        if (user) {
            messageLeaderboard += `<li>${i + 1}. ${user.tag} - Mesajlar: ${topMessages[i].messages}</li>`;
        }
    }
    messageLeaderboard += '</ul>';

    let inviteLeaderboard = '<h2>Davet Sıralaması:</h2><ul>';
    for (let i = 0; i < topInvites.length; i++) {
        if (!topInvites[i].userId) continue;
        let user = await client.users.fetch(topInvites[i].userId).catch(() => null);
        if (user) {
            inviteLeaderboard += `<li>${i + 1}. ${user.tag} - Davetler: ${topInvites[i].invites}</li>`;
        }
    }
    inviteLeaderboard += '</ul>';

    let voiceLeaderboard = '<h2>Ses Süresi Sıralaması:</h2><ul>';/////caldasatmasikmiyimsonra
    for (let i = 0; i < topVoice.length; i++) {
        if (!topVoice[i].userId) continue;
        let user = await client.users.fetch(topVoice[i].userId).catch(() => null);
        if (user) {
            let voiceTime = Math.floor(topVoice[i].voice / 60000);
            voiceLeaderboard += `<li>${i + 1}. ${user.tag} - Ses Süresi: ${voiceTime} dakika</li>`;
        }
    }
    voiceLeaderboard += '</ul>';/////caldasatmasikmiyimsonra

    let joinedMemberHtml = lastJoinedMember ? `<p>Son Giren Üye: ${lastJoinedMember}</p>` : '<p>Son Giren Üye: Bilinmiyor</p>';
    let leftMemberHtml = lastLeftMember ? `<p>Son Çıkan Üye: ${lastLeftMember}</p>` : '<p>Son Çıkan Üye: Bilinmiyor</p>';

    const giveawayParticipantsList = await GiveawayParticipant.find({ giveawayId: giveawayMessageId });

    let giveawayParticipantsHtml = '<h2>Çekilişe Katılanlar:</h2><ul>';
    giveawayParticipantsList.forEach(participant => {
        giveawayParticipantsHtml += `<li>${participant.username}</li>`;
    });
    giveawayParticipantsHtml += '</ul>';

    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>En İyi 10 Kullanıcı</title>
            <link rel="stylesheet" href="/styles.css">
            <style>
                body {
                    font-family: 'Roboto', sans-serif;
                    background-color: #121212;
                    color: #ffffff;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                }
                .container {
                    background: #1e1e1e;
                    padding: 40px;
                    border-radius: 10px;
                    box-shadow: 0 0 20px rgba(0, 0, 0, 0.7);
                    max-width: 1200px;
                    width: 100%;
                    display: flex;
                    flex-wrap: wrap;
                }
                .column {
                    flex: 1;
                    min-width: 300px;
                    margin: 10px;
                }
                h1 {
                    text-align: center;
                    color: #00FF00;
                    margin-bottom: 20px;
                    width: 100%;
                }
                h2 {
                    color: #00FF00;
                    margin-top: 30px;
                }
                ul {
                    list-style-type: none;
                    padding: 0;
                    max-height: 300px;
                    overflow-y: auto;
                }
                li {
                    padding: 10px;
                    border-bottom: 1px solid #444;
                }
                li:last-child {
                    border-bottom: none;
                }
                li:nth-child(even) {
                    background-color: #333;
                }
                p {
                    text-align: center;
                    font-weight: bold;
                    color: #00FF00;
                }
                .scrollable {
                    max-height: 300px;
                    overflow-y: auto;                      
                }
                @media (max-width: 600px) {
                    .container {
                        flex-direction: column;
                        padding: 20px;
                    }
                    h1, h2 {
                        font-size: 1.5em;
                    }
                    ul {
                        max-height: 200px;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>En İyi 10 Kullanıcı</h1>
                <div class="column">
                    ${messageLeaderboard}
                </div>
                <div class="column">
                    ${inviteLeaderboard}
                </div>
                <div class="column">
                    ${voiceLeaderboard}
                </div>
                <div class="column">
                    <h2>Sunucu İstatistikleri</h2>
                    <p>Toplam Üye Sayısı: ${totalMembers}</p>
                    <p>Çevrimiçi Üye Sayısı: ${onlineMembers}</p>
                    ${joinedMemberHtml}
                    ${leftMemberHtml}
                    ${giveawayParticipantsHtml}
                </div>
            </div>
        </body>
        </html>
    `;

    res.send(html);
});/////caldasatmasikmiyimsonra

app.listen(port, () => {
    console.log(`Web server is running at http://localhost:${port}`);
});

client.login(token);

/////caldasatmasikmiyimsonra