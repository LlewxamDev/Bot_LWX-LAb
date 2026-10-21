import fs from 'node:fs';
import path from 'node:path';
import {
  MessageFlags,
  PermissionFlagsBits,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type EmbedBuilder,
  type GuildMember,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { BOT_CONFIG } from '../config/botConfig.js';
import { buildProgressBar, collectBrandFiles, createStudioEmbed, getBrandAttachmentUrl } from '../ui/embeds.js';
import { em } from '../ui/emojis.js';

export type OrderStageKey = 'briefing' | 'sketch' | 'render' | 'review' | 'delivered';

export interface StudioOrder {
  id: string;
  clientId: string;
  clientTag: string;
  service: string;
  deadline: string;
  stage: OrderStageKey;
  note: string;
  createdAt: string;
  updatedAt: string;
}

const ORDERS_PATH = path.resolve(process.cwd(), 'data', 'orders.json');

export const ORDER_STAGES: Record<
  OrderStageKey,
  { step: number; label: string; description: string }
> = {
  briefing: {
    step: 1,
    label: '1/5 • Briefing & Referências',
    description: 'Alinhamento inicial de conceito, cores e direção de arte.',
  },
  sketch: {
    step: 2,
    label: '2/5 • Esboço & Estrutura',
    description: 'Construção do layout base, composição e silhuetas.',
  },
  render: {
    step: 3,
    label: '3/5 • Render & Iluminação',
    description: 'Aplicação de texturas, efeitos de luz, tipografia e acabamento fino.',
  },
  review: {
    step: 4,
    label: '4/5 • Revisão com Cliente',
    description: 'Prévias enviadas para aprovação e ajustes de detalhes.',
  },
  delivered: {
    step: 5,
    label: '5/5 • Projeto Finalizado',
    description: 'Arquivos master entregues em alta resolução.',
  },
};

export function loadOrders(): StudioOrder[] {
  try {
    if (fs.existsSync(ORDERS_PATH)) {
      return JSON.parse(fs.readFileSync(ORDERS_PATH, 'utf8')) as StudioOrder[];
    }
  } catch {
    // Return empty array on parse error
  }
  return [];
}

function saveOrders(orders: StudioOrder[]): void {
  fs.mkdirSync(path.dirname(ORDERS_PATH), { recursive: true });
  fs.writeFileSync(ORDERS_PATH, JSON.stringify(orders, null, 2), 'utf8');
}

export function getOrdersForUser(userId: string): StudioOrder[] {
  return loadOrders().filter((o) => o.clientId === userId);
}

export function registerOrderFromTicket(
  clientId: string,
  clientTag: string,
  service: string,
  deadline: string,
  briefingNote?: string,
): StudioOrder {
  const orders = loadOrders();
  const nextNum = 101 + orders.length;
  const newOrder: StudioOrder = {
    id: `LWX-${nextNum}`,
    clientId,
    clientTag,
    service,
    deadline,
    stage: 'briefing',
    note: briefingNote
      ? `Briefing recebido: ${briefingNote.slice(0, 160)}`
      : 'Briefing recebido e sala privada criada no estúdio.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  orders.push(newOrder);
  saveOrders(orders);
  return newOrder;
}

function isStaffMember(member: GuildMember | null): boolean {
  if (!member) return false;
  return (
    member.roles.cache.has(BOT_CONFIG.roles.staff) ||
    member.permissions.has(PermissionFlagsBits.ManageChannels) ||
    member.permissions.has(PermissionFlagsBits.Administrator)
  );
}

export function buildOrderCardEmbed(order: StudioOrder): EmbedBuilder {
  const stageMeta = ORDER_STAGES[order.stage] ?? ORDER_STAGES.briefing;
  const bar = buildProgressBar(stageMeta.step, 5, 10);

  const timelineLines = (Object.keys(ORDER_STAGES) as OrderStageKey[]).map((key) => {
    const item = ORDER_STAGES[key];
    if (item.step < stageMeta.step) {
      return `${em('verify')} ~~${item.label}~~`;
    }
    if (item.step === stageMeta.step) {
      return `${em('flame')} **${item.label}** *(Etapa Atual)*`;
    }
    return `▫️ *${item.label}*`;
  });

  return createStudioEmbed(order.stage === 'delivered' ? 'secondary' : 'primary')
    .setThumbnail(getBrandAttachmentUrl('animatedEmblem'))
    .setImage(getBrandAttachmentUrl('divider'))
    .setTitle(`Rastreador de Encomenda • #${order.id}`)
    .setDescription(
      [
        `> ${em('knight')} **Status em Tempo Real:** ${bar}`,
        `> *${stageMeta.description}*`,
        '',
        `### ${em('spark')} Linha do Tempo de Produção`,
        timelineLines.join('\n'),
      ].join('\n'),
    )
    .addFields(
      {
        name: `${em('crown')} Cliente`,
        value: `<@${order.clientId}>`,
        inline: true,
      },
      {
        name: `${em('palette')} Serviço`,
        value: `**${order.service}**`,
        inline: true,
      },
      {
        name: `${em('flame')} Prazo Estimado`,
        value: `**${order.deadline}**`,
        inline: true,
      },
      {
        name: `${em('ticket')} Nota da Direção de Arte`,
        value: order.note || 'Produção seguindo conforme cronograma.',
        inline: false,
      },
    );
}

export async function handleOrderTrackButton(interaction: ButtonInteraction): Promise<void> {
  const orders = loadOrders();
  const found = [...orders].reverse().find((o) => o.clientId === interaction.user.id);
  const files = collectBrandFiles(['emblem', 'animatedEmblem', 'divider']);

  if (!found) {
    await interaction.reply({
      embeds: [
        createStudioEmbed('primary')
          .setThumbnail(getBrandAttachmentUrl('animatedEmblem'))
          .setImage(getBrandAttachmentUrl('divider'))
          .setTitle('Rastreador de Pedidos • LWX Lab')
          .setDescription(
            [
              `> ${em('ticket')} Você ainda não possui uma encomenda ativa vinculada ao seu perfil.`,
              `> Clique em **Briefing Sob Medida** ou em um dos botões de serviço rápido aqui em <#${BOT_CONFIG.channels.budget}> para abrir seu pedido e gerar seu código de rastreio!`,
            ].join('\n'),
          ),
      ],
      files,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.reply({
    embeds: [buildOrderCardEmbed(found)],
    files,
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleOrderStageSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const member = interaction.guild
    ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null)
    : null;

  if (!isStaffMember(member)) {
    await interaction.reply({
      embeds: [
        createStudioEmbed('danger')
          .setTitle('Acesso Restrito à Equipe')
          .setDescription(`> ${em('knight')} Apenas a direção de arte do **LWX Lab** pode avançar etapas de produção.`),
      ],
      files: collectBrandFiles(['emblem']),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const [, orderId] = interaction.customId.split(':').slice(-2);
  const selectedStage = interaction.values[0] as OrderStageKey | undefined;
  if (!orderId || !selectedStage) return;

  const orders = loadOrders();
  const target = orders.find((o) => o.id.toUpperCase() === orderId.toUpperCase());

  if (!target) {
    await interaction.reply({
      content: `Encomenda #${orderId} não localizada.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  target.stage = selectedStage;
  target.note = ORDER_STAGES[selectedStage]?.description ?? target.note;
  target.updatedAt = new Date().toISOString();
  saveOrders(orders);

  await interaction.reply({
    content: `${em('flame')} Etapa do pedido **#${target.id}** de <@${target.clientId}> atualizada pela direção de arte!`,
    embeds: [buildOrderCardEmbed(target)],
    files: collectBrandFiles(['emblem', 'animatedEmblem', 'divider']),
  });
}

export async function handleOrderSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();
  const files = collectBrandFiles(['emblem', 'animatedEmblem', 'divider']);

  if (sub === 'criar') {
    const member = interaction.guild
      ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null)
      : null;

    if (!isStaffMember(member)) {
      await interaction.reply({
        embeds: [
          createStudioEmbed('danger')
            .setTitle('Acesso Restrito à Equipe')
            .setDescription(`> ${em('knight')} Apenas a direção ou staff do **LWX Lab** pode registrar novas encomendas.`),
        ],
        files: collectBrandFiles(['emblem']),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const clientUser = interaction.options.getUser('cliente', true);
    const service = interaction.options.getString('servico', true);
    const deadline = interaction.options.getString('prazo') ?? '48h a 72h';
    const note = interaction.options.getString('nota') ?? 'Briefing aprovado e projeto iniciado no estúdio.';

    const orders = loadOrders();
    const nextNum = 101 + orders.length;
    const newOrder: StudioOrder = {
      id: `LWX-${nextNum}`,
      clientId: clientUser.id,
      clientTag: clientUser.tag,
      service,
      deadline,
      stage: 'briefing',
      note,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    orders.push(newOrder);
    saveOrders(orders);

    const embed = buildOrderCardEmbed(newOrder);
    await interaction.reply({
      content: `${em('spark')} Encomenda **#${newOrder.id}** registrada para <@${clientUser.id}>!`,
      embeds: [embed],
      files,
    });
    return;
  }

  if (sub === 'atualizar') {
    const member = interaction.guild
      ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null)
      : null;

    if (!isStaffMember(member)) {
      await interaction.reply({
        embeds: [
          createStudioEmbed('danger')
            .setTitle('Acesso Restrito à Equipe')
            .setDescription(`> ${em('knight')} Apenas a equipe do **LWX Lab** pode atualizar etapas de produção.`),
        ],
        files: collectBrandFiles(['emblem']),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const rawId = interaction.options.getString('codigo', true).replace(/^#/, '').toUpperCase();
    const stage = interaction.options.getString('etapa', true) as OrderStageKey;
    const note = interaction.options.getString('nota');

    const orders = loadOrders();
    const target = orders.find((o) => o.id.toUpperCase() === rawId);

    if (!target) {
      await interaction.reply({
        embeds: [
          createStudioEmbed('warning')
            .setTitle('Encomenda Não Encontrada')
            .setDescription(`> Não encontramos nenhum pedido com o código \`#${rawId}\`.`),
        ],
        files: collectBrandFiles(['emblem']),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    target.stage = stage;
    if (note) {
      target.note = note;
    }
    target.updatedAt = new Date().toISOString();
    saveOrders(orders);

    const embed = buildOrderCardEmbed(target);
    await interaction.reply({
      content: `${em('flame')} Status do pedido **#${target.id}** de <@${target.clientId}> atualizado!`,
      embeds: [embed],
      files,
    });
    return;
  }

  // sub === 'consultar'
  const rawCode = interaction.options.getString('codigo')?.replace(/^#/, '').toUpperCase();
  const orders = loadOrders();

  const found = rawCode
    ? orders.find((o) => o.id.toUpperCase() === rawCode)
    : [...orders].reverse().find((o) => o.clientId === interaction.user.id);

  if (!found) {
    await interaction.reply({
      embeds: [
        createStudioEmbed('primary')
          .setThumbnail(getBrandAttachmentUrl('animatedEmblem'))
          .setTitle('Rastreador de Pedidos • LWX Lab')
          .setDescription(
            [
              `> ${em('ticket')} Você ainda não possui uma encomenda ativa vinculada ao seu perfil (ou o código informado não foi localizado).`,
              `> Para iniciar um novo projeto exclusivo, acesse <#${BOT_CONFIG.channels.budget}>!`,
            ].join('\n'),
          ),
      ],
      files: collectBrandFiles(['emblem', 'animatedEmblem']),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.reply({
    embeds: [buildOrderCardEmbed(found)],
    files,
    flags: MessageFlags.Ephemeral,
  });
}
