import {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
  type Interaction,
  type Message,
} from 'discord.js';
import { askSiliaAI } from './ai/chatbot.js';
import { BOT_CONFIG } from './config/botConfig.js';
import { getEnv } from './config/env.js';
import { handleOrderStageSelect, handleOrderTrackButton } from './systems/orders.js';
import { handlePaletteGenInteraction } from './systems/palette.js';
import { upsertFixedPanels } from './systems/panels.js';
import {
  handlePortfolioCategorySelect,
  handlePortfolioJumpSelect,
  handlePortfolioNavigationButton,
  handlePortfolioOpenButton,
  handlePortfolioOrderThisButton,
} from './systems/portfolio.js';
import {
  handlePricingComboOpen,
  handlePricingComboSelect,
  handlePricingOpenButton,
  handlePricingSelect,
} from './systems/pricing.js';
import {
  handleMemberProfileInteraction,
  handleRegisterRoleToggleButton,
  handleRegisterVerifyButton,
  handleRulesAcceptButton,
  handleRulesFaqButton,
} from './systems/registration.js';
import { handleReviewModalSubmit, handleReviewOpenModalButton } from './systems/reviews.js';
import {
  handleSiliaChannelMessage,
  handleSiliaClearButton,
  handleSiliaModeButton,
  handleSiliaToBriefingButton,
} from './systems/silia.js';
import {
  handleBudgetModalSubmit,
  handleBudgetOpenModalButton,
  handleTicketClaimButton,
  handleTicketCloseButton,
} from './systems/tickets.js';
import { handleGuildMemberWelcome } from './systems/welcome.js';
import { collectBrandFiles, createSiliaEmbed } from './ui/embeds.js';
import { em, syncGuildCustomEmojis } from './ui/emojis.js';

const env = getEnv();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

/**
 * Removes all global and guild slash commands so 100% of bot interactions
 * happen exclusively inside their dedicated channels via fixed panels.
 */
async function clearAllSlashCommands(): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

  await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID), {
    body: [],
  });
  await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), {
    body: [],
  });

  console.log('🧹 Slash commands removidos (0 comandos de barra). Todas as funções agora operam exclusivamente nos painéis de cada canal!');
}

