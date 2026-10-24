import fs from 'node:fs';
import path from 'node:path';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ThreadAutoArchiveDuration,
  type ButtonInteraction,
  type Guild,
  type Message,
  type PrivateThreadChannel,
  type TextChannel,
} from 'discord.js';
import { askSiliaAI, type SiliaMode } from '../ai/chatbot.js';
import { BOT_CONFIG } from '../config/botConfig.js';
import {
  buildAdaptiveDiscoveryQuestions,
  generateStructuredCreativeProposal,
  updateDiscoveryFromMessage,
} from '../silia/creativeEngine.js';
import { generateCreativeBriefingDocx } from '../silia/docxGenerator.js';
import {
  getStoredSession,
   saveSessionsToDisk,
  uploadBriefingDocxToGoogleDrive,
  upsertStoredSession,
} from '../silia/storage.js';
import type {
  CreativeProposal,
  RejectionDimension,
  SiliaCreativeSession,
} from '../silia/types.js';
import { collectBrandFiles, createSiliaEmbed } from '../ui/embeds.js';
import { btnEmoji, em } from '../ui/emojis.js';
import { buildBudgetModal } from './tickets.js';

const RUNTIME_CONFIG_PATH = path.resolve(process.cwd(), 'data', 'runtime.json');

export function getSiliaChannelId(guild?: Guild | null): string {
  try {
    if (fs.existsSync(RUNTIME_CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(RUNTIME_CONFIG_PATH, 'utf8')) as {
        siliaChannelId?: string;
      };
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
      existing = JSON.parse(fs.readFileSync(RUNTIME_CONFIG_PATH, 'utf8')) as Record<
        string,
        unknown
      >;
    }
  } catch {
    existing = {};
  }
  existing.siliaChannelId = channelId;
  fs.writeFileSync(RUNTIME_CONFIG_PATH, JSON.stringify(existing, null, 2), 'utf8');
}

export function getOrInitUserSiliaSession(
  userId: string,
  mode?: SiliaMode,
  username = 'Cliente',
): SiliaCreativeSession {
  const existing = getStoredSession(userId);
  if (existing) {
    if (mode && existing.mode !== mode) {
      existing.mode = mode;
      if (mode === 'ideate' && existing.stage === 'idle') {
        existing.stage = 'discovery';
      }
    }
    if (username && username !== 'Cliente') {
      existing.username = username;
    }
    existing.updatedAt = Date.now();
    upsertStoredSession(existing);
    return existing;
  }

  const initialMode = mode ?? 'chat';
  const created: SiliaCreativeSession = {
    sessionId: `SILIA-${userId.slice(-4)}-${Date.now().toString(36).toUpperCase()}`,
    userId,
    username,
    mode: initialMode,
    stage: initialMode === 'ideate' ? 'discovery' : 'idle',
    history: [],
    discovery: {
      clientProvidedReferences: [],
      questionsAskedCount: 0,
      readyForProposal: false,
    },
    proposals: [],
    rejections: [],
    processedInteractionKeys: [],
    trackedMessageIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  upsertStoredSession(created);
  return created;
}

export function resetSessionConversationState(session: SiliaCreativeSession): void {
  session.history = [];
  session.stage = session.mode === 'ideate' ? 'discovery' : 'idle';
  session.discovery = {
    clientProvidedReferences: [],
    questionsAskedCount: 0,
    readyForProposal: false,
  };
  session.proposals = [];
  session.activeProposalId = undefined;
  session.approvedProposalId = undefined;
  session.rejections = [];
  session.processedInteractionKeys = [];
  session.approvedBriefing = undefined;
  session.lastIdeaSummary = undefined;
  session.trackedMessageIds = [];
  session.updatedAt = Date.now();
  upsertStoredSession(session);
}

export function createSiliaConversationControlRow(
  currentMode: SiliaMode,
): ActionRowBuilder<ButtonBuilder> {
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

export function createProposalDecisionRow(proposalId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${BOT_CONFIG.customIds.siliaProposalApprove}:${proposalId}`)
      .setLabel('Gostei dessa ideia')
      .setEmoji(btnEmoji('verify'))
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${BOT_CONFIG.customIds.siliaProposalReject}:${proposalId}`)
      .setLabel('Prefiro outra ideia')
      .setEmoji(btnEmoji('palette'))
      .setStyle(ButtonStyle.Primary),
  );
}

