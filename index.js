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

// Flag para respostas efêmeras
const EPHEMERAL = 1 << 6;

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const REAL_DEBRID_TOKEN = process.env.REAL_DEBRID_TOKEN;
const CANAL_FIXO_ID = 'channel_id';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

// Helper: gera barra de progresso
const progressBar = (percent) => {
  const full = Math.round(percent / 10);
  const empty = 10 - full;
  return '▰'.repeat(full) + '▱'.repeat(empty) + ` ${percent.toFixed(1)}%`;
};

/**
 * Envia uma DM ao usuário com as mesmas opções de mensagem
 * @param {User} user — objeto Discord.js do usuário
 * @param {Object} options — mesmas opções usadas em send(): { content, embeds, components, flags }
 */
async function sendUserDM(user, options) {
  try {
    const dm = await user.createDM();
    await dm.send(options);
  } catch (err) {
    console.error(`❌ Não foi possível enviar DM para ${user.tag}:`, err);
  }
}

client.once(Events.ClientReady, () => {
  console.log(`Bot online como ${client.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.content.toLowerCase() === '!iniciar') {
    if (message.channel.id !== CANAL_FIXO_ID) return;

    // ... (código de limpeza de mensagens)

    const embed = new EmbedBuilder()
      .setTitle('🎉 Bem-vindo ao Bot Real-Debrid')
      .setDescription(
        'Selecione uma das opções abaixo para enviar seu link:\n\n' +
        '**🔹 Comum:** Link direto (MediaFire, Mega, 1fichier etc)\n' +
        '**🧲 Torrent:** Link magnet torrent\n' +
        '**☄️ Em Progresso:** Status de downloads atuais\n' +
        '**❓ Ajuda:** Informações e suporte'
      )
      .setColor('#0099ff')
      .setThumbnail('https://i.pinimg.com/736x/43/88/8a/43888a921b45fa1dc71e6733ebda2159.jpg')
      .setFooter({ text: 'Bot Real-Debrid - Seu assistente de links' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('comum').setLabel('Comum').setStyle(ButtonStyle.Primary).setEmoji('🔹'),
      new ButtonBuilder().setCustomId('torrent').setLabel('Torrent').setStyle(ButtonStyle.Secondary).setEmoji('🧲'),
      new ButtonBuilder().setCustomId('progress').setLabel('Em Progresso').setStyle(ButtonStyle.Success).setEmoji('☄️'),
      new ButtonBuilder().setCustomId('ajuda').setLabel('Ajuda').setStyle(ButtonStyle.Success).setEmoji('❓')
    );

    await message.channel.send({ embeds: [embed], components: [row] });
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  // Botões Comum / Torrent
  if (interaction.customId === 'comum' || interaction.customId === 'torrent') {
    const isTorrent = interaction.customId === 'torrent';
    const modal = new ModalBuilder()
      .setCustomId(isTorrent ? 'modalTorrent' : 'modalComum')
      .setTitle(isTorrent ? 'Processar Link Torrent' : 'Processar Link Comum')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId(isTorrent ? 'linkTorrent' : 'linkComum')
            .setLabel(isTorrent ? 'Insira o link magnet:' : 'Insira o link:')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
    await interaction.showModal(modal);
    return;
  }

  // Embed de Ajuda
  if (interaction.customId === 'ajuda') {
    const ajudaEmbed = new EmbedBuilder()
      .setAuthor({ name: '🆘 Central de Ajuda', iconURL: 'https://i.postimg.cc/Prs28Wt7/baixados.jpg' })
      .setColor('#0099ff')
      .setThumbnail('https://i.postimg.cc/Prs28Wt7/baixados.jpg')
      .setDescription('Aqui estão os principais comandos e informações:')
      .addFields(
        { name: '⚙️ Comandos', value: '`!iniciar` • Inicia o menu interativo\n`!ajuda` • Exibe esta mensagem' },
        { name: '📂 Hosts Suportados', value: 'MediaFire, Mega, 1fichier, Zippyshare…' },
        { name: '📡 Status', value: '🟢 Online', inline: true },
        { name: '❓ Suporte', value: 'Abra um ticket com `!suporte`', inline: true }
      )
      .setFooter({ text: 'Bot Real-Debrid — Perguntas? Estamos aqui!' })
      .setTimestamp();

    const ajudaRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Criador do Bot')
        .setStyle(ButtonStyle.Link)
        .setURL('https://github.com/mzzvxm')
    );

    await interaction.reply({ embeds: [ajudaEmbed], components: [ajudaRow], flags: EPHEMERAL });
    return;
  }

  // Torrents: últimos 3 + link direto + botão Download
  if (interaction.customId === 'progress') {
    await interaction.deferReply({ flags: EPHEMERAL });
    try {
      const { data } = await axios.get('https://api.real-debrid.com/rest/1.0/torrents', {
        headers: { Authorization: `Bearer ${REAL_DEBRID_TOKEN}` }
      });
      const recentes = data.sort((a, b) => b.id - a.id).slice(0, 3);

      if (!recentes.length) {
        await interaction.editReply({ content: '🔍 Nenhum torrent encontrado.', flags: EPHEMERAL });
        return;
      }

      // busca detalhes e link direto
      const detalhados = await Promise.all(recentes.map(async t => {
        const info = await axios.get(`https://api.real-debrid.com/rest/1.0/torrents/info/${t.id}`, {
          headers: { Authorization: `Bearer ${REAL_DEBRID_TOKEN}` }
        });
        let direct = null;
        if (info.data.links && info.data.links.length) {
          try {
            const unlock = await axios.post(
              'https://api.real-debrid.com/rest/1.0/unrestrict/link',
              new URLSearchParams({ link: info.data.links[0] }),
              { headers: { Authorization: `Bearer ${REAL_DEBRID_TOKEN}` } }
            );
            direct = unlock.data.download;
          } catch {
            // ignora erros de hoster_unavailable
          }
        }
        return { id: t.id, filename: t.filename, progress: t.progress, download: direct };
      }));

      const progressoEmbed = new EmbedBuilder()
        .setTitle('📊 Últimos 3 Torrents')
        .setColor('#0099ff')
        .setThumbnail('https://i.postimg.cc/Prs28Wt7/baixados.jpg')
        .setFooter({ text: 'Bot Real-Debrid - Torrents Recentes' })
        .setTimestamp();

      const rows = [];
      detalhados.forEach(d => {
        progressoEmbed.addFields(
          { name: '📁 Arquivo', value: d.filename, inline: true },
          { name: '📈 Status', value: progressBar(d.progress || 0), inline: true }
        );
        rows.push(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel(`Download: ${d.filename}`)
              .setStyle(ButtonStyle.Link)
              .setURL(d.download || 'https://real-debrid.com')
              .setDisabled(!d.download)
          )
        );
      });

      await interaction.editReply({ embeds: [progressoEmbed], components: rows });
      // envia DM também
      await sendUserDM(interaction.user, {
        embeds: [progressoEmbed],
        components: rows,
        content: '📬 Aqui estão seus últimos torrents processados:'
      });
    } catch (err) {
      console.error(err);
      await interaction.editReply({ content: '❌ Erro ao obter torrents.', flags: EPHEMERAL });
    }
    return;
  }
});