async function routeInteraction(interaction: Interaction): Promise<void> {
  if (interaction.isButton()) {
    const { customId } = interaction;

    if (customId === BOT_CONFIG.customIds.registerVerify) {
      await handleRegisterVerifyButton(interaction);
      return;
    }

    if (
      customId === BOT_CONFIG.customIds.registerAvisos ||
      customId === BOT_CONFIG.customIds.registerEventos
    ) {
      await handleRegisterRoleToggleButton(interaction);
      return;
    }

    if (customId === BOT_CONFIG.customIds.registerProfile) {
      await handleMemberProfileInteraction(interaction);
      return;
    }

    if (customId === BOT_CONFIG.customIds.rulesAccept) {
      await handleRulesAcceptButton(interaction);
      return;
    }

    if (customId === BOT_CONFIG.customIds.rulesFaq) {
      await handleRulesFaqButton(interaction);
      return;
    }

    if (customId === BOT_CONFIG.customIds.siliaChat) {
      await handleSiliaModeButton(interaction, 'chat');
      return;
    }

    if (customId === BOT_CONFIG.customIds.siliaIdeate) {
      await handleSiliaModeButton(interaction, 'ideate');
      return;
    }

    if (customId === BOT_CONFIG.customIds.siliaToBriefing) {
      await handleSiliaToBriefingButton(interaction);
      return;
    }

    if (customId === BOT_CONFIG.customIds.siliaClear) {
      await handleSiliaClearButton(interaction);
      return;
    }

    if (customId === BOT_CONFIG.customIds.portfolioOpen) {
      await handlePortfolioOpenButton(interaction, 'all');
      return;
    }

    if (customId === BOT_CONFIG.customIds.portfolioCatBanners) {
      await handlePortfolioOpenButton(interaction, 'banners');
      return;
    }

    if (customId === BOT_CONFIG.customIds.portfolioCatArt) {
      await handlePortfolioOpenButton(interaction, 'illustrations');
      return;
    }

    if (customId === BOT_CONFIG.customIds.portfolioCatBrand) {
      await handlePortfolioOpenButton(interaction, 'logos');
      return;
    }

    if (
      customId.startsWith(`${BOT_CONFIG.customIds.portfolioPrev}:`) ||
      customId.startsWith(`${BOT_CONFIG.customIds.portfolioNext}:`)
    ) {
      await handlePortfolioNavigationButton(interaction);
      return;
    }

    if (customId.startsWith(`${BOT_CONFIG.customIds.portfolioOrderThis}:`)) {
      await handlePortfolioOrderThisButton(interaction);
      return;
    }

    if (customId === BOT_CONFIG.customIds.pricingOpen) {
      await handlePricingOpenButton(interaction);
      return;
    }

    if (customId === BOT_CONFIG.customIds.pricingComboOpen) {
      await handlePricingComboOpen(interaction);
      return;
    }

    if (
      customId === BOT_CONFIG.customIds.reviewOpenModal ||
      customId === BOT_CONFIG.customIds.reviewStar5 ||
      customId === BOT_CONFIG.customIds.reviewStar4 ||
      customId === BOT_CONFIG.customIds.reviewStar3
    ) {
      await handleReviewOpenModalButton(interaction);
      return;
    }

    if (
      customId === BOT_CONFIG.customIds.budgetOpenModal ||
      customId === BOT_CONFIG.customIds.budgetQuickBanner ||
      customId === BOT_CONFIG.customIds.budgetQuickArt ||
      customId === BOT_CONFIG.customIds.budgetQuickBrand
    ) {
      await handleBudgetOpenModalButton(interaction);
      return;
    }

    if (
      customId === BOT_CONFIG.customIds.budgetPaletteGen ||
      customId.startsWith(`${BOT_CONFIG.customIds.paletteReroll}:`)
    ) {
      await handlePaletteGenInteraction(interaction);
      return;
    }

    if (customId === BOT_CONFIG.customIds.orderTrackOpen) {
      await handleOrderTrackButton(interaction);
      return;
    }

    if (customId === BOT_CONFIG.customIds.ticketClaim) {
      await handleTicketClaimButton(interaction);
      return;
    }

    if (customId === BOT_CONFIG.customIds.ticketClose) {
      await handleTicketCloseButton(interaction);
      return;
    }

    return;
  }

  if (interaction.isStringSelectMenu()) {
    const { customId } = interaction;

    if (customId === BOT_CONFIG.customIds.portfolioCategory) {
      await handlePortfolioCategorySelect(interaction);
      return;
    }

    if (customId === BOT_CONFIG.customIds.portfolioJump) {
      await handlePortfolioJumpSelect(interaction);
      return;
    }

    if (customId === BOT_CONFIG.customIds.pricingSelect) {
      await handlePricingSelect(interaction);
      return;
    }

    if (customId === BOT_CONFIG.customIds.pricingComboSelect) {
      await handlePricingComboSelect(interaction);
      return;
    }

    if (customId.startsWith(`${BOT_CONFIG.customIds.orderStageSelect}:`)) {
      await handleOrderStageSelect(interaction);
      return;
    }

    return;
  }

  if (interaction.isModalSubmit()) {
    const { customId } = interaction;

    if (customId === BOT_CONFIG.customIds.reviewModal) {
      await handleReviewModalSubmit(interaction);
      return;
    }

    if (customId === BOT_CONFIG.customIds.budgetModal) {
      await handleBudgetModalSubmit(interaction);
      return;
    }
  }
}

async function handleBotMentionMessage(message: Message): Promise<void> {
  if (message.author.bot || !client.user) {
    return;
  }

  // First, check if the message was sent in #🤖・silia-ai (or a private thread inside it)
  const handledBySiliaChannel = await handleSiliaChannelMessage(message);
  if (handledBySiliaChannel) {
    return;
  }

  if (!message.mentions.has(client.user.id, { ignoreEveryone: true, ignoreRoles: true })) {
    return;
  }

  const prompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
  const effectivePrompt = prompt.length > 0 ? prompt : 'Olá! Como a Silia AI e o estúdio LWX Lab podem me ajudar?';

  if ('sendTyping' in message.channel) {
    await message.channel.sendTyping().catch(() => undefined);
  }

  const responseText = await askSiliaAI(
    effectivePrompt,
    'chat',
    message.member?.displayName ?? message.author.displayName,
  );

  const replyEmbed = createSiliaEmbed('primary')
    .setTitle('Silia AI • Assistente Criativa LWX Lab')
    .setDescription(`${em('silia')} ${responseText}`);

  await message.reply({
    embeds: [replyEmbed],
    files: collectBrandFiles(['siliaAvatar', 'siliaEmblem', 'divider']),
  });
}

function startBotRichPresence(readyClient: Client<true>): void {
  const activities = [
    {
      name: 'LWX Lab • Estúdio por Llewxam',
      type: ActivityType.Playing,
      state: '⚔️ Banners, Logos, OCs & Packs • A partir de R$ 10',
    },
    {
      name: 'Silia AI • Consultora Criativa',
      type: ActivityType.Watching,
      state: '🤖 Converse ou aprimore sua ideia em #silia-ai ✨',
    },
    {
      name: 'Comissões & Orçamentos Abertos',
      type: ActivityType.Listening,
      state: '🎫 Abra seu pedido exclusivo em #fazer-orçamento',
    },
  ];

  let index = 0;
  const applyPresence = () => {
    const current = activities[index % activities.length]!;
    readyClient.user.setPresence({
      status: 'online',
      activities: [
        {
          name: current.name,
          type: current.type,
          state: current.state,
        },
      ],
    });
    index += 1;
  };

  applyPresence();
  setInterval(applyPresence, 30_000);
}

