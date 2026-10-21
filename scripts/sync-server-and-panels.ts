import {
  ChannelType,
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  type NewsChannel,
  type TextChannel,
} from 'discord.js';
import { BOT_CONFIG } from '../src/config/botConfig.js';
import { getEnv } from '../src/config/env.js';
import { ensureSiliaChannelExists, upsertFixedPanels } from '../src/systems/panels.js';
import { buildPublishedReviewEmbed } from '../src/systems/reviews.js';
import { getSiliaChannelId } from '../src/systems/silia.js';
import {
  createDoubleBannerEmbeds,
  createStudioEmbed,
} from '../src/ui/embeds.js';
import { em, syncGuildCustomEmojis } from '../src/ui/emojis.js';

async function main(): Promise<void> {
  const env = getEnv();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  await client.login(env.DISCORD_TOKEN);

  await new Promise<void>((resolve) => {
    if (client.isReady()) {
      resolve();
      return;
    }
    client.once('ready', () => resolve());
  });

  const guild = await client.guilds.fetch(env.DISCORD_GUILD_ID);
  console.log(`Conectado ao servidor: ${guild.name} (${guild.id})`);

  // 1. Sync the 9 Custom Animated GIF Emojis (including lwx_silia) to the Discord Server
  await syncGuildCustomEmojis(guild);

  // 2. Remove all Slash Commands (Guild & Global) so everything lives in its dedicated channel
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID), {
    body: [],
  });
  await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), {
    body: [],
  });
  console.log('🧹 Todos os comandos de barra (/) foram removidos do servidor.');

  // 3. Ensure #🤖・silia-ai exists before building announcements and panels
  await ensureSiliaChannelExists(guild);
  const siliaChannelId = getSiliaChannelId(guild);

  // 4. Style Server Roles with the Official Knight Logo Palette (design-09.jpg)
  const ROLE_STYLES: { id: string; name: string; color: number }[] = [
    { id: '1493074506766487644', name: 'CEO', color: 0xB794FF },          // Pixel Lavender Highlight
    { id: '1441752196797435944', name: 'Support', color: 0x8B5CF6 },      // Knight Armor Royal Violet
    { id: '1493074848908316682', name: 'VIP', color: 0x52B7FF },          // Soul-Fire Cyan Flame
    { id: '1503766739865829377', name: 'Cliente', color: 0xD6456B },      // Crimson-Rose Scarf
    { id: '1493075161677561876', name: 'Membros', color: 0x6D3CE8 },      // Deep Amethyst
    { id: '1503766741031981139', name: 'Avisos LWX', color: 0x8B5CF6 },   // Royal Violet
    { id: '1493075002440810506', name: 'Notificações', color: 0x52B7FF }, // Soul-Fire Cyan
  ];

  for (const rs of ROLE_STYLES) {
    const role = await guild.roles.fetch(rs.id).catch(() => null);
    if (role) {
      await role.edit({ color: rs.color }).catch((e) => {
        console.warn(`Aviso ao estilizar cargo ${rs.name}:`, e.message);
      });
      console.log(`🎨 Cargo estilizado (Paleta Cavaleiro): ${rs.name} -> #${rs.color.toString(16).toUpperCase()}`);
    }
  }

  // 5. Publish / Update Official Welcome Announcement in #📢・anúncios (and keep ONLY that message in the channel)
  const announcementsChannel = await guild.channels.fetch(BOT_CONFIG.channels.announcements).catch(() => null);
  if (
    announcementsChannel &&
    (announcementsChannel.type === ChannelType.GuildText ||
      announcementsChannel.type === ChannelType.GuildAnnouncement)
  ) {
    const textAnn = announcementsChannel as TextChannel | NewsChannel;
    const marker = 'LWX_ANNOUNCEMENT_OFFICIAL_V1';

    const { headerEmbed, files } = createDoubleBannerEmbeds('welcome', 'primary');
    const annEmbed = createStudioEmbed('primary')
      .setThumbnail('attachment://knight-emblem.gif')
      .setImage('attachment://divider-glitch.gif')
      .setTitle('LWX Lab • Identidade Visual, Silia AI & Comissões Abertas')
      .setDescription(
        [
          `> ${em('knight')} **Bem-vindo ao servidor oficial do estúdio LWX Lab, liderado por Llewxam.**`,
          '> Navegue pelos canais dedicados abaixo: cada ferramenta interativa do estúdio está fixada diretamente no seu respectivo canal — com tabela de preços super acessível e a nova **Silia AI**!',
        ].join('\n'),
      )
      .addFields(
        {
          name: `${em('palette')} Portfólio & Preços`,
          value: `Explore o acervo em <#${BOT_CONFIG.channels.portfolio}> e simule combos em <#${BOT_CONFIG.channels.pricing}>.`,
          inline: true,
        },
        {
          name: `${em('silia')} Silia AI Exclusiva`,
          value: `Converse ou aprimore sua ideia de design em <#${siliaChannelId}>.`,
          inline: true,
        },
        {
          name: `${em('ticket')} Faça seu Pedido`,
          value: `Abra seu briefing privado e rastreie sua encomenda em <#${BOT_CONFIG.channels.budget}>.`,
          inline: true,
        },
      )
      .setFooter({
        text: `${BOT_CONFIG.brand.footer} • ${marker}`,
        iconURL: 'attachment://knight-avatar.png',
      });

    const sent = await textAnn.send({ embeds: [headerEmbed, annEmbed], files });
    await sent.pin().catch(() => undefined);

    const afterMsgs = await textAnn.messages.fetch({ limit: 30 }).catch(() => null);
    if (afterMsgs) {
      for (const [, m] of afterMsgs) {
        if (m.id !== sent.id) {
          await m.delete().catch(() => undefined);
        }
      }
    }
    console.log('📢 Canal #📢・anúncios atualizado com a nova mensagem única!');
  }

  // 6. Refresh existing reviews in #⭐・avaliações to the new Knight visual style (replacing > review.publish())
  const reviewsChannel = await guild.channels.fetch(BOT_CONFIG.channels.reviews).catch(() => null);
  if (reviewsChannel && reviewsChannel.type === ChannelType.GuildText) {
    const textRev = reviewsChannel as TextChannel;
    const revMsgs = await textRev.messages.fetch({ limit: 25 }).catch(() => null);
    if (revMsgs) {
      for (const [, msg] of revMsgs) {
        if (msg.author.id === client.user?.id && msg.embeds.length > 0) {
          const emb = msg.embeds[0];
          if (!emb) continue;
          const fields = emb.fields ?? [];
          const clientField = fields.find((f) => f.name.toLowerCase().includes('cliente'))?.value ?? '';
          const serviceField = fields.find((f) => f.name.toLowerCase().includes('servi') || f.name.toLowerCase().includes('projeto'))?.value ?? 'Design Autoral';
          const userIdMatch = clientField.match(/<@!?(\d+)>/);
          const userId = userIdMatch?.[1] ?? '658059260797845529';
          const cleanService = serviceField.replace(/[`*]/g, '').trim() || 'Design Autoral';

          let cleanComment = emb.description ?? 'Excelente trabalho e entrega impecável!';
          cleanComment = cleanComment
            .replace(/```[\s\S]*?```/g, '')
            .replace(/>/g, '')
            .replace(/<a?:[^>]+>/g, '')
            .replace(/["*]/g, '')
            .trim();
          if (!cleanComment) {
            cleanComment = 'Excelente trabalho e entrega impecável!';
          }

          const targetUser = await client.users.fetch(userId).catch(() => null);
          const newEmbed = buildPublishedReviewEmbed(
            targetUser?.tag ?? 'Cliente Verificado',
            userId,
            targetUser?.displayAvatarURL({ extension: 'png', size: 256 }) ?? null,
            { stars: 5, service: cleanService, comment: cleanComment },
          );

          const { files } = createDoubleBannerEmbeds('reviews', 'primary');
          const reviewFiles = files.filter((f) => f.name === 'knight-avatar.png' || f.name === 'divider-glitch.gif');

          await msg.edit({
            content: null,
            embeds: [newEmbed],
            files: reviewFiles,
            attachments: [],
          }).catch(() => undefined);
          console.log(`⭐ Avaliação ${msg.id} atualizada para o visual Cavaleiro.`);
        }
      }
    }
  }

  // 7. Clean old bot test messages in #🗿・chat-geral (1493077994468540466)
  const generalChat = await guild.channels.fetch('1493077994468540466').catch(() => null);
  if (generalChat && generalChat.type === ChannelType.GuildText) {
    const genMsgs = await (generalChat as TextChannel).messages.fetch({ limit: 20 }).catch(() => null);
    if (genMsgs) {
      for (const [, m] of genMsgs) {
        if (m.author.id === client.user?.id) {
          await m.delete().catch(() => undefined);
        }
      }
    }
  }

  // 8. Force-recreate all 8 Fixed Panels (deleting every old > lwx... message and posting the brand-new message fresh!)
  await upsertFixedPanels(client, guild, true);
  console.log('✅ Todos os 8 painéis fixos foram recriados do zero nos canais corretos e as mensagens antigas foram apagadas!');

  await client.destroy();
  process.exit(0);
}

void main();