// Handlers de Modal Submit
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isModalSubmit()) return;

  // Comum
  if (interaction.customId === 'modalComum') {
    const link = interaction.fields.getTextInputValue('linkComum');
    await interaction.deferReply({ flags: EPHEMERAL });
    try {
      const { data } = await axios.post(
        'https://api.real-debrid.com/rest/1.0/unrestrict/link',
        new URLSearchParams({ link }),
        { headers: { Authorization: `Bearer ${REAL_DEBRID_TOKEN}` } }
      );
      const { filename, filesize, download } = data;
      const embed = new EmbedBuilder()
        .setTitle('✅ Link Comum Processado')
        .setColor('#2ecc71')
        .addFields(
          { name: '📁 Nome', value: filename || 'Desconhecido' },
          { name: '📦 Tamanho', value: filesize ? `${(filesize / 1073741824).toFixed(2)} GB` : 'Desconhecido' },
          { name: '🔗 Link Direto', value: download || 'Indisponível' }
        );
      await interaction.editReply({ embeds: [embed] });
      // envia DM também
      await sendUserDM(interaction.user, {
        embeds: [embed],
        content: '📬 Seu link comum foi processado com sucesso!'
      });
    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: '❌ Erro ao processar o link fornecido.', flags: EPHEMERAL });
    }
    return;
  }

  // Torrent
  if (interaction.customId === 'modalTorrent') {
    const magnetLink = interaction.fields.getTextInputValue('linkTorrent');
    await interaction.deferReply({ flags: EPHEMERAL });
    try {
      const add = await axios.post(
        'https://api.real-debrid.com/rest/1.0/torrents/addMagnet',
        new URLSearchParams({ magnet: magnetLink }),
        { headers: { Authorization: `Bearer ${REAL_DEBRID_TOKEN}` } }
      );
      const id = add.data.id;
      await axios.post(
        `https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${id}`,
        new URLSearchParams({ files: 'all' }),
        { headers: { Authorization: `Bearer ${REAL_DEBRID_TOKEN}` } }
      );
      const info = await axios.get(
        `https://api.real-debrid.com/rest/1.0/torrents/info/${id}`,
        { headers: { Authorization: `Bearer ${REAL_DEBRID_TOKEN}` } }
      );
      const { filename, bytes, links, progress } = info.data;
      if (!links || links.length === 0) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`retry_torrent_${id}`)
            .setLabel(`🔄 Tentar Novamente (${progress?.toFixed(1) || 0}%)`)
            .setStyle(ButtonStyle.Primary)
        );
        await interaction.editReply({ content: `⏳ Torrent ainda sendo processado (${progress?.toFixed(1) || 0}%). Tente novamente depois.`, components: [row] });
        return;
      }
      const unlock = await axios.post(
        'https://api.real-debrid.com/rest/1.0/unrestrict/link',
        new URLSearchParams({ link: links[0] }),
        { headers: { Authorization: `Bearer ${REAL_DEBRID_TOKEN}` } }
      );
      const embed = new EmbedBuilder()
        .setTitle('✅ Torrent Processado')
        .setColor('#2ecc71')
        .addFields(
          { name: '📁 Nome', value: filename || 'Desconhecido' },
          { name: '📦 Tamanho', value: bytes ? `${(bytes / 1073741824).toFixed(2)} GB` : 'Desconhecido' },
          { name: '🔗 Link Direto', value: unlock.data.download || 'Indisponível' }
        );
      await interaction.editReply({ embeds: [embed] });
      // envia DM também
      await sendUserDM(interaction.user, {
        embeds: [embed],
        content: '📬 Seu torrent foi processado com sucesso!'
      });
    } catch (err) {
      console.error(err);
      await interaction.editReply({ content: '❌ Erro ao processar o torrent.', flags: EPHEMERAL });
    }
    return;
  }
});

