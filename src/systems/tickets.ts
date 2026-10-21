import {
  ActionRowBuilder,
  ChannelType,
  MessageFlags,
  ModalBuilder,
  OverwriteType,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type EmbedBuilder,
  type Guild,
  type GuildMember,
  type ModalSubmitInteraction,
  type TextChannel,
} from 'discord.js';
import { BOT_CONFIG } from '../config/botConfig.js';
import { pricingServices } from '../data/pricing.js';
import {
  createReviewPromptButtonRow,
  createTicketControlRow,
  createTicketStageSelectRow,
} from '../ui/components.js';
import {
  collectBrandFiles,
  createDoubleBannerEmbeds,
  createStudioEmbed,
} from '../ui/embeds.js';
import { em } from '../ui/emojis.js';
import { registerOrderFromTicket } from './orders.js';

const BUDGET_SERVICE_INPUT_ID = 'lwx:budget:service';
const BUDGET_DEADLINE_INPUT_ID = 'lwx:budget:deadline';
const BUDGET_ESTIMATE_INPUT_ID = 'lwx:budget:estimate';
const BUDGET_BRIEFING_INPUT_ID = 'lwx:budget:briefing';

export type BudgetSubmission = {
  service: string;
  deadline: string;
  estimate: string;
  briefing: string;
};

export function sanitizeTicketChannelName(username: string, userId: string): string {
  const cleanUser = username
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 18);

  const suffix = userId.slice(-4);
  const base = cleanUser.length > 0 ? cleanUser : 'cliente';
  return `pedido-${base}-${suffix}`;
}

export function buildBudgetModal(prefilledService?: string, prefilledBriefing?: string): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(BOT_CONFIG.customIds.budgetModal)
    .setTitle('Solicitar Orçamento • LWX Lab');

  const serviceInput = new TextInputBuilder()
    .setCustomId(BUDGET_SERVICE_INPUT_ID)
    .setLabel('Qual projeto você deseja encomendar?')
    .setPlaceholder('Ex.: Banner HD, Identidade Visual, Ilustração, Pack Visual...')
    .setMinLength(2)
    .setMaxLength(100)
    .setRequired(true)
    .setStyle(TextInputStyle.Short);

  if (prefilledService) {
    serviceInput.setValue(prefilledService.slice(0, 100));
  }

  const deadlineInput = new TextInputBuilder()
    .setCustomId(BUDGET_DEADLINE_INPUT_ID)
    .setLabel('Prazo desejado / Urgência')
    .setPlaceholder('Ex.: 2 dias, Esta semana, Sem pressa...')
    .setMinLength(2)
    .setMaxLength(80)
    .setRequired(true)
    .setStyle(TextInputStyle.Short);

  const estimateInput = new TextInputBuilder()
    .setCustomId(BUDGET_ESTIMATE_INPUT_ID)
    .setLabel('Orçamento estimado (Opcional)')
    .setPlaceholder('Ex.: R$ 20, R$ 35, A combinar conforme tabela...')
    .setRequired(false)
    .setMaxLength(60)
    .setStyle(TextInputStyle.Short);

  const briefingInput = new TextInputBuilder()
    .setCustomId(BUDGET_BRIEFING_INPUT_ID)
    .setLabel('Detalhes da ideia, estilo, cores e texto')
    .setPlaceholder('Descreva como imagina a arte, referências, personagem, cores principais e textos...')
    .setMinLength(10)
    .setMaxLength(1500)
    .setRequired(true)
    .setStyle(TextInputStyle.Paragraph);

  if (prefilledBriefing) {
    briefingInput.setValue(prefilledBriefing.slice(0, 1450));
  }

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(serviceInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(deadlineInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(estimateInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(briefingInput),
  );

  return modal;
}

export function buildTicketBriefingEmbed(
  requesterId: string,
  requesterTag: string,
  submission: BudgetSubmission,
): EmbedBuilder {
  return createDoubleBannerEmbeds('budget', 'primary')
    .bodyEmbed.setTitle(`Dossiê de Encomenda • ${submission.service}`)
    .setDescription(
      [
        `> ${em('knight')} Olá, <@${requesterId}>! Sua sala exclusiva de direção de arte foi criada.`,
        '> Você já pode enviar imagens de referência, links ou detalhes complementares aqui no chat.',
        '',
        `### ${em('palette')} Briefing Descrito pelo Cliente`,
        `>>> ${submission.briefing}`,
      ].join('\n'),
    )
    .addFields(
      {
        name: `${em('crown')} Cliente`,
        value: `<@${requesterId}>\n-# ${requesterTag}`,
        inline: true,
      },
      {
        name: `${em('flame')} Serviço Solicitado`,
        value: `**${submission.service}**`,
        inline: true,
      },
      {
        name: `${em('spark')} Prazo & Estimativa`,
        value: `**${submission.deadline}**\n-# Orçamento: ${submission.estimate || 'Conforme tabela LWX'}`,
        inline: true,
      },
    );
}

async function findExistingOpenTicket(guild: Guild, userId: string): Promise<TextChannel | null> {
  const marker = `lwx-ticket-owner:${userId}`;
  const cached = guild.channels.cache.find(
    (channel): channel is TextChannel =>
      channel.type === ChannelType.GuildText &&
      channel.parentId === BOT_CONFIG.categories.tickets &&
      Boolean(channel.topic?.includes(marker)),
  );

  if (cached) {
    return cached;
  }

  const fetched = await guild.channels.fetch();
  for (const [, channel] of fetched) {
    if (
      channel &&
      channel.type === ChannelType.GuildText &&
      channel.parentId === BOT_CONFIG.categories.tickets &&
      channel.topic?.includes(marker)
    ) {
      return channel;
    }
  }

  return null;
}

export async function handleBudgetOpenModalButton(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
): Promise<void> {
  if (interaction.isButton()) {
    if (interaction.customId === BOT_CONFIG.customIds.budgetQuickBanner) {
      await openBudgetModalForService(interaction, 'banner');
      return;
    }
    if (interaction.customId === BOT_CONFIG.customIds.budgetQuickArt) {
      await openBudgetModalForService(interaction, 'illustration');
      return;
    }
    if (interaction.customId === BOT_CONFIG.customIds.budgetQuickBrand) {
      await openBudgetModalForService(interaction, 'logo');
      return;
    }
  }

  await interaction.showModal(buildBudgetModal());
}

export async function openBudgetModalForService(
  interaction: ButtonInteraction,
  serviceId: string,
): Promise<void> {
  const matched = pricingServices.find((s) => s.id === serviceId);
  const prefill = matched ? `${matched.name} (${matched.priceLabel})` : undefined;
  await interaction.showModal(buildBudgetModal(prefill));
}

export async function handleBudgetModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({
      content: 'Esta ação só pode ser utilizada dentro do servidor.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const service = interaction.fields.getTextInputValue(BUDGET_SERVICE_INPUT_ID).trim();
  const deadline = interaction.fields.getTextInputValue(BUDGET_DEADLINE_INPUT_ID).trim();
  const estimate = interaction.fields.getTextInputValue(BUDGET_ESTIMATE_INPUT_ID).trim();
  const briefing = interaction.fields.getTextInputValue(BUDGET_BRIEFING_INPUT_ID).trim();

  if (service.length < 2 || deadline.length < 2 || briefing.length < 10) {
    await interaction.reply({
      embeds: [
        createStudioEmbed('danger')
          .setTitle('Briefing Incompleto')
          .setDescription('> Preencha o serviço, prazo e detalhes com pelo menos 10 caracteres.'),
      ],
      files: collectBrandFiles(['emblem']),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const existingTicket = await findExistingOpenTicket(guild, interaction.user.id);
  if (existingTicket) {
    const existingEmbed = createStudioEmbed('warning')
      .setTitle('Atendimento Já em Andamento')
      .setDescription(
        `> ${em('ticket')} Você já possui uma sala de orçamento ativa em ${existingTicket}. Envie novas referências diretamente lá!`,
      );

    await interaction.editReply({
      embeds: [existingEmbed],
      files: collectBrandFiles(['emblem']),
    });
    return;
  }

  const channelName = sanitizeTicketChannelName(interaction.user.username, interaction.user.id);
  const botId = interaction.client.user.id;

  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      type: OverwriteType.Role,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: interaction.user.id,
      type: OverwriteType.Member,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
    {
      id: BOT_CONFIG.roles.staff,
      type: OverwriteType.Role,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ManageMessages,
      ],
    },
    {
      id: botId,
      type: OverwriteType.Member,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
      ],
    },
  ];

  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: BOT_CONFIG.categories.tickets,
    topic: `lwx-ticket-owner:${interaction.user.id} | Serviço: ${service} | Prazo: ${deadline}`,
    permissionOverwrites,
    reason: `Novo orçamento LWX Lab solicitado por ${interaction.user.tag}`,
  });

  const newOrder = registerOrderFromTicket(
    interaction.user.id,
    interaction.user.tag,
    service,
    deadline,
    briefing,
  );

  const { headerEmbed, files } = createDoubleBannerEmbeds('budget', 'primary');
  const briefingEmbed = buildTicketBriefingEmbed(interaction.user.id, interaction.user.tag, {
    service,
    deadline,
    estimate,
    briefing,
  });

  await ticketChannel.send({
    content: `${em('flame')} <@${interaction.user.id}> • <@&${BOT_CONFIG.roles.staff}> • **Pedido #${newOrder.id}**`,
    embeds: [headerEmbed, briefingEmbed],
    files,
    components: [createTicketControlRow(), createTicketStageSelectRow(newOrder.id)],
  });

  const createdEmbed = createStudioEmbed('primary')
    .setTitle(`Sala de Orçamento Criada • #${newOrder.id}`)
    .setDescription(
      [
        `> ${em('verify')} Seu canal exclusivo foi aberto em ${ticketChannel} com o código **#${newOrder.id}**.`,
        '> Clique no canal para acompanhar o atendimento e enviar referências visuais.',
      ].join('\n'),
    );

  await interaction.editReply({
    embeds: [createdEmbed],
    files: collectBrandFiles(['emblem']),
  });
}

function canCloseTicket(member: GuildMember | null, channelTopic: string | null, userId: string): boolean {
  if (channelTopic?.includes(`lwx-ticket-owner:${userId}`)) {
    return true;
  }

  if (!member) {
    return false;
  }

  return (
    member.roles.cache.has(BOT_CONFIG.roles.staff) ||
    member.permissions.has(PermissionFlagsBits.ManageChannels) ||
    member.permissions.has(PermissionFlagsBits.Administrator)
  );
}

export async function handleTicketClaimButton(interaction: ButtonInteraction): Promise<void> {
  const guild = interaction.guild;
  const channel = interaction.channel;

  if (!guild || !channel || channel.type !== ChannelType.GuildText) {
    await interaction.reply({
      content: 'Este comando só pode ser utilizado em um canal de ticket.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const member = await guild.members.fetch(interaction.user.id).catch(() => null);
  const isStaff =
    member?.roles.cache.has(BOT_CONFIG.roles.staff) ||
    member?.permissions.has(PermissionFlagsBits.ManageChannels) ||
    member?.permissions.has(PermissionFlagsBits.Administrator);

  if (!isStaff) {
    await interaction.reply({
      embeds: [
        createStudioEmbed('warning')
          .setTitle('Ação Restrita à Equipe')
          .setDescription(`> ${em('knight')} Apenas membros da equipe **LWX Lab** podem assumir o atendimento.`),
      ],
      files: collectBrandFiles(['emblem']),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const claimEmbed = createStudioEmbed('secondary')
    .setTitle('Atendimento Assumido • Direção de Arte')
    .setDescription(
      [
        `> ${em('crown')} O designer ${interaction.user} assumiu a condução deste projeto!`,
        '> Aguarde a análise do seu briefing e o alinhamento dos próximos passos.',
      ].join('\n'),
    );

  await interaction.reply({
    embeds: [claimEmbed],
    files: collectBrandFiles(['emblem']),
  });
}

export async function handleTicketCloseButton(interaction: ButtonInteraction): Promise<void> {
  const guild = interaction.guild;
  const channel = interaction.channel;

  if (!guild || !channel || channel.type !== ChannelType.GuildText) {
    await interaction.reply({
      content: 'Este botão só pode ser utilizado dentro de um canal de orçamento.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const member = await guild.members.fetch(interaction.user.id).catch(() => null);
  const allowed = canCloseTicket(member, channel.topic, interaction.user.id);

  if (!allowed) {
    await interaction.reply({
      content: 'Apenas o autor do orçamento ou a equipe pode encerrar este ticket.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const closingEmbed = createStudioEmbed('scarf')
    .setTitle('Atendimento Finalizado • LWX Lab')
    .setDescription(
      [
        `> ${em('verify')} Canal encerrado por ${interaction.user}.`,
        `> Ficou satisfeito com seu projeto? Deixe sua avaliação abaixo ou em <#${BOT_CONFIG.channels.reviewPrompt}>!`,
        '-# Este canal será arquivado em 5 segundos.',
      ].join('\n'),
    );

  await interaction.reply({
    embeds: [closingEmbed],
    files: collectBrandFiles(['emblem']),
    components: [createReviewPromptButtonRow()],
  });

  setTimeout(() => {
    void channel.delete(`Ticket encerrado por ${interaction.user.tag}`).catch(() => undefined);
  }, 5000);
}
