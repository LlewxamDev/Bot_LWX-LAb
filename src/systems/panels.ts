import {
  ChannelType,
  MessageType,
  OverwriteType,
  PermissionFlagsBits,
  type CategoryChannel,
  type Client,
  type Guild,
  type Message,
  type TextChannel,
} from 'discord.js';
import { BOT_CONFIG } from '../config/botConfig.js';
import {
  buildBudgetPanelMessage,
  buildPortfolioPanelMessage,
  buildPricingPanelMessage,
  buildRegisterPanelMessage,
  buildReviewPromptPanelMessage,
  buildRulesPanelMessage,
  buildSiliaPanelMessage,
  buildWelcomeFixedPanelMessage,
  type FixedPanelPayload,
} from '../ui/panels.js';
import { getSiliaChannelId, saveSiliaChannelId } from './silia.js';

type PanelDeploymentSpec = {
  key: string;
  resolveChannelId: (guild?: Guild | null) => string;
  build: () => FixedPanelPayload;
  strictSingleMessageOnly: boolean;
};

export function getPanelSpecs(): PanelDeploymentSpec[] {
  return [
    {
      key: 'register',
      resolveChannelId: () => BOT_CONFIG.channels.register,
      build: buildRegisterPanelMessage,
      strictSingleMessageOnly: true,
    },
    {
      key: 'rules',
      resolveChannelId: () => BOT_CONFIG.channels.rules,
      build: buildRulesPanelMessage,
      strictSingleMessageOnly: true,
    },
    {
      key: 'welcome',
      resolveChannelId: () => BOT_CONFIG.channels.welcome,
      build: buildWelcomeFixedPanelMessage,
      strictSingleMessageOnly: false, // Keeps the welcome header + member join welcome cards
    },
    {
      key: 'portfolio',
      resolveChannelId: () => BOT_CONFIG.channels.portfolio,
      build: buildPortfolioPanelMessage,
      strictSingleMessageOnly: true,
    },
    {
      key: 'pricing',
      resolveChannelId: () => BOT_CONFIG.channels.pricing,
      build: buildPricingPanelMessage,
      strictSingleMessageOnly: true,
    },
    {
      key: 'reviewPrompt',
      resolveChannelId: () => BOT_CONFIG.channels.reviewPrompt,
      build: buildReviewPromptPanelMessage,
      strictSingleMessageOnly: true,
    },
    {
      key: 'budget',
      resolveChannelId: () => BOT_CONFIG.channels.budget,
      build: buildBudgetPanelMessage,
      strictSingleMessageOnly: true,
    },
    {
      key: 'silia',
      resolveChannelId: (guild) => getSiliaChannelId(guild),
      build: buildSiliaPanelMessage,
      strictSingleMessageOnly: true,
    },
  ];
}

/**
 * Ensures the dedicated #🤖・silia-ai channel exists in the server and sits in the Atendimento & Briefing category.
 */
export async function ensureSiliaChannelExists(guild: Guild): Promise<TextChannel | null> {
  await guild.channels.fetch().catch(() => null);

  const budgetChannel = guild.channels.cache.get(BOT_CONFIG.channels.budget);
  const parentId = budgetChannel?.parentId ?? BOT_CONFIG.categories.tickets;

  const savedId = getSiliaChannelId(guild);
  const byId = guild.channels.cache.get(savedId);
  if (byId && byId.type === ChannelType.GuildText) {
    if (parentId && byId.parentId !== parentId) {
      await byId.setParent(parentId, { lockPermissions: false }).catch(() => undefined);
    }
    saveSiliaChannelId(byId.id);
    return byId;
  }

  const byName = guild.channels.cache.find(
    (ch): ch is TextChannel =>
      ch.type === ChannelType.GuildText && ch.name.toLowerCase().includes('silia'),
  );
  if (byName) {
    if (parentId && byName.parentId !== parentId) {
      await byName.setParent(parentId, { lockPermissions: false }).catch(() => undefined);
    }
    saveSiliaChannelId(byName.id);
    return byName;
  }

  try {
    const created = await guild.channels.create({
      name: '🤖・silia-ai',
      type: ChannelType.GuildText,
      parent: parentId ?? null,
      topic: '✨ Silia AI • Converse com a IA oficial do LWX Lab ou aprimore sua ideia de design antes de abrir orçamento!',
      reason: 'Canal dedicado da Silia AI solicitado para o LWX Lab',
    });
    saveSiliaChannelId(created.id);
    console.log(`🤖 Canal #🤖・silia-ai criado com sucesso (${created.id})`);
    return created;
  } catch (error) {
    console.error('Erro ao criar canal #🤖・silia-ai:', error);
    return null;
  }
}