export function createDiagnosticFocusRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${BOT_CONFIG.customIds.siliaDiagFocus}:colors`)
      .setLabel('Mudar Cores & Paleta')
      .setEmoji(btnEmoji('palette'))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${BOT_CONFIG.customIds.siliaDiagFocus}:style`)
      .setLabel('Mudar Estilo & Clima')
      .setEmoji(btnEmoji('flame'))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${BOT_CONFIG.customIds.siliaDiagFocus}:composition`)
      .setLabel('Mudar Composição & Fonte')
      .setEmoji(btnEmoji('spark'))
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${BOT_CONFIG.customIds.siliaDiagFocus}:concept`)
      .setLabel('Nova Ideia do Zero')
      .setEmoji(btnEmoji('silia'))
      .setStyle(ButtonStyle.Secondary),
  );
}

export function createBriefingDeliveredActionRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.siliaContinueChat)
      .setLabel('Continuar Chat')
      .setEmoji(btnEmoji('silia'))
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.siliaToBriefing)
      .setLabel('Abrir Orçamento com Esta Ideia')
      .setEmoji(btnEmoji('ticket'))
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.siliaFinalizeClose)
      .setLabel('Finalizar Atendimento')
      .setEmoji(btnEmoji('verify'))
      .setStyle(ButtonStyle.Danger),
  );
}

export function buildCreativeProposalEmbed(proposal: CreativeProposal): EmbedBuilder {
  const paletteLines = proposal.palette.map(
    (c) =>
      `• **${c.name}** (\`${c.hex}\` • ${c.proportionPct}%) — *${c.role}*: ${c.usage}`,
  );

  const scriptLines = proposal.visualScript.map(
    (s) => `**${s.order}. [${s.plane}]** ${s.element} — *${s.lightingAndFocus}*`,
  );

  const refLines = proposal.references.slice(0, 3).map(
    (r, idx) =>
      `**Ref #${idx + 1} (${r.category}):** ${r.title}\n-# ↳ *Observar:* ${r.whatItDemonstrates}`,
  );

  const descriptionParts = [
    `> ${em('silia')} **Proposta de Direção Criativa #${proposal.attemptNumber}** • ID \`${proposal.proposalId}\``,
    `> **Peça:** ${proposal.projectTypeLabel} | **Proporção:** ${proposal.composition.aspectRatio}`,
    ...(proposal.whyDistinctFromPrevious
      ? [`> ${em('spark')} **O que mudou nesta nova rota:** ${proposal.whyDistinctFromPrevious}`]
      : []),
    '',
    `### ${em('flame')} Conceito & Direção de Arte`,
    `${proposal.creativeConcept.summary}`,
    `-# **Mood:** ${proposal.creativeConcept.moodKeywords.join(' • ')}`,
    '',
    `### ${em('palette')} Paleta Cromática Oficial (HEX & Proporção)`,
    ...paletteLines,
    '',
    `### ${em('spark')} Tipografia & Hierarquia`,
    `• **Título (Headline):** ${proposal.typography.titleFont}`,
    `• **Subtítulo:** ${proposal.typography.subtitleFont}`,
    `• **Contraste & Leitura:** ${proposal.typography.contrastNote}`,
    '',
    `### ${em('knight')} Roteiro Visual & Composição`,
    `• **Ponto Focal:** ${proposal.composition.focalPoint.label} (X:${proposal.composition.focalPoint.xPct}%, Y:${proposal.composition.focalPoint.yPct}%)`,
    `• **Fluxo Ocular:** ${proposal.composition.readingFlow}`,
    ...scriptLines,
    '',
    `### 🖼️ Referências Visuais Anexadas`,
    ...refLines,
    '',
    `> **O que você achou dessa direção?** Clique em **Gostei dessa ideia** para eu gerar seu **Briefing Executável em Word (\`.docx\`)** ou em **Prefiro outra ideia** para explorarmos um caminho totalmente diferente!`,
  ];

  return createSiliaEmbed('accent')
    .setTitle(`✨ ${proposal.title}`)
    .setDescription(descriptionParts.join('\n').slice(0, 4050));
}

