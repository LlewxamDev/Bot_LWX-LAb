import {
  ButtonInteraction,
  ChannelType,
  OverwriteResolvable,
  PermissionsBitField,
  TextChannel,
} from 'discord.js';
import { ROLE_CONFIG, TIMING } from '../config/botConfig';
import { pricingServices } from '../data/pricing';
import { loadRuntimeState, saveRuntimeState, type TicketState } from '../storage/runtimeStore';
import {
  buildTicketCallDecisionRow,
  buildTicketClaimRow,
  buildTicketFinishRow,
  buildTicketModeButtons,
} from '../ui/components';
import { buildTerminalEmbed } from '../ui/embeds';
import { buildReviewRatingPayload } from './reviews';

type TicketMode = 'text' | 'call';

function normalizeChannelName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 80);
}

function getService(serviceId: string) {
  return pricingServices.find((item) => item.id === serviceId);
}

export function shortenStaffName(value: string) {
  if (value.length <= 14) return value;
  return `${value.slice(0, 14)}...`;
}

export function createTicketState(ownerId: string, serviceId: string, mode: TicketMode): TicketState {
  return {
    ownerId,
    serviceId,
    mode,
    callStatus: mode === 'call' ? 'pending' : 'not_requested',
    status: 'open',
  };
}

export function buildTicketModePayload(serviceId = 'custom') {
  const service = getService(serviceId);
  const embed = buildTerminalEmbed({
    command: 'ticket.mode.select()',
    title: service ? `Atendimento // ${service.label}` : 'Atendimento personalizado',
    description: 'Escolha como quer ser atendido. Se call nao estiver disponivel, o ticket segue por texto automaticamente.',
  });

  return { embeds: [embed], components: [buildTicketModeButtons(serviceId)] };
}

export function buildTicketOverwriteTargets(ownerId: string, botId: string, everyoneId: string) {
  return {
    everyoneId,
    ownerId,
    botId,
    supportRoleId: ROLE_CONFIG.supportRoleId,
  };
}

function hasSupportRole(interaction: ButtonInteraction) {
  const roles = interaction.member?.roles;
  if (!roles || Array.isArray(roles)) return false;
  return roles.cache.has(ROLE_CONFIG.supportRoleId);
}

function ticketOverwrites(interaction: ButtonInteraction, ownerId = interaction.user.id): OverwriteResolvable[] {
  const guild = interaction.guild;
  if (!guild || !interaction.client.user) return [];
  const targets = buildTicketOverwriteTargets(ownerId, interaction.client.user.id, guild.roles.everyone.id);

  return [
    { id: targets.everyoneId, deny: [PermissionsBitField.Flags.ViewChannel] },
    {
      id: targets.ownerId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.Connect,
        PermissionsBitField.Flags.Speak,
      ],
    },
    {
      id: targets.botId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ManageChannels,
        PermissionsBitField.Flags.Connect,
        PermissionsBitField.Flags.Speak,
      ],
    },
    {
      id: targets.supportRoleId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.Connect,
        PermissionsBitField.Flags.Speak,
      ],
    },
  ];
}

async function createTicket(interaction: ButtonInteraction, serviceId: string, mode: TicketMode) {
  const guild = interaction.guild;
  if (!guild) throw new Error('Ticket can only be created inside a guild.');

  const service = getService(serviceId);
  const channel = await guild.channels.create({
    name: normalizeChannelName(`ticket-${interaction.user.username}-${service?.id ?? 'orcamento'}`),
    type: ChannelType.GuildText,
    permissionOverwrites: ticketOverwrites(interaction),
  });

  const embed = buildTerminalEmbed({
    command: 'ticket.session.start()',
    title: service ? `Orcamento // ${service.label}` : 'Orcamento personalizado',
    description: `Ola <@${interaction.user.id}>. Descreva sua ideia, referencias, prazo e onde esse projeto sera usado.\n\nModo escolhido: ${mode === 'call' ? 'call solicitada' : 'texto'}.`,
  });

  await channel.send({
    embeds: [embed],
    components: [buildTicketClaimRow()],
  });

  if (mode === 'call') {
    await channel.send({
      content: `<@&${ROLE_CONFIG.supportRoleId}> o cliente pediu atendimento em call.`,
      embeds: [
        buildTerminalEmbed({
          command: 'ticket.call.request()',
          title: 'Call solicitada',
          description: 'Support pode aceitar a call ou recusar para seguir por texto automaticamente.',
        }),
      ],
      components: [buildTicketCallDecisionRow()],
    });
  }

  const state = loadRuntimeState();
  state.tickets[channel.id] = createTicketState(interaction.user.id, serviceId, mode);
  saveRuntimeState(state);

  return channel;
}

export async function handleTicketStart(interaction: ButtonInteraction) {
  const serviceId = interaction.customId.split(':')[2] ?? 'custom';
  await interaction.reply({ ...buildTicketModePayload(serviceId), ephemeral: true });
}

