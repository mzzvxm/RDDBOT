const { 
  Client, 
  GatewayIntentBits,
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
  Partials,
  TextInputStyle
} = require('discord.js');

const axios = require('axios');

const DISCORD_BOT_TOKEN = 'DISCORD_BOT_TOKEN';
const REAL_DEBRID_TOKEN = 'RD_TOKEN';

const CANAL_FIXO_ID = 'CHANNEL_HE_WILL_STAY';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

client.once(Events.ClientReady, () => {
  console.log(`Bot online como ${client.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.content.toLowerCase() === '!iniciar') {
    if (message.channel.id !== CANAL_FIXO_ID) {
      return message.reply(`Por favor, use o comando neste canal específico!`);
    }

    // Deletar mensagens antigas do bot nesse canal
    const mensagens = await message.channel.messages.fetch({ limit: 20 });
    const minhasMensagens = mensagens.filter(m => m.author.id === client.user.id);
    await Promise.all(minhasMensagens.map(m => m.delete().catch(() => {})));

    // Embed inicial mais bonita
    const embed = new EmbedBuilder()
      .setTitle('🎉 Bem-vindo ao Bot Real-Debrid')
      .setDescription(
        'Selecione uma das opções abaixo para enviar seu link:\n\n' +
        '**🔹 Comum:** Link direto (MediaFire, Mega, 1fichier etc)\n' +
        '**🧲 Torrent:** Link magnet torrent\n' +
        '**❓ Ajuda:** Informações e suporte'
      )
      .setColor('#0099ff')
      .setThumbnail('https://i.pinimg.com/736x/43/88/8a/43888a921b45fa1dc71e6733ebda2159.jpg') // Exemplo de thumbnail (pode trocar)
      .setFooter({ text: 'Bot Real-Debrid - Seu assistente de links' })
      .setTimestamp();

    // Botões Comum, Torrent e Ajuda juntos na mesma linha
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('comum')
          .setLabel('Comum')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔹'),
        new ButtonBuilder()
          .setCustomId('torrent')
          .setLabel('Torrent')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🧲'),
        new ButtonBuilder()
          .setCustomId('ajuda')
          .setLabel('Ajuda')
          .setStyle(ButtonStyle.Success)
          .setEmoji('❓')
      );

    // Enviar embed + botões (SEM mensagem de confirmação para o autor)
    await message.channel.send({ embeds: [embed], components: [row] });
  }
});

// Handler dos botões incluindo o botão Ajuda
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'comum') {
    const modal = new ModalBuilder()
      .setCustomId('modalComum')
      .setTitle('Processar Link Comum')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('linkComum')
            .setLabel('Insira o link:')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

    await interaction.showModal(modal);
  }

  if (interaction.customId === 'torrent') {
    const modal = new ModalBuilder()
      .setCustomId('modalTorrent')
      .setTitle('Processar Link Torrent')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('linkTorrent')
            .setLabel('Insira o link magnet:')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

    await interaction.showModal(modal);
  }

  if (interaction.customId === 'ajuda') {
    // Embed de ajuda via botão
    const ajudaEmbed = new EmbedBuilder()
      .setTitle('🤖 Ajuda do Bot Real-Debrid')
      .setDescription('Este bot permite processar links comuns e torrents via Real-Debrid.')
      .addFields(
        { name: 'Comandos:', value: '`!iniciar` - Envia mensagem inicial com botões\n`!ajuda` - Mostra esta mensagem' },
        { name: 'Hosts Suportados:', value: 'MediaFire, Mega, 1fichier, Zippyshare e outros.' },
        { name: 'Status do Bot:', value: '🟢 Online' }
      )
      .setColor('#00AE86')
      .setFooter({ text: 'Bot Real-Debrid' })
      .setTimestamp();

    await interaction.reply({ content: 'Mensagem', flags: 1 << 6 });
  }
});

// Resto do código dos modais e processamento de links (permanece igual)
// ...

// Comando de ajuda via texto (opcional)
client.on(Events.MessageCreate, async (message) => {
  if (message.content.toLowerCase() === '!ajuda') {
    const embed = new EmbedBuilder()
      .setTitle('🤖 Ajuda do Bot')
      .setDescription('Este bot permite processar links comuns e torrents via Real-Debrid.')
      .addFields(
        { name: 'Comandos:', value: '`!iniciar` - Envia mensagem inicial com botões\n`!ajuda` - Mostra esta mensagem' },
        { name: 'Hosts Suportados:', value: 'MediaFire, Mega, 1fichier, Zippyshare e outros.' },
        { name: 'Status do Bot:', value: '🟢 Online' }
      )
      .setColor(0x00AE86);

    await message.channel.send({ embeds: [embed] });
  }
});

client.login(DISCORD_BOT_TOKEN);
