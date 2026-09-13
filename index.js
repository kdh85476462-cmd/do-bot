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

// 디스코드 클라이언트 설정 (메시지 감지를 위해 GuildMessages, MessageContent 권한 필요)
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
    // 1. /대시보드 명령어 실행 시 모달 출력
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === '대시보드') {
            const modal = new ModalBuilder()
                .setCustomId('dashboardModal')
                .setTitle('대시보드 메시지 설정');

            // 제목 입력 칸
            const titleInput = new TextInputBuilder()
                .setCustomId('titleInput')
                .setLabel('제목')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('제목을 입력하세요')
                .setRequired(true);

            // 내용 입력 칸
            const descriptionInput = new TextInputBuilder()
                .setCustomId('descriptionInput')
                .setLabel('내용')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('내용을 입력하세요')
                .setRequired(true);

            // 색코드 입력 칸
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

    // 2. 모달 제출 시 처리
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

            // 모달 응답을 보낸 후 기존 메시지 정리를 유도
            await interaction.reply({ embeds: [embed] });
        }
    }
});

// 다른 사람이 메시지를 올렸을 때 이전 봇 메시지를 지우고 아래에 다시 올리는 처리
client.on('messageCreate', async message => {
    // 봇 자신이 보낸 메시지나 시스템 메시지는 무시
    if (message.author.bot) return;

    try {
        // 해당 채널의 최근 메시지 50개 가져오기
        const fetched = await message.channel.messages.fetch({ limit: 50 });
        
        // 봇이 이전에 보낸 임베드 메시지 찾기
        const botMessages = fetched.filter(m => m.author.id === client.user.id && m.embeds.length > 0);

        if (botMessages.size > 0) {
            // 가장 최근에 봇이 올렸던 임베드 메세지 가져오기
            const lastBotMessage = botMessages.first();
            const lastEmbed = lastBotMessage.embeds[0];

            // 이전 봇 메시지 삭제
            await lastBotMessage.delete().catch(() => {});

            // 채널 맨 아래에 동일한 임베드 다시 전송
            await message.channel.send({ embeds: [EmbedBuilder.from(lastEmbed)] });
        }
    } catch (error) {
        console.error('메시지 재전송 에러:', error);
    }
});

client.login(TOKEN);