async function syncBotProfileCustomization(readyClient: Client<true>): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

  const richAboutMe = [
    `${em('knight')} **LWX Lab • Estúdio Oficial por Llewxam**`,
    `> ${em('flame')} **Especialidades:** Banners, Logos, Ilustrações/OCs, Packs & Bots`,
    `> ${em('silia')} **Silia AI:** Assistente criativa integrada para montar seu briefing`,
    `> ${em('spark')} **Comissões Abertas:** Preços acessíveis a partir de **R$ 10**!`,
  ].join('\n');

  // 1. Update Application "Sobre Mim" (description) + Specialty Pill Tags
  await rest
    .patch('/applications/@me', {
      body: {
        description: richAboutMe,
        tags: ['Design & Arte', 'Banners & Logos', 'Ilustração & OC', 'Silia AI', 'Llewxam Studio'],
      },
    })
    .catch((err) => {
      console.warn('Aviso ao atualizar /applications/@me:', err instanceof Error ? err.message : err);
    });

  // 2. Update Guild Member Bio for the Bot in LWX Lab BR
  await rest
    .patch(Routes.guildMember(env.DISCORD_GUILD_ID, '@me'), {
      body: {
        bio: richAboutMe.slice(0, 190),
      },
    })
    .catch(() => undefined);

  // 3. Ensure Stylized Profile Badge Roles on the Bot in LWX Lab BR
  const guild = await readyClient.guilds.fetch(env.DISCORD_GUILD_ID).catch(() => null);
  if (!guild) return;

  await guild.roles.fetch().catch(() => null);
  const botMember = await guild.members.fetch(readyClient.user.id).catch(() => null);
  if (!botMember) return;

  const badgeSpecs = [
    { name: '⚔️ Estúdio Oficial • Llewxam', color: 0x8B5CF6 },
    { name: '🤖 Silia AI • Engine Ativa', color: 0x52B7FF },
    { name: '🎨 Banners • Logos • OCs', color: 0xD6456B },
  ];

  for (const spec of badgeSpecs) {
    let role = guild.roles.cache.find((r) => r.name === spec.name);
    if (!role) {
      role = await guild.roles
        .create({
          name: spec.name,
          color: spec.color,
          hoist: false,
          mentionable: false,
          reason: 'Badge visual para o perfil do bot LWX Lab',
        })
        .catch(() => undefined);
    }
    if (role && !botMember.roles.cache.has(role.id)) {
      await botMember.roles.add(role).catch(() => undefined);
    }
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logado com sucesso como ${readyClient.user.tag}`);

  startBotRichPresence(readyClient);

  const guild = await readyClient.guilds.fetch(env.DISCORD_GUILD_ID).catch(() => null);
  if (guild) {
    await syncGuildCustomEmojis(guild);
  }

  await syncBotProfileCustomization(readyClient).catch((error) => {
    console.warn('Aviso ao personalizar perfil do bot:', error);
  });

  await clearAllSlashCommands().catch((error) => {
    console.error('Erro ao limpar slash commands:', error);
  });

  await upsertFixedPanels(readyClient, guild);
});

client.on(Events.GuildMemberAdd, async (member) => {
  await handleGuildMemberWelcome(member);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    await routeInteraction(interaction);
  } catch (error) {
    console.error('Erro ao processar interação:', error);

    if (interaction.isRepliable()) {
      const fallbackMessage = 'Ocorreu um erro interno ao processar sua solicitação. Tente novamente.';
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: fallbackMessage, flags: MessageFlags.Ephemeral }).catch(() => undefined);
      } else {
        await interaction.reply({ content: fallbackMessage, flags: MessageFlags.Ephemeral }).catch(() => undefined);
      }
    }
  }
});

client.on(Events.MessageCreate, async (message) => {
  try {
    await handleBotMentionMessage(message);
  } catch (error) {
    console.error('Erro ao processar mensagem:', error);
  }
});

import { createServer } from 'node:http';

const healthPort = Number(process.env.PORT) || 10000;
const healthServer = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      status: 'online',
      bot: client.user?.tag ?? 'LWX Lab',
      uptime_sec: Math.floor(process.uptime()),
    }),
  );
});
healthServer.on('error', () => {
  // Ignore port-in-use during local multi-process tests
});
healthServer.listen(healthPort, '0.0.0.0', () => {
  console.log(`🌐 Healthcheck HTTP ativo em 0.0.0.0:${healthPort} (Render / Cron-Job ready)`);
});

void client.login(env.DISCORD_TOKEN);