/**
 * Enforces:
 * 1. Unregistered members (@everyone) can ONLY see #✅・registre-se until they complete their credential (which grants @Membros).
 * 2. Panel channels only allow the Bot to post messages (except #🤖・silia-ai where verified members can send messages to talk to Silia AI).
 * 3. General community channels (#🗿・chat-geral, #💭・ideias-e-feedback, #💡・dúvidas, etc.) allow normal chatting for verified @Membros.
 */
export async function enforceServerAccessAndChannelRules(guild: Guild, botUserId: string): Promise<void> {
  await guild.channels.fetch().catch(() => null);

  const everyoneId = guild.roles.everyone.id;
  const verifiedRoleId = BOT_CONFIG.roles.verified;
  const staffRoleId = BOT_CONFIG.roles.staff;
  const siliaChannelId = getSiliaChannelId(guild);

  const readOnlyPanelChannelIds = new Set<string>([
    BOT_CONFIG.channels.register,
    BOT_CONFIG.channels.rules,
    BOT_CONFIG.channels.welcome,
    BOT_CONFIG.channels.announcements,
    BOT_CONFIG.channels.portfolio,
    BOT_CONFIG.channels.pricing,
    BOT_CONFIG.channels.reviews,
    BOT_CONFIG.channels.reviewPrompt,
    BOT_CONFIG.channels.budget,
  ]);

  for (const [, channel] of guild.channels.cache) {
    if (!channel) continue;

    // Do not alter individual private ticket channels inside the Tickets category
    if (
      channel.parentId === BOT_CONFIG.categories.tickets &&
      channel.id !== BOT_CONFIG.channels.budget &&
      channel.id !== BOT_CONFIG.channels.reviewPrompt &&
      channel.id !== siliaChannelId
    ) {
      continue;
    }

    // 1. #✅・registre-se: Visible to @everyone and @Membros, but read-only (button-only interaction)
    if (channel.id === BOT_CONFIG.channels.register && channel.type === ChannelType.GuildText) {
      await channel.permissionOverwrites
        .set([
          {
            id: everyoneId,
            type: OverwriteType.Role,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
            deny: [
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.CreatePublicThreads,
              PermissionFlagsBits.CreatePrivateThreads,
              PermissionFlagsBits.AddReactions,
            ],
          },
          {
            id: verifiedRoleId,
            type: OverwriteType.Role,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
            deny: [
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.CreatePublicThreads,
              PermissionFlagsBits.CreatePrivateThreads,
            ],
          },
          {
            id: staffRoleId,
            type: OverwriteType.Role,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageMessages,
            ],
          },
          {
            id: botUserId,
            type: OverwriteType.Member,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.ManageMessages,
            ],
          },
        ])
        .catch(() => undefined);
      continue;
    }

    // 2. #🤖・silia-ai: Hidden from @everyone, visible + writable for @Membros so they can chat with Silia AI!
    if (channel.id === siliaChannelId && channel.type === ChannelType.GuildText) {
      await channel.permissionOverwrites
        .set([
          {
            id: everyoneId,
            type: OverwriteType.Role,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: verifiedRoleId,
            type: OverwriteType.Role,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.SendMessagesInThreads,
            ],
            deny: [
              PermissionFlagsBits.CreatePublicThreads,
              PermissionFlagsBits.CreatePrivateThreads,
            ],
          },
          {
            id: staffRoleId,
            type: OverwriteType.Role,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageMessages,
              PermissionFlagsBits.ManageThreads,
            ],
          },
          {
            id: botUserId,
            type: OverwriteType.Member,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.SendMessagesInThreads,
              PermissionFlagsBits.CreatePrivateThreads,
              PermissionFlagsBits.ManageThreads,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.ManageMessages,
            ],
          },
        ])
        .catch(() => undefined);
      continue;
    }

    // 3. Fixed Panel & Showcase Channels: Hidden from @everyone, Read-Only for @Membros (only bot messages appear!)
    if (
      readOnlyPanelChannelIds.has(channel.id) &&
      (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)
    ) {
      await channel.permissionOverwrites
        .set([
          {
            id: everyoneId,
            type: OverwriteType.Role,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: verifiedRoleId,
            type: OverwriteType.Role,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
            deny: [
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.CreatePublicThreads,
              PermissionFlagsBits.CreatePrivateThreads,
              PermissionFlagsBits.AddReactions,
            ],
          },
          {
            id: staffRoleId,
            type: OverwriteType.Role,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageMessages,
            ],
          },
          {
            id: botUserId,
            type: OverwriteType.Member,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.ManageMessages,
            ],
          },
        ])
        .catch(() => undefined);
      continue;
    }

    // 4. Categories and General Community / Voice / Forum Channels:
    if (channel.type === ChannelType.GuildCategory) {
      const cat = channel as CategoryChannel;
      if (cat.name.toUpperCase().includes('STAFF')) {
        continue;
      }
      await cat.permissionOverwrites
        .edit(everyoneId, { ViewChannel: false })
        .catch(() => undefined);
      await cat.permissionOverwrites
        .edit(verifiedRoleId, { ViewChannel: true, ReadMessageHistory: true })
        .catch(() => undefined);
      continue;
    }

    const parentCat = channel.parent;
    if (parentCat && parentCat.name.toUpperCase().includes('STAFF')) {
      continue;
    }

    if (
      channel.type === ChannelType.GuildText ||
      channel.type === ChannelType.GuildVoice ||
      channel.type === ChannelType.GuildForum
    ) {
      await channel.permissionOverwrites
        .edit(everyoneId, { ViewChannel: false })
        .catch(() => undefined);
      await channel.permissionOverwrites
        .edit(verifiedRoleId, {
          ViewChannel: true,
          ReadMessageHistory: true,
          SendMessages: true,
          Connect: true,
          Speak: true,
        })
        .catch(() => undefined);
    }
  }
}