// Retry torrent
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton() || !interaction.customId.startsWith('retry_torrent_')) return;
  const id = interaction.customId.replace('retry_torrent_', '');
  await interaction.deferReply({ flags: EPHEMERAL });
  try {
    const info = await axios.get(`https://api.real-debrid.com/rest/1.0/torrents/info/${id}`, { headers: { Authorization: `Bearer ${REAL_DEBRID_TOKEN}` } });
    const { filename, bytes, links, progress } = info.data;
    if (!links || links.length === 0) {
      await interaction.editReply({ content: `⏳ Ainda não disponível (${progress?.toFixed(1) || 0}%). Tente mais tarde.`, flags: EPHEMERAL });
      return;
    }
    const unlock = await axios.post(
      'https://api.real-debrid.com/rest/1.0/unrestrict/link',
      new URLSearchParams({ link: links[0] }),
      { headers: { Authorization: `Bearer ${REAL_DEBRID_TOKEN}` } }
    );
    const embed = new EmbedBuilder()
      .setTitle('✅ Torrent Processado')
      .setColor('#2ecc71')
      .addFields(
        { name: '📁 Nome', value: filename || 'Desconhecido' },
        { name: '📦 Tamanho', value: bytes ? `${(bytes / 1073741824).toFixed(2)} GB` : 'Desconhecido' },
        { name: '🔗 Link Direto', value: unlock.data.download || 'Indisponível' }
      );
    await interaction.editReply({ embeds: [embed] });
    // envia DM também
    await sendUserDM(interaction.user, {
      embeds: [embed],
      content: '📬 Atualização: seu torrent está agora disponível!'
    });
  } catch (err) {
    console.error(err);
    await interaction.editReply({ content: '❌ Erro ao tentar novamente.', flags: EPHEMERAL });
  }
});

client.login(DISCORD_BOT_TOKEN);
