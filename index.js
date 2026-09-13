const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    EmbedBuilder 
} = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildEmojisAndStickers // 이모지 정보를 읽어오기 위한 권한
    ]
});

const channelData = new Map();

// 입력된 텍스트 중 :이모지이름: 형태를 봇이 참가한 서버의 진짜 이모지 코드로 자동 변환하는 함수
function parseCustomEmojis(text, client) {
    if (!text) return text;
    
    // :이모지이름: 패턴 찾기 (이미 <:이름:ID> 형식인 것은 제외)
    return text.replace(/(?<!<a?:):([a-zA-Z0-9_]+):(?![0-9]+>)/g, (match, emojiName) => {
        // 봇이 들어있는 모든 서버에서 해당 이름을 가진 이모지 검색
        const emoji = client.emojis.cache.find(e => e.name === emojiName);
        if (emoji) {
            return emoji.toString(); // <a:name:id> 또는 <:name:id> 반환
        }
        return match; // 못 찾으면 원래 텍스트 유지
    });
}

const commands = [
    new SlashCommandBuilder()
        .setName('대시보드')
        .setDescription('현재 채널의 고정 안내 메시지를 설정합니다.')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
    console.log(`봇 로그인 성공: ${client.user.tag}`);

    try {
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        console.log('슬래시 명령어 등록 완료!');
    } catch (error) {
        console.error('슬래시 명령어 등록 실패:', error);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === '대시보드') {
            const modal = new ModalBuilder()
                .setCustomId('dashboard_modal')
                .setTitle('대시보드 메시지 설정');

            const titleInput = new TextInputBuilder()
                .setCustomId('modal_title')
                .setLabel('Title')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('제목을 입력하세요 (이모지 지원)')
                .setRequired(true);

            const descInput = new TextInputBuilder()
                .setCustomId('modal_desc')
                .setLabel('Description')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('내용을 입력하세요 (이모지 지원)')
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(titleInput),
                new ActionRowBuilder().addComponents(descInput)
            );

            await interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'dashboard_modal') {
            let title = interaction.fields.getTextInputValue('modal_title');
            let description = interaction.fields.getTextInputValue('modal_desc');
            const channelId = interaction.channelId;

            // 이모지 자동 변환 적용
            title = parseCustomEmojis(title, client);
            description = parseCustomEmojis(description, client);

            const currentData = channelData.get(channelId);
            if (currentData && currentData.lastMessageId) {
                try {
                    const oldMsg = await interaction.channel.messages.fetch(currentData.lastMessageId);
                    if (oldMsg) await oldMsg.delete();
                } catch (e) {}
            }

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor(0x5865F2);

            await interaction.reply({ content: '현재 채널에 안내 메시지가 설정되었습니다!', ephemeral: true });

            const sentMessage = await interaction.channel.send({ embeds: [embed] });

            channelData.set(channelId, {
                title,
                description,
                lastMessageId: sentMessage.id
            });
        }
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const channelId = message.channelId;
    const config = channelData.get(channelId);

    if (config) {
        try {
            if (config.lastMessageId) {
                try {
                    const oldMsg = await message.channel.messages.fetch(config.lastMessageId);
                    if (oldMsg) await oldMsg.delete();
                } catch (e) {}
            }

            const embed = new EmbedBuilder()
                .setTitle(config.title)
                .setDescription(config.description)
                .setColor(0x5865F2);

            const newMsg = await message.channel.send({ embeds: [embed] });

            config.lastMessageId = newMsg.id;
            channelData.set(channelId, config);

        } catch (error) {
            console.error('메시지 갱신 중 오류 발생:', error);
        }
    }
});

client.login(TOKEN);
// Render가 봇을 웹 서비스로 인식할 수 있도록 가짜 웹서버(Express) 가동
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is running!');
});

app.listen(PORT, () => {
    console.log(`웹 서버가 포트 ${PORT}에서 작동 중입니다.`);
});