function messageMatchesMarker(message: Message, marker: string, botUserId: string): boolean {
  if (message.author.id !== botUserId) {
    return false;
  }

  return message.embeds.some((embed) => embed.footer?.text?.includes(marker) ?? false);
}

async function findPanelMessage(
  channel: TextChannel,
  marker: string,
  botUserId: string,
): Promise<Message | null> {
  const recentMessages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  if (recentMessages) {
    for (const [, message] of recentMessages) {
      if (messageMatchesMarker(message, marker, botUserId)) {
        return message;
      }
    }
  }

  const pinnedResult = await channel.messages.fetchPins().catch(() => null);
  if (pinnedResult) {
    for (const item of pinnedResult.items) {
      if (messageMatchesMarker(item.message, marker, botUserId)) {
        return item.message;
      }
    }
  }

  return null;
}

async function cleanExtraChannelMessages(
  channel: TextChannel,
  keepMessageId: string,
  botUserId: string,
  strictSingleMessageOnly: boolean,
): Promise<void> {
  const recentMessages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  if (!recentMessages) {
    return;
  }

  for (const [, msg] of recentMessages) {
    if (msg.id === keepMessageId) {
      continue;
    }

    if (strictSingleMessageOnly) {
      // In dedicated panel channels, ONLY the official panel message may exist in the channel!
      await msg.delete().catch(() => undefined);
      continue;
    }

    // In #👋・boas-vindas, keep the welcome fixed panel + legitimate welcome cards, delete pin system messages
    const isPinNotification = msg.type === MessageType.ChannelPinnedMessage;
    const isWelcomeCard =
      msg.author.id === botUserId &&
      msg.embeds.some((e) => e.title?.includes('Bem-vindo(a) ao LWX Lab'));

    if (isPinNotification || (msg.author.id === botUserId && !isWelcomeCard)) {
      await msg.delete().catch(() => undefined);
    }
  }
}

export async function upsertSinglePanel(
  client: Client,
  panelKey: string,
  guild?: Guild | null,
  forceRecreate = false,
): Promise<boolean> {
  const botUserId = client.user?.id;
  if (!botUserId) return false;

  const specs = getPanelSpecs();
  const spec = specs.find((s) => s.key === panelKey);
  if (!spec) return false;

  const channelId = spec.resolveChannelId(guild);
  const channel =
    client.channels.cache.get(channelId) ??
    (await client.channels.fetch(channelId).catch(() => null));

  if (!channel || channel.type !== ChannelType.GuildText) {
    return false;
  }

  const payload = spec.build();
  const existing = forceRecreate ? null : await findPanelMessage(channel, payload.marker, botUserId);

  let activeMessage: Message;
  if (existing) {
    activeMessage = await existing.edit({
      content: null,
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files,
      attachments: [],
    });
  } else {
    activeMessage = await channel.send({
      embeds: payload.embeds,
      components: payload.components,
      files: payload.files,
    });
  }

  if (!activeMessage.pinned) {
    await activeMessage.pin('Fixando painel oficial LWX Lab').catch(() => undefined);
  }

  await cleanExtraChannelMessages(channel, activeMessage.id, botUserId, spec.strictSingleMessageOnly);
  return true;
}

export async function upsertFixedPanels(
  client: Client,
  guild?: Guild | null,
  forceRecreate = false,
): Promise<void> {
  if (guild && client.user) {
    await ensureSiliaChannelExists(guild);
    await enforceServerAccessAndChannelRules(guild, client.user.id);
  }

  const specs = getPanelSpecs();
  for (const spec of specs) {
    try {
      const ok = await upsertSinglePanel(client, spec.key, guild, forceRecreate);
      if (ok) {
        console.log(`📌 Painel "${spec.key}" atualizado no canal (${spec.resolveChannelId(guild)})`);
      }
    } catch (error) {
      console.error(`Erro ao publicar painel fixo "${spec.key}":`, error);
    }
  }
}
