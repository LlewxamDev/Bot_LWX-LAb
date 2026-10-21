import fs from 'node:fs';
import path from 'node:path';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags,
  ThreadAutoArchiveDuration,
  type ButtonInteraction,
  type Guild,
  type Message,
  type PrivateThreadChannel,
  type TextChannel,
} from 'discord.js';
import { askSiliaAI, type SiliaHistoryTurn, type SiliaMode } from '../ai/chatbot.js';
import { BOT_CONFIG } from '../config/botConfig.js';
import { collectBrandFiles, createSiliaEmbed } from '../ui/embeds.js';
import { btnEmoji, em } from '../ui/emojis.js';
import { buildBudgetModal } from './tickets.js';

interface UserSiliaSession {
  userId: string;
  mode: SiliaMode;
  history: SiliaHistoryTurn[];
  lastIdeaSummary?: string | undefined;
  threadId?: string | undefined;
  trackedMessageIds: string[];
  updatedAt: number;
}

const RUNTIME_CONFIG_PATH = path.resolve(process.cwd(), 'data', 'runtime.json');
const userSessions = new Map<string, UserSiliaSession>();

export function getSiliaChannelId(guild?: Guild | null): string {
  try {
    if (fs.existsSync(RUNTIME_CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(RUNTIME_CONFIG_PATH, 'utf8')) as { siliaChannelId?: string };
      if (raw.siliaChannelId) {
        return raw.siliaChannelId;
      }
    }
  } catch {
    // Ignore runtime read errors
  }

  if (guild) {
    const found = guild.channels.cache.find(
      (ch) => ch.type === ChannelType.GuildText && ch.name.toLowerCase().includes('silia'),
    );
    if (found) {
      return found.id;
    }
  }

  return BOT_CONFIG.channels.siliaAi;
}

export function saveSiliaChannelId(channelId: string): void {
  fs.mkdirSync(path.dirname(RUNTIME_CONFIG_PATH), { recursive: true });
  let existing: Record<string, unknown> = {};
  try {
    if (fs.existsSync(RUNTIME_CONFIG_PATH)) {
      existing = JSON.parse(fs.readFileSync(RUNTIME_CONFIG_PATH, 'utf8')) as Record<string, unknown>;
    }
  } catch {
    existing = {};
  }
  existing.siliaChannelId = channelId;
  fs.writeFileSync(RUNTIME_CONFIG_PATH, JSON.stringify(existing, null, 2), 'utf8');
}

export function getOrInitUserSiliaSession(userId: string, mode?: SiliaMode): UserSiliaSession {
  const existing = userSessions.get(userId);
  if (existing) {
    if (mode && existing.mode !== mode) {
      existing.mode = mode;
    }
    existing.updatedAt = Date.now();
    return existing;
  }

  const created: UserSiliaSession = {
    userId,
    mode: mode ?? 'chat',
    history: [],
    trackedMessageIds: [],
    updatedAt: Date.now(),
  };
  userSessions.set(userId, created);
  return created;
}

export function createSiliaConversationControlRow(currentMode: SiliaMode): ActionRowBuilder<ButtonBuilder> {
  const toggleTarget: SiliaMode = currentMode === 'chat' ? 'ideate' : 'chat';
  const toggleLabel =
    toggleTarget === 'ideate' ? 'Mudar para: Aprimorar Ideia' : 'Mudar para: Conversar Livre';

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(
        toggleTarget === 'ideate' ? BOT_CONFIG.customIds.siliaIdeate : BOT_CONFIG.customIds.siliaChat,
      )
      .setLabel(toggleLabel)
      .setEmoji(btnEmoji(toggleTarget === 'ideate' ? 'palette' : 'silia'))
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.siliaToBriefing)
      .setLabel('Abrir Orçamento com Esta Ideia')
      .setEmoji(btnEmoji('ticket'))
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.siliaClear)
      .setLabel('Limpar Conversa')
      .setEmoji(btnEmoji('spark'))
      .setStyle(ButtonStyle.Secondary),
  );
}