export function buildProposalAttachments(proposal: CreativeProposal): AttachmentBuilder[] {
  const attachments = collectBrandFiles(['siliaAvatar', 'siliaEmblem', 'divider']);

  for (const ref of proposal.references) {
    if (!ref.buffer) continue;
    if (ref.id.startsWith('ref-palette-')) {
      attachments.push(new AttachmentBuilder(ref.buffer, { name: 'silia-palette-strip.png' }));
    } else if (ref.id.startsWith('ref-comp-')) {
      attachments.push(new AttachmentBuilder(ref.buffer, { name: 'silia-composition-map.png' }));
    } else if (attachments.length < 6) {
      const ext = ref.mimeType.includes('png') ? 'png' : 'jpg';
      attachments.push(new AttachmentBuilder(ref.buffer, { name: `${ref.id}.${ext}` }));
    }
  }

  return attachments;
}

async function ensurePrivateSiliaThread(
  channel: TextChannel,
  userId: string,
  username: string,
  mode: SiliaMode,
): Promise<PrivateThreadChannel | null> {
  const session = getOrInitUserSiliaSession(userId, mode, username);
  const cleanName = `🔒・silia-${username.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 14) || 'membro'}`;

  try {
    const activeThreads = await channel.threads.fetchActive().catch(() => null);
    if (activeThreads) {
      const existing = activeThreads.threads.find(
        (t) => t.id === session.threadId || t.name === cleanName,
      ) as PrivateThreadChannel | undefined;

      if (existing) {
        session.threadId = existing.id;
        upsertStoredSession(session);
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
    upsertStoredSession(session);
    return thread as PrivateThreadChannel;
  } catch {
    return null;
  }
}

export function buildSiliaModeActivationEmbed(
  mode: SiliaMode,
  displayName: string,
  threadId?: string,
) {
  const isIdeate = mode === 'ideate';
  const title = isIdeate
    ? 'Modo Ativo • Direção Criativa com Silia AI'
    : 'Modo Ativo • Conversar com a Silia AI';

  const descriptionLines = isIdeate
    ? [
        `> ${em('silia')} **Olá, ${displayName}! Eu sou sua Diretora Criativa aqui no LWX Lab!** *(piscadinha dourada ✨)*`,
        '> Me conte o que você quer criar (ex.: *"Quero um banner pro meu servidor"*, *"Quero uma logo estilo cavaleiro"*, *"Quero desenhar meu OC"*) e eu monto uma **Proposta Criativa Completa** com paleta HEX, tipografia, referências visuais e gero seu **Briefing Oficial em `.docx`** quando você aprovar!',
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
  const displayName =
    interaction.guild && interaction.member && 'displayName' in interaction.member
      ? interaction.member.displayName
      : interaction.user.displayName;

  const session = getOrInitUserSiliaSession(interaction.user.id, mode, displayName);

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

  upsertStoredSession(session);

  await interaction.reply({
    embeds: [embed],
    files,
    components,
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleSiliaToBriefingButton(interaction: ButtonInteraction): Promise<void> {
  const session = getStoredSession(interaction.user.id);
  const approvedProposal = session?.proposals.find(
    (p) => p.proposalId === session.approvedProposalId,
  );
  const activeProposal = session?.proposals.find((p) => p.proposalId === session.activeProposalId);
  const targetProposal = approvedProposal || activeProposal;

  const prefillService = targetProposal
    ? `${targetProposal.projectTypeLabel} (${targetProposal.proposalId})`
    : session?.mode === 'ideate'
      ? 'Projeto Criativo (Refinado com Silia AI)'
      : undefined;

  let prefillBriefing = session?.lastIdeaSummary;
  if (session?.approvedBriefing?.driveWebViewLink && prefillBriefing) {
    prefillBriefing = `${prefillBriefing}\n• Link Google Drive: ${session.approvedBriefing.driveWebViewLink}`.slice(
      0,
      1450,
    );
  }

  const modal = buildBudgetModal(prefillService, prefillBriefing);
  await interaction.showModal(modal);
}

/**
 * Fixed "Limpar Conversa" button handler:
 * - Resets the user's SiliaCreativeSession state (history, discovery, proposals, etc.)
 * - If clicked inside a Private Thread (`🔒・silia-usuario`), fetches and deletes the conversation
 *   messages inside that thread and posts a fresh welcome card!
 * - If clicked in the main Silia channel, deletes all tracked messages and recent user/bot turns
 *   without touching the fixed channel panel (`LWX_PANEL_SILIA_V1`).
 */
export async function handleSiliaClearButton(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const displayName =
    interaction.guild && interaction.member && 'displayName' in interaction.member
      ? interaction.member.displayName
      : interaction.user.displayName;

  const session = getOrInitUserSiliaSession(interaction.user.id, undefined, displayName);
  const trackedIds = [...session.trackedMessageIds];
  const currentMode = session.mode;

  resetSessionConversationState(session);

  const channel = interaction.channel;
  let deletedCount = 0;

  if (channel && channel.isThread()) {
    // Inside the user's private thread: fetch messages and clean them all up!
    try {
      const fetched = await channel.messages.fetch({ limit: 100 });
      const deletable = fetched.filter((m) => !m.pinned);

      if ('bulkDelete' in channel && typeof channel.bulkDelete === 'function') {
        const bulkDeleted = await channel.bulkDelete(deletable, true).catch(() => null);
        if (bulkDeleted) {
          deletedCount += bulkDeleted.size;
        }
      }

      // Fallback individual deletion for any remaining messages
      for (const [, msg] of deletable) {
        await msg
          .delete()
          .then(() => {
            deletedCount += 1;
          })
          .catch(() => undefined);
      }

      // Send a fresh clean activation card at the top of the emptied private thread
      const freshEmbed = buildSiliaModeActivationEmbed(currentMode, displayName, channel.id);
      await channel
        .send({
          content: `${em('silia')} <@${interaction.user.id}>`,
          embeds: [freshEmbed],
          files: collectBrandFiles(['siliaAvatar', 'siliaEmblem', 'divider']),
          components: [createSiliaConversationControlRow(currentMode)],
        })
        .catch(() => undefined);
    } catch {
      // Ignore permission/fetch errors
    }
  } else if (channel && channel.isTextBased() && 'messages' in channel) {
    // Inside the main Silia channel: delete tracked message IDs + any recent unpinned messages from this user
    for (const msgId of trackedIds) {
      await channel.messages
        .delete(msgId)
        .then(() => {
          deletedCount += 1;
        })
        .catch(() => undefined);
    }

    try {
      const recent = await channel.messages.fetch({ limit: 40 });
      for (const [, msg] of recent) {
        const isFixedPanel = msg.embeds.some((e) =>
          e.footer?.text?.includes(BOT_CONFIG.panelMarkers.silia),
        );
        if (isFixedPanel || msg.pinned) continue;

        const isFromUser = msg.author.id === interaction.user.id;
        const isBotReplyToUser =
          msg.author.bot && msg.mentions.users.has(interaction.user.id);

        if (isFromUser || isBotReplyToUser) {
          await msg
            .delete()
            .then(() => {
              deletedCount += 1;
            })
            .catch(() => undefined);
        }
      }
    } catch {
      // Ignore fetch errors
    }
  }

  const embed = createSiliaEmbed('secondary')
    .setTitle('Memória & Conversa Reiniciadas • Silia AI')
    .setDescription(
      `> ${em('silia')} Tudo limpinho, **${displayName}**! Nosso histórico criativo foi reiniciado${deletedCount > 0 ? ` e as mensagens anteriores foram apagadas` : ''}. Quando quiser começar outra ideia ou bater um papo novo, é só mandar mensagem!`,
    );

  await interaction.editReply({
    embeds: [embed],
    files: collectBrandFiles(['siliaAvatar', 'siliaEmblem', 'divider']),
  });
}

/**
 * Handles "Gostei dessa ideia" (Approve) and "Prefiro outra ideia" (Reject) buttons.
 */
export async function handleSiliaProposalDecisionButton(
  interaction: ButtonInteraction,
  decision: 'approve' | 'reject',
): Promise<void> {
  const parts = interaction.customId.split(':');
  const proposalId = parts[parts.length - 1] || '';

  const session = getStoredSession(interaction.user.id);
  if (!session) {
    await interaction.reply({
      content: '⚠️ Apenas o autor desta sessão criativa pode aprovar ou recusar esta proposta.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const proposal = session.proposals.find((p) => p.proposalId === proposalId);
  if (!proposal || proposal.userId !== interaction.user.id) {
    await interaction.reply({
      content: '⚠️ Esta proposta pertence a outra sessão ou não foi encontrada.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const idemKey = `${decision}:${proposalId}`;
  if (session.processedInteractionKeys.includes(idemKey)) {
    await interaction.reply({
      content:
        decision === 'approve'
          ? '✅ Esta proposta já foi aprovada e o seu briefing `.docx` já foi gerado!'
          : '🔄 Você já solicitou uma nova direção para esta proposta.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (session.activeProposalId && session.activeProposalId !== proposalId) {
    await interaction.reply({
      content: `⚠️ Esta proposta (\`${proposalId}\`) já foi substituída pela proposta mais recente (\`${session.activeProposalId}\`). Utilize os botões da última proposta enviada!`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  session.processedInteractionKeys.push(idemKey);
  upsertStoredSession(session);

  await interaction.deferReply();

  const displayName =
    interaction.guild && interaction.member && 'displayName' in interaction.member
      ? interaction.member.displayName
      : interaction.user.displayName;

  if (decision === 'approve') {
    proposal.status = 'approved';
    session.approvedProposalId = proposal.proposalId;
    session.stage = 'approved';

    const docxResult = await generateCreativeBriefingDocx(
      proposal,
      displayName,
      session.rejections,
    );

    const driveUpload = await uploadBriefingDocxToGoogleDrive(
      docxResult.fileName,
      docxResult.buffer,
    );

    session.approvedBriefing = {
      briefingId: `BRIEF-${proposal.proposalId}`,
      proposalId: proposal.proposalId,
      sessionId: session.sessionId,
      userId: session.userId,
      approvedAt: new Date().toISOString(),
      fileName: docxResult.fileName,
      localFilePath: docxResult.localFilePath,
      driveFileId: driveUpload.fileId,
      driveWebViewLink: driveUpload.webViewLink,
      executiveSummary: docxResult.executiveSummary,
    };

    session.lastIdeaSummary = docxResult.executiveSummary;
    session.stage = 'briefing_delivered';
    upsertStoredSession(session);

    const approvedEmbed = createSiliaEmbed('secondary')
      .setTitle(`🎉 Briefing Oficial Gerado em .DOCX • ${proposal.title}`)
      .setDescription(
        [
          `> ${em('silia')} **Perfeito, ${displayName}! Congelei todos os detalhes da Proposta #${proposal.attemptNumber} (\`${proposal.proposalId}\`)!** *(piscadinha dourada ✨)*`,
          '> Aqui está o seu **Briefing Criativo Executável em formato Microsoft Word (`.docx`)**, 100% editável, contendo:',
          '• **Capa + 14 Seções Técnicas** prontas para o designer **Llewxam**;',
          '• **Amostras Visuais de Cor (PNG)** com códigos HEX e RGB exatos;',
          '• **Diagrama de Composição, Ponto Focal e Margens Seguras** embutido;',
          '• **Moodboard de Referências Visuais** e roteiro passo a passo de execução.',
          ...(driveUpload.webViewLink
            ? [`\n☁️ **Salvo automaticamente no Google Drive:** [Abrir no Drive](${driveUpload.webViewLink})`]
            : []),
          '',
          `### ${em('spark')} O que você deseja fazer agora?`,
          '• Clique em **Continuar Chat** se quiser continuar conversando comigo nesta sala;',
          '• Clique em **Abrir Orçamento com Esta Ideia** para já abrir seu pedido oficial com o **Llewxam**;',
          '• Clique em **Finalizar Atendimento** para encerrar e excluir esta sala privada da IA.',
        ].join('\n'),
      );

    const docxAttachment = new AttachmentBuilder(docxResult.buffer, {
      name: docxResult.fileName,
    });
    const brandFiles = collectBrandFiles(['siliaAvatar', 'siliaEmblem', 'divider']);

    await interaction.editReply({
      embeds: [approvedEmbed],
      files: [...brandFiles, docxAttachment],
      components: [createBriefingDeliveredActionRow()],
    });
    return;
  }

  // Decision === 'reject' ("Prefiro outra ideia")
  proposal.status = 'rejected';
  session.rejections.push({
    proposalId: proposal.proposalId,
    attemptNumber: proposal.attemptNumber,
    rejectedAt: new Date().toISOString(),
    reasonCategory: 'unspecified',
  });

  // Check if this is the 3rd (or later) rejection -> Enter Adaptive Diagnostic Stage!
  if (session.rejections.length >= 3) {
    session.stage = 'diagnostic';
    upsertStoredSession(session);

    const diagEmbed = createSiliaEmbed('warning')
      .setTitle(`🔍 Vamos Afinar Sua Visão Criativa • Diagnóstico Rápido`)
      .setDescription(
        [
          `> ${em('silia')} **${displayName}**, já testamos **${session.rejections.length} direções bem diferentes** e quero acertar em cheio no que você está imaginando!`,
          '> Em vez de eu chutar uma nova tentativa no escuro, me conta rapidinho **o que mais te incomodou nas propostas anteriores**:',
          '',
          '• 🎨 **As Cores / Paleta?** *(Quer outras cores específicas?)*',
          '• ✨ **O Estilo / Clima Visual?** *(Mais clean, mais sombrio, mais anime, mais agressivo?)*',
          '• 📐 **A Composição / Tipografia?** *(Posição dos elementos ou estilo da fonte?)*',
          '',
          '> 👇 **Clique em um dos botões abaixo** ou **escreva direto aqui no chat** o que você quer mudar (pode até mandar um link de referência) que eu gero a nova proposta na hora!',
        ].join('\n'),
      );

    await interaction.editReply({
      embeds: [diagEmbed],
      files: collectBrandFiles(['siliaAvatar', 'siliaEmblem', 'divider']),
      components: [createDiagnosticFocusRow(), createSiliaConversationControlRow('ideate')],
    });
    return;
  }

  // 1st or 2nd rejection: immediately generate a substantially different creative proposal!
  const nextProposal = await generateStructuredCreativeProposal(session);
  session.lastIdeaSummary = `Proposta #${nextProposal.attemptNumber}: ${nextProposal.title}\nConceito: ${nextProposal.creativeConcept.summary}\nCores: ${nextProposal.palette.map((c) => c.hex).join(', ')}`.slice(
    0,
    1400,
  );
  upsertStoredSession(session);

  const nextEmbed = buildCreativeProposalEmbed(nextProposal);
  const nextFiles = buildProposalAttachments(nextProposal);

  await interaction.editReply({
    embeds: [nextEmbed],
    files: nextFiles,
    components: [
      createProposalDecisionRow(nextProposal.proposalId),
      createSiliaConversationControlRow('ideate'),
    ],
  });
}

/**
 * Handles clicks on the 3rd-rejection Diagnostic Focus buttons
 * (`lwx:silia:diag_focus:<dimension>`).
 */
export async function handleSiliaDiagnosticFocusButton(
  interaction: ButtonInteraction,
): Promise<void> {
  const parts = interaction.customId.split(':');
  const dimension = (parts[parts.length - 1] || 'style') as RejectionDimension;

  const displayName =
    interaction.guild && interaction.member && 'displayName' in interaction.member
      ? interaction.member.displayName
      : interaction.user.displayName;

  const session = getOrInitUserSiliaSession(interaction.user.id, 'ideate', displayName);
  const lastRejection = session.rejections[session.rejections.length - 1];
  if (lastRejection) {
    lastRejection.reasonCategory = dimension;
  }

  await interaction.deferReply();

  const nextProposal = await generateStructuredCreativeProposal(
    session,
    dimension,
    `Cliente solicitou mudança focada em: ${dimension}`,
  );
  session.lastIdeaSummary = `Proposta #${nextProposal.attemptNumber}: ${nextProposal.title}\nConceito: ${nextProposal.creativeConcept.summary}\nCores: ${nextProposal.palette.map((c) => c.hex).join(', ')}`.slice(
    0,
    1400,
  );
  upsertStoredSession(session);

  const nextEmbed = buildCreativeProposalEmbed(nextProposal);
  const nextFiles = buildProposalAttachments(nextProposal);

  await interaction.editReply({
    embeds: [nextEmbed],
    files: nextFiles,
    components: [
      createProposalDecisionRow(nextProposal.proposalId),
      createSiliaConversationControlRow('ideate'),
    ],
  });
}

/**
 * Handles the "Continuar Chat" button after the .docx briefing is delivered.
 */
export async function handleSiliaContinueChatButton(
  interaction: ButtonInteraction,
): Promise<void> {
  const displayName =
    interaction.guild && interaction.member && 'displayName' in interaction.member
      ? interaction.member.displayName
      : interaction.user.displayName;

  const session = getOrInitUserSiliaSession(interaction.user.id, 'chat', displayName);
  session.stage = 'idle';
  upsertStoredSession(session);

  const embed = createSiliaEmbed('primary')
    .setTitle('Conversa Continua • Silia AI')
    .setDescription(
      `> ${em('silia')} **Oba, ${displayName}! Continuamos por aqui!** *(piscadinha dourada ✨)*\n> Seu briefing aprovado continua salvo na nossa sessão. Pode conversar comigo sobre o que quiser ou pedir novas sugestões a qualquer momento!`,
    );

  await interaction.reply({
    embeds: [embed],
    files: collectBrandFiles(['siliaAvatar', 'siliaEmblem', 'divider']),
    components: [createSiliaConversationControlRow('chat')],
  });
}

/**
 * Handles the "Finalizar Atendimento" button (`lwx:silia:finalize_close`):
 * Closes and deletes the private AI thread (`🔒・silia-usuario`) so it doesn't stay open forever.
 */
export async function handleSiliaFinalizeCloseButton(
  interaction: ButtonInteraction,
): Promise<void> {
  const channel = interaction.channel;
  const session = getStoredSession(interaction.user.id);

  if (session) {
    session.threadId = undefined;
    upsertStoredSession(session);
    saveSessionsToDisk();
  }

  if (channel && channel.isThread()) {
    const closingEmbed = createSiliaEmbed('secondary')
      .setTitle('Atendimento Criativo Finalizado • Silia AI')
      .setDescription(
        [
          `> ${em('silia')} **Muito obrigada por criar comigo, ${interaction.user}!** *(piscadinha dourada ✨)*`,
          '> Seu briefing continua salvo para quando você abrir seu orçamento com o **Llewxam**.',
          '-# 🔒 Esta sala privada da Silia AI será encerrada e excluída em 3 segundos.',
        ].join('\n'),
      );

    await interaction.reply({
      embeds: [closingEmbed],
      files: collectBrandFiles(['siliaAvatar', 'siliaEmblem', 'divider']),
    });

    setTimeout(() => {
      void channel.delete(`Atendimento Silia AI finalizado por ${interaction.user.tag}`).catch(() => undefined);
    }, 3000);
    return;
  }

  // If clicked in the main channel instead of a private thread, clean up tracked messages and confirm
  await handleSiliaClearButton(interaction);
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

  const displayName = message.member?.displayName ?? message.author.displayName;
  const session = getOrInitUserSiliaSession(message.author.id, undefined, displayName);

  if ('sendTyping' in message.channel) {
    await message.channel.sendTyping().catch(() => undefined);
  }

  // Auto-detect if user in 'chat' mode is explicitly asking to create/design a piece
  const lower = prompt.toLowerCase();
  const explicitDesignIntent =
    /quero (um|uma) (banner|logo|ilustra|arte|pack|thumb|oc)|preciso de (um|uma) (banner|logo|arte)|fazer (um|uma) (banner|logo)|montar (um )?briefing/i.test(
      lower,
    );
  if (session.mode === 'chat' && explicitDesignIntent) {
    session.mode = 'ideate';
    session.stage = 'discovery';
  }

  // MODE 1: Creative Direction ('ideate')
  if (session.mode === 'ideate') {
    session.history.push({ role: 'user', content: prompt });
    if (session.history.length > 12) {
      session.history = session.history.slice(-12);
    }

    // If in 3rd-rejection diagnostic stage, use the user's message as the diagnostic feedback!
    if (session.stage === 'diagnostic') {
      updateDiscoveryFromMessage(session, prompt);
      const focusedDim: RejectionDimension = /cor|paleta|hex|roxo|azul|vermelho/i.test(lower)
        ? 'colors'
        : /fonte|texto|letra|composi|layout|posi/i.test(lower)
          ? 'composition'
          : 'style';

      const proposal = await generateStructuredCreativeProposal(session, focusedDim, prompt);
      session.history.push({
        role: 'assistant',
        content: `[Proposta #${proposal.attemptNumber} Gerada: ${proposal.title}]`,
      });
      session.lastIdeaSummary = `Proposta #${proposal.attemptNumber}: ${proposal.title}\nConceito: ${proposal.creativeConcept.summary}\nCores: ${proposal.palette.map((c) => c.hex).join(', ')}`.slice(
        0,
        1400,
      );
      upsertStoredSession(session);

      const proposalEmbed = buildCreativeProposalEmbed(proposal);
      const files = buildProposalAttachments(proposal);
      const components = [
        createProposalDecisionRow(proposal.proposalId),
        createSiliaConversationControlRow('ideate'),
      ];

      if (isMainSiliaChannel) {
        session.trackedMessageIds.push(message.id);
        const botReply = await message.reply({ embeds: [proposalEmbed], files, components });
        session.trackedMessageIds.push(botReply.id);
        upsertStoredSession(session);
      } else {
        await message.reply({ embeds: [proposalEmbed], files, components });
      }
      return true;
    }

    // Standard Discovery -> Proposal flow
    const discovery = updateDiscoveryFromMessage(session, prompt);

    if (!discovery.readyForProposal) {
      const discoveryReply = buildAdaptiveDiscoveryQuestions(session, displayName);
      session.history.push({ role: 'assistant', content: discoveryReply });
      upsertStoredSession(session);

      const discEmbed = createSiliaEmbed('accent')
        .setTitle('Descoberta Criativa • Silia AI')
        .setDescription(`${em('silia')} ${discoveryReply}`);
      const files = collectBrandFiles(['siliaAvatar', 'siliaEmblem', 'divider']);
      const components = [createSiliaConversationControlRow('ideate')];

      if (isMainSiliaChannel) {
        session.trackedMessageIds.push(message.id);
        const botReply = await message.reply({ embeds: [discEmbed], files, components });
        session.trackedMessageIds.push(botReply.id);
        upsertStoredSession(session);
      } else {
        await message.reply({ embeds: [discEmbed], files, components });
      }
      return true;
    }

    // Ready for structured CreativeProposal!
    const proposal = await generateStructuredCreativeProposal(session);
    session.history.push({
      role: 'assistant',
      content: `[Proposta #${proposal.attemptNumber} Gerada: ${proposal.title}]`,
    });
    session.lastIdeaSummary = `Proposta #${proposal.attemptNumber}: ${proposal.title}\nConceito: ${proposal.creativeConcept.summary}\nCores: ${proposal.palette.map((c) => c.hex).join(', ')}`.slice(
      0,
      1400,
    );
    upsertStoredSession(session);

    const proposalEmbed = buildCreativeProposalEmbed(proposal);
    const files = buildProposalAttachments(proposal);
    const components = [
      createProposalDecisionRow(proposal.proposalId),
      createSiliaConversationControlRow('ideate'),
    ];

    if (isMainSiliaChannel) {
      session.trackedMessageIds.push(message.id);
      const botReply = await message.reply({ embeds: [proposalEmbed], files, components });
      session.trackedMessageIds.push(botReply.id);
      upsertStoredSession(session);

      setTimeout(() => {
        void message.delete().catch(() => undefined);
        void botReply.delete().catch(() => undefined);
      }, 5 * 60 * 1000);
    } else {
      await message.reply({ embeds: [proposalEmbed], files, components });
    }
    return true;
  }

  // MODE 2: Free Conversational Mode ('chat')
  const replyText = await askSiliaAI(prompt, session.mode, displayName, session.history);

  session.history.push({ role: 'user', content: prompt });
  session.history.push({ role: 'assistant', content: replyText });
  if (session.history.length > 12) {
    session.history = session.history.slice(-12);
  }
  upsertStoredSession(session);

  const replyEmbed = createSiliaEmbed('primary')
    .setTitle('Conversa com Silia AI • LWX Lab')
    .setDescription(`${em('silia')} ${replyText}`);

  const files = collectBrandFiles(['siliaAvatar', 'siliaEmblem', 'divider']);
  const components = [createSiliaConversationControlRow(session.mode)];

  if (isMainSiliaChannel) {
    session.trackedMessageIds.push(message.id);

    const botReply = await message.reply({
      embeds: [replyEmbed],
      files,
      components,
    });
    session.trackedMessageIds.push(botReply.id);
    upsertStoredSession(session);

    setTimeout(() => {
      void message.delete().catch(() => undefined);
      void botReply.delete().catch(() => undefined);
    }, 5 * 60 * 1000);
  } else {
    await message.reply({
      embeds: [replyEmbed],
      files,
      components,
    });
  }

  return true;
}
