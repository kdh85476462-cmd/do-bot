const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const express = require('express');

// Express 웹 서버 가동 (Render용)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is running!');
});

app.listen(PORT, () => {
    console.log(`웹 서버가 포트 ${PORT}에서 작동 중입니다.`);
});

// 디스코드 클라이언트 설정
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// 슬래시 명령어 정의 (/대시보드)
const commands = [
    new SlashCommandBuilder()
        .setName('대시보드')
        .setDescription('임베드 메시지를 작성하는 모달 창을 열어줍니다.')
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

// 명령어 등록 및 봇 준비
client.once('ready', async () => {
    console.log(`봇 로그인 성공: ${client.user.tag}`);
    try {
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        console.log('슬래시 명령어 등록 완료!');
    } catch (error) {
        console.error('명령어 등록 에러:', error);
    }
});

// 상호작용 처리
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === '대시보드') {
            const modal = new ModalBuilder()
                .setCustomId('dashboardModal')
                .setTitle('대시보드 메시지 설정');

            const titleInput = new TextInputBuilder()
                .setCustomId('titleInput')
                .setLabel('제목')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('제목을 입력하세요')
                .setRequired(true);

            const descriptionInput = new TextInputBuilder()
                .setCustomId('descriptionInput')
                .setLabel('내용')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('내용을 입력하세요')
                .setRequired(true);

            const colorInput = new TextInputBuilder()
                .setCustomId('colorInput')
                .setLabel('색코드')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('예: #FF0000')
                .setRequired(false);

            const row1 = new ActionRowBuilder().addComponents(titleInput);
            const row2 = new ActionRowBuilder().addComponents(descriptionInput);
            const row3 = new ActionRowBuilder().addComponents(colorInput);

            modal.addComponents(row1, row2, row3);

            await interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'dashboardModal') {
            const title = interaction.fields.getTextInputValue('titleInput');
            const description = interaction.fields.getTextInputValue('descriptionInput');
            let color = interaction.fields.getTextInputValue('colorInput') || '#5865F2';

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description);

            try {
                if (!color.startsWith('#') && color.length === 6 && /^[0-9A-Fa-f]{6}$/.test(color)) {
                    color = `#${color}`;
                }
                embed.setColor(color);
            } catch (err) {
                embed.setColor('#5865F2');
            }

            await interaction.reply({ embeds: [embed] });
        }
    }
});

// 메시지가 올라올 때 이전 임베드를 삭제하고 맨 아래로 재전송
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    try {
        const fetched = await message.channel.messages.fetch({ limit: 30 });
        
        // 봇이 올렸던 메시지 중 임베드가 포함된 메시지 찾기
        const botMessages = fetched.filter(m => m.author.id === client.user.id && m.embeds.length > 0);

        if (botMessages.size > 0) {
            const lastBotMessage = botMessages.first();
            const lastEmbed = lastBotMessage.embeds[0];

            // 1. 이전 임베드 메시지 삭제
            await lastBotMessage.delete();

            // 2. 새로운 임베드로 아래에 다시 전송
            await message.channel.send({ embeds: [EmbedBuilder.from(lastEmbed)] });
        }
    } catch (error) {
        console.error('메시지 재전송 처리 중 에러:', error);
    }
});

client.login(TOKEN);