export async function handleTicketModeSelect(interaction: ButtonInteraction) {
  const [, , modeValue, serviceId = 'custom'] = interaction.customId.split(':');
  const mode = modeValue === 'call' ? 'call' : 'text';

  await interaction.deferUpdate();

  try {
    const channel = await createTicket(interaction, serviceId, mode);
    await interaction.editReply({
      content: `Ticket aberto: ${channel}`,
      embeds: [],
      components: [],
    });
  } catch (error) {
    console.error('Erro ao criar canal de ticket:', error);
    await interaction.editReply({
      content: 'Nao consegui criar o ticket. Verifique as permissoes do bot.',
      embeds: [],
      components: [],
    });
  }
}

export async function handleTicketCallDecision(interaction: ButtonInteraction) {
  if (!hasSupportRole(interaction)) {
    await interaction.reply({ content: 'Apenas Support pode decidir atendimento por call.', ephemeral: true });
    return;
  }

  const textChannel = interaction.channel as TextChannel | null;
  const guild = interaction.guild;
  if (!textChannel || !guild) return;

  const state = loadRuntimeState();
  const ticket = state.tickets[textChannel.id];
  if (!ticket) {
    await interaction.reply({ content: 'Nao encontrei o estado desse ticket.', ephemeral: true });
    return;
  }

  if (interaction.customId.endsWith(':accept')) {
    const voiceChannel = await guild.channels.create({
      name: normalizeChannelName(`call-${textChannel.name}`),
      type: ChannelType.GuildVoice,
      permissionOverwrites: ticketOverwrites(interaction, ticket.ownerId),
    });

    ticket.callStatus = 'accepted';
    ticket.voiceChannelId = voiceChannel.id;
    saveRuntimeState(state);

    await interaction.update({
      embeds: [
        buildTerminalEmbed({
          command: 'ticket.call.accept()',
          title: 'Call aceita',
          description: `Canal de voz criado: ${voiceChannel}`,
        }),
      ],
      components: [],
    });
    await textChannel.send(`<@${ticket.ownerId}> sua call foi aceita: ${voiceChannel}`);
    return;
  }

  ticket.callStatus = 'declined';
  ticket.mode = 'text';
  saveRuntimeState(state);

  await interaction.update({
    embeds: [
      buildTerminalEmbed({
        command: 'ticket.call.decline()',
        title: 'Call indisponivel',
        description: 'Atendimento por call esta em manutencao no momento. O ticket seguira por texto.',
      }),
    ],
    components: [],
  });
  await textChannel.send(`<@${ticket.ownerId}> a opcao de call esta em manutencao agora. Vamos seguir por texto aqui no ticket.`);
}

export async function handleTicketClaim(interaction: ButtonInteraction) {
  if (!hasSupportRole(interaction)) {
    await interaction.reply({ content: 'Apenas Support pode assumir tickets.', ephemeral: true });
    return;
  }

  const textChannel = interaction.channel as TextChannel | null;
  if (!textChannel) return;

  const state = loadRuntimeState();
  const ticket = state.tickets[textChannel.id];
  if (!ticket) {
    await interaction.reply({ content: 'Nao encontrei o estado desse ticket.', ephemeral: true });
    return;
  }

  const displayName = 'displayName' in interaction.member! ? interaction.member.displayName : interaction.user.username;
  const shortName = shortenStaffName(displayName);
  ticket.assigneeId = interaction.user.id;
  ticket.assigneeName = displayName;
  saveRuntimeState(state);

  await interaction.update({ components: [buildTicketClaimRow(shortName)] });

  setTimeout(() => {
    textChannel
      .send({
        embeds: [
          buildTerminalEmbed({
            command: 'ticket.staff.finish()',
            title: 'Atendimento assumido',
            description: `Responsavel: <@${interaction.user.id}>. Quando terminar, finalize para pedir a avaliacao do cliente.`,
          }),
        ],
        components: [buildTicketFinishRow()],
      })
      .catch(() => undefined);
  }, 3000);
}

export async function handleTicketFinish(interaction: ButtonInteraction) {
  if (!hasSupportRole(interaction)) {
    await interaction.reply({ content: 'Apenas Support pode finalizar tickets.', ephemeral: true });
    return;
  }

  const textChannel = interaction.channel as TextChannel | null;
  if (!textChannel) return;

  const state = loadRuntimeState();
  const ticket = state.tickets[textChannel.id];
  if (!ticket) {
    await interaction.reply({ content: 'Nao encontrei o estado desse ticket.', ephemeral: true });
    return;
  }

  ticket.status = 'awaiting_review';
  saveRuntimeState(state);

  await interaction.reply({ content: 'Avaliacao enviada para o cliente. O ticket fecha depois do feedback.', ephemeral: true });
  await textChannel.send({
    content: `<@${ticket.ownerId}> antes de fechar, avalie como foi o atendimento.`,
    ...buildReviewRatingPayload(0, 'ticket'),
  });
}

export async function handleTicketClose(interaction: ButtonInteraction) {
  const channel = interaction.channel as TextChannel | null;
  await interaction.reply('Ticket fechado. O canal sera removido em alguns segundos.');

  if (channel) {
    const state = loadRuntimeState();
    const ticket = state.tickets[channel.id];
    if (ticket) ticket.status = 'closed';
    saveRuntimeState(state);
    setTimeout(() => channel.delete().catch(() => undefined), TIMING.ticketCloseMs);
  }
}