async function ensurePrivateSiliaThread(
  channel: TextChannel,
  userId: string,
  username: string,
  mode: SiliaMode,
): Promise<PrivateThreadChannel | null> {
  const session = getOrInitUserSiliaSession(userId, mode);
  const cleanName = `🔒・silia-${username.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 14) || 'membro'}`;

  try {
    const activeThreads = await channel.threads.fetchActive().catch(() => null);
    if (activeThreads) {
      const existing = activeThreads.threads.find(
        (t) => t.id === session.threadId || t.name === cleanName,
      ) as PrivateThreadChannel | undefined;

      if (existing) {
        session.threadId = existing.id;
        await existing.members.add(userId).catch(() => undefined);
        return existing;
      }
    }

    const thread = await channel.threads.create({
      name: cleanName,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
      type: ChannelType.PrivateThread,
      invitable: false,
      reason: `Conversa privada com a Silia AI para ${username}`,
    });

    await thread.members.add(userId).catch(() => undefined);
    session.threadId = thread.id;
    return thread as PrivateThreadChannel;
  } catch {
    return null;
  }
}

export function buildSiliaModeActivationEmbed(mode: SiliaMode, displayName: string, threadId?: string) {
  const isIdeate = mode === 'ideate';
  const title = isIdeate
    ? 'Modo Ativo • Aprimorar Ideia com Silia AI'
    : 'Modo Ativo • Conversar com a Silia AI';

  const descriptionLines = isIdeate
    ? [
        `> ${em('silia')} **Olá, ${displayName}! Estou pronta para ajudar você a lapidar sua ideia de design!** *(piscadinha dourada ✨)*`,
        '> Me conte o que você quer criar (ex.: *"Quero um banner pro meu servidor"*, *"Quero uma logo estilo cavaleiro"*, *"Quero desenhar meu OC"*) e eu monto sugestões de cores, estilo e um briefing prontinho para você apresentar ao **Llewxam**!',
        '',
        threadId
          ? `${em('spark')} **Onde enviar sua mensagem:** Você pode digitar **direto neste canal** ou na sua sala privada exclusiva <#${threadId}>!`
          : `${em('spark')} **Pode digitar agora mesmo neste canal!** Qualquer mensagem que você enviar aqui será respondida por mim.`,
      ]
    : [
        `> ${em('silia')} **Oi, ${displayName}! Modo de conversa livre ativado!** *(piscadinha dourada ✨)*`,
        '> Pode conversar comigo sobre o que quiser: criatividade, jogos, arte, tecnologia ou tirar dúvidas sobre o **LWX Lab**!',
        '',
        threadId
          ? `${em('spark')} **Onde enviar sua mensagem:** Você pode digitar **direto neste canal** ou na sua sala privada exclusiva <#${threadId}>!`
          : `${em('spark')} **Pode digitar agora mesmo neste canal!** Qualquer mensagem que você enviar aqui será respondida por mim.`,
      ];

  return createSiliaEmbed(isIdeate ? 'accent' : 'primary')
    .setTitle(title)
    .setDescription(descriptionLines.join('\n'));
}

