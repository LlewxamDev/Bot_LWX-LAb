import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type EmbedBuilder,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { BOT_CONFIG } from '../config/botConfig.js';
import { pricingPolicies, pricingServices, type PricingService } from '../data/pricing.js';
import { createPricingComboSelectRow, createPricingSelectRow } from '../ui/components.js';
import { collectBrandFiles, createStudioEmbed, getBrandAttachmentUrl } from '../ui/embeds.js';
import { btnEmoji, em } from '../ui/emojis.js';

export function getServiceById(serviceId: string): PricingService {
  const found = pricingServices.find((service) => service.id === serviceId);
  if (found) {
    return found;
  }

  const fallback = pricingServices[0];
  if (!fallback) {
    throw new Error('Nenhum serviço cadastrado na tabela de preços.');
  }

  return fallback;
}

function parseReaisPrice(priceLabel: string): number {
  const digits = priceLabel.replace(/[^\d]/g, '');
  const val = Number.parseInt(digits, 10);
  return Number.isNaN(val) ? 50 : val;
}

export function buildPricingDetailEmbed(service: PricingService): EmbedBuilder {
  const deliverablesList = service.includes
    .map((item) => `${em('verify')} ${item}`)
    .join('\n');

  return createStudioEmbed('secondary')
    .setThumbnail(getBrandAttachmentUrl('animatedEmblem'))
    .setImage(getBrandAttachmentUrl('divider'))
    .setTitle(`${service.name} — Especificação & Escopo`)
    .setDescription(
      [
        `> ${em('spark')} *${service.summary}*`,
        '',
        `### ${em('crown')} O que está incluso nesta entrega`,
        deliverablesList,
      ].join('\n'),
    )
    .addFields(
      {
        name: `${em('flame')} Investimento Base`,
        value: `**${service.priceLabel}**`,
        inline: true,
      },
      {
        name: `${em('knight')} Prazo Estimado`,
        value: `**${service.deliveryEstimate}**`,
        inline: true,
      },
      {
        name: `${em('palette')} Revisões Inclusas`,
        value: `**${service.revisionsIncluded}**`,
        inline: true,
      },
    );
}

export function buildPricingComboEmbed(selectedIds: string[]): EmbedBuilder {
  const selected = pricingServices.filter((s) => selectedIds.includes(s.id));
  const list = selected.length > 0 ? selected : [pricingServices[0]!];

  const rawTotal = list.reduce((acc, s) => acc + parseReaisPrice(s.priceLabel), 0);
  const hasComboDiscount = list.length >= 2;
  const finalTotal = hasComboDiscount ? Math.round(rawTotal * 0.9) : rawTotal;

  const breakdown = list
    .map((s) => `${em('verify')} **${s.name}** — \`${s.priceLabel}\` *(Prazo: ${s.deliveryEstimate})*`)
    .join('\n');

  return createStudioEmbed('primary')
    .setThumbnail(getBrandAttachmentUrl('animatedEmblem'))
    .setImage(getBrandAttachmentUrl('divider'))
    .setTitle('Simulador Inteligente de Pacote • LWX Lab')
    .setDescription(
      [
        `> ${em('spark')} **Selecione 1 ou mais serviços no menu abaixo para simular seu investimento total.**`,
        hasComboDiscount
          ? `> ${em('crown')} **Bônus de Pacote Ativo:** Combinando **${list.length} serviços**, você recebe **10% OFF** no valor base total!`
          : `> - *Dica: Selecionando 2 ou mais serviços juntos no menu abaixo, o simulador aplica **10% de desconto de combo** automaticamente.*`,
        '',
        `### ${em('flame')} Itens Selecionados (${list.length})`,
        breakdown,
      ].join('\n'),
    )
    .addFields(
      {
        name: `${em('palette')} Soma Individual`,
        value: `\`R$ ${rawTotal},00\``,
        inline: true,
      },
      {
        name: `${em('crown')} Valor Final Estimado`,
        value: hasComboDiscount ? `**R$ ${finalTotal},00** *(-10% Combo)*` : `**R$ ${finalTotal},00**`,
        inline: true,
      },
      {
        name: `${em('verify')} Garantia LWX`,
        value: pricingPolicies[0] ?? 'Alinhamento completo via ticket.',
        inline: true,
      },
    );
}

function createPricingOrderRow(service: PricingService): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${BOT_CONFIG.customIds.portfolioOrderThis}:${service.id}`)
      .setLabel(`Encomendar ${service.name}`)
      .setEmoji(btnEmoji('ticket'))
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.pricingComboOpen)
      .setLabel('Simular Combo com Outros Itens')
      .setEmoji(btnEmoji('spark'))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.portfolioOpen)
      .setLabel('Ver Exemplos no Portfólio')
      .setEmoji(btnEmoji('palette'))
      .setStyle(ButtonStyle.Secondary),
  );
}

export async function handlePricingOpenButton(interaction: ButtonInteraction): Promise<void> {
  const defaultService = getServiceById('banner');
  const embed = buildPricingDetailEmbed(defaultService);
  const files = collectBrandFiles(['emblem', 'animatedEmblem', 'divider']);

  await interaction.reply({
    embeds: [embed],
    files,
    components: [createPricingSelectRow(defaultService.id), createPricingOrderRow(defaultService)],
    flags: MessageFlags.Ephemeral,
  });
}

export async function handlePricingSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const selectedId = interaction.values[0] ?? 'banner';
  const service = getServiceById(selectedId);
  const embed = buildPricingDetailEmbed(service);
  const files = collectBrandFiles(['emblem', 'animatedEmblem', 'divider']);

  const isPublicPanel = interaction.message.embeds.some((emb) =>
    emb.footer?.text?.includes(BOT_CONFIG.panelMarkers.pricing),
  );

  if (isPublicPanel) {
    await interaction.reply({
      embeds: [embed],
      files,
      components: [createPricingSelectRow(service.id), createPricingOrderRow(service)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.update({
    embeds: [embed],
    files,
    components: [createPricingSelectRow(service.id), createPricingOrderRow(service)],
  });
}

export async function handlePricingComboOpen(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
): Promise<void> {
  const embed = buildPricingComboEmbed(['banner', 'logo']);
  const files = collectBrandFiles(['emblem', 'animatedEmblem', 'divider']);
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.budgetOpenModal)
      .setLabel('Abrir Briefing com Este Pacote')
      .setEmoji(btnEmoji('ticket'))
      .setStyle(ButtonStyle.Success),
  );

  await interaction.reply({
    embeds: [embed],
    files,
    components: [createPricingComboSelectRow(), actionRow],
    flags: MessageFlags.Ephemeral,
  });
}

export async function handlePricingComboSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const selectedIds = interaction.values.length > 0 ? interaction.values : ['banner'];
  const embed = buildPricingComboEmbed(selectedIds);
  const files = collectBrandFiles(['emblem', 'animatedEmblem', 'divider']);
  const firstId = selectedIds[0] ?? 'banner';

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${BOT_CONFIG.customIds.portfolioOrderThis}:${firstId}`)
      .setLabel('Abrir Briefing com Este Pacote')
      .setEmoji(btnEmoji('ticket'))
      .setStyle(ButtonStyle.Success),
  );

  await interaction.update({
    embeds: [embed],
    files,
    components: [createPricingComboSelectRow(), actionRow],
  });
}
