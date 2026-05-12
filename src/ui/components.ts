import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from 'discord.js';
import { portfolioCategories, type PortfolioCategoryId } from '../data/portfolio';
import { pricingServices } from '../data/pricing';

export function buildRegistrationOpenButton() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('register:open')
      .setLabel('Registrar-se')
      .setStyle(ButtonStyle.Danger),
  );
}

export function buildPortfolioOpenButton() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('portfolio:open')
      .setLabel('Abrir arquivo')
      .setStyle(ButtonStyle.Danger),
  );
}

export function buildPortfolioCategorySelect(selected: PortfolioCategoryId = 'all') {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('portfolio:category')
      .setPlaceholder('Escolha a pasta do portfolio')
      .addOptions(
        portfolioCategories.map((category) => ({
          label: category.label,
          description: category.description,
          value: category.id,
          default: category.id === selected,
        })),
      ),
  );
}

export function buildPortfolioPager(category: string, index: number) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`portfolio:page:${category}:${Math.max(0, index - 1)}`)
      .setLabel('Anterior')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`portfolio:page:${category}:${index + 1}`)
      .setLabel('Proximo')
      .setStyle(ButtonStyle.Danger),
  );
}

export function buildPricingOpenButton() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('pricing:open')
      .setLabel('Abrir tabela')
      .setStyle(ButtonStyle.Danger),
  );
}

export function buildPricingSelect(selected = pricingServices[0]?.id ?? 'banner') {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('pricing:service')
      .setPlaceholder('Escolha o servico')
      .addOptions(
        pricingServices.map((service) => ({
          label: service.label,
          description: service.short.slice(0, 100),
          value: service.id,
          default: service.id === selected,
        })),
      ),
  );
}

export function buildTicketButton(serviceId = 'custom') {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:start:${serviceId}`)
      .setLabel('Solicitar orcamento')
      .setStyle(ButtonStyle.Danger),
  );
}

export function buildTicketModeButtons(serviceId = 'custom') {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:mode:text:${serviceId}`)
      .setLabel('Atendimento por texto')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`ticket:mode:call:${serviceId}`)
      .setLabel('Atendimento em call')
      .setStyle(ButtonStyle.Secondary),
  );
}

export function buildTicketCallDecisionRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:call:accept')
      .setLabel('Aceitar call')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('ticket:call:decline')
      .setLabel('Recusar call')
      .setStyle(ButtonStyle.Secondary),
  );
}

function shortenTicketButtonLabel(value: string) {
  if (value.length <= 14) return value;
  return `${value.slice(0, 14)}...`;
}

export function buildTicketClaimRow(assigneeLabel?: string) {
  const safeAssigneeLabel = assigneeLabel ? shortenTicketButtonLabel(assigneeLabel) : undefined;

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:claim')
      .setLabel(safeAssigneeLabel ? `Assumido: ${safeAssigneeLabel}` : 'Assumir ticket')
      .setStyle(safeAssigneeLabel ? ButtonStyle.Secondary : ButtonStyle.Danger)
      .setDisabled(Boolean(safeAssigneeLabel)),
  );
}

export function buildTicketFinishRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:finish')
      .setLabel('Finalizado')
      .setStyle(ButtonStyle.Danger),
  );
}

export function buildAnnouncementPreferenceRows() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('register:announcements:yes')
      .setLabel('Receber avisos')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('register:announcements:no')
      .setLabel('Nao receber')
      .setStyle(ButtonStyle.Secondary),
  );
}

export function buildReviewOpenButton() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('review:open')
      .setLabel('Avaliar')
      .setStyle(ButtonStyle.Danger),
  );
}

export function buildStarButtons(selectedRating = 0, context = 'public') {
  const contextSuffix = context === 'public' ? '' : `:${context}`;

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    [1, 2, 3, 4, 5].map((rating) =>
      new ButtonBuilder()
        .setCustomId(`review:rate:${rating}${contextSuffix}`)
        .setLabel(rating <= selectedRating ? '★' : '☆')
        .setStyle(rating <= selectedRating ? ButtonStyle.Danger : ButtonStyle.Secondary),
    ),
  );
}