export async function handleSiliaModeButton(
  interaction: ButtonInteraction,
  mode: SiliaMode,
): Promise<void> {
  const session = getOrInitUserSiliaSession(interaction.user.id, mode);
  const displayName =
    interaction.guild && interaction.member && 'displayName' in interaction.member
      ? interaction.member.displayName
      : interaction.user.displayName;

  let thread: PrivateThreadChannel | null = null;
  if (interaction.channel && interaction.channel.type === ChannelType.GuildText) {
    thread = await ensurePrivateSiliaThread(
      interaction.channel,
      interaction.user.id,
      interaction.user.username,
      mode,
    );
  }

  const embed = buildSiliaModeActivationEmbed(mode, displayName, thread?.id);
  const files = collectBrandFiles(['siliaAvatar', 'siliaEmblem', 'divider']);
  const components = [createSiliaConversationControlRow(mode)];

  if (thread) {
    await thread
      .send({
        content: `${em('silia')} <@${interaction.user.id}>`,
        embeds: [embed],
        files: collectBrandFiles(['siliaAvatar', 'siliaEmblem', 'divider']),
        components: [createSiliaConversationControlRow(mode)],
      })
      .catch(() => undefined);
  }

  session.updatedAt = Date.now();

  await interaction.reply({
    embeds: [embed],
    files,
    components,
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleSiliaToBriefingButton(interaction: ButtonInteraction): Promise<void> {
  const session = userSessions.get(interaction.user.id);
  const prefillService =
    session?.mode === 'ideate' ? 'Projeto Criativo (Refinado com Silia AI)' : undefined;

  const modal = buildBudgetModal(prefillService, session?.lastIdeaSummary);
  await interaction.showModal(modal);
}

export async function handleSiliaClearButton(interaction: ButtonInteraction): Promise<void> {
  const session = getOrInitUserSiliaSession(interaction.user.id);
  session.history = [];
  session.lastIdeaSummary = undefined;

  if (interaction.channel && interaction.channel.isTextBased() && 'messages' in interaction.channel) {
    for (const msgId of session.trackedMessageIds) {
      await interaction.channel.messages.delete(msgId).catch(() => undefined);
    }
  }
  session.trackedMessageIds = [];

  const embed = createSiliaEmbed('secondary')
    .setTitle('Memória & Conversa Reiniciadas • Silia AI')
    .setDescription(
      `> ${em('silia')} Tudo limpinho! Nosso histórico foi reiniciado e o canal está organizado. Quando quiser conversar de novo ou aprimorar outra ideia, é só clicar em um dos botões ou me mandar mensagem!`,
    );

  await interaction.reply({
    embeds: [embed],
    files: collectBrandFiles(['siliaAvatar', 'siliaEmblem', 'divider']),
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleSiliaChannelMessage(message: Message): Promise<boolean> {
  if (message.author.bot || !message.guild) {
    return false;
  }

  const siliaChannelId = getSiliaChannelId(message.guild);
  const isMainSiliaChannel = message.channelId === siliaChannelId;
  const isSiliaPrivateThread =
    message.channel.isThread() && message.channel.parentId === siliaChannelId;

  if (!isMainSiliaChannel && !isSiliaPrivateThread) {
    return false;
  }

  const prompt = message.content.trim();
  if (!prompt) {
    return true;
  }

  const session = getOrInitUserSiliaSession(message.author.id);
  const displayName = message.member?.displayName ?? message.author.displayName;

  if ('sendTyping' in message.channel) {
    await message.channel.sendTyping().catch(() => undefined);
  }

  const replyText = await askSiliaAI(prompt, session.mode, displayName, session.history);

  session.history.push({ role: 'user', content: prompt });
  session.history.push({ role: 'assistant', content: replyText });
  if (session.history.length > 12) {
    session.history = session.history.slice(-12);
  }

  if (session.mode === 'ideate') {
    session.lastIdeaSummary = `Ideia base: ${prompt}\n\nSugestão Silia AI:\n${replyText}`.slice(0, 1400);
  }

  const modeBadge =
    session.mode === 'ideate'
      ? 'Aprimorando Ideia de Design • Silia AI'
      : 'Conversa com Silia AI • LWX Lab';

  const replyEmbed = createSiliaEmbed(session.mode === 'ideate' ? 'accent' : 'primary')
    .setTitle(modeBadge)
    .setDescription(`${em('silia')} ${replyText}`);

  const files = collectBrandFiles(['siliaAvatar', 'siliaEmblem', 'divider']);
  const components = [createSiliaConversationControlRow(session.mode)];

  if (isMainSiliaChannel) {
    // Keep track of messages in the main channel so the user can clean them or auto-clean after 5 minutes
    // to keep the main #🤖・silia-ai panel spotless!
    session.trackedMessageIds.push(message.id);

    const botReply = await message.reply({
      embeds: [replyEmbed],
      files,
      components,
    });
    session.trackedMessageIds.push(botReply.id);

    setTimeout(() => {
      void message.delete().catch(() => undefined);
      void botReply.delete().catch(() => undefined);
    }, 5 * 60 * 1000);
  } else {
    // Inside the user's private thread, messages stay privately forever!
    await message.reply({
      embeds: [replyEmbed],
      files,
      components,
    });
  }

  return true;
}
