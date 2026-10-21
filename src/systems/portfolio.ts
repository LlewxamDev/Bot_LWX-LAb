import fs from 'node:fs';
import path from 'node:path';
import {
  AttachmentBuilder,
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type EmbedBuilder,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { BOT_CONFIG } from '../config/botConfig.js';
import {
  portfolioCategories,
  portfolioItems,
  sitePortfolioItems,
  type PortfolioCategoryId,
  type PortfolioItem,
} from '../data/portfolio.js';
import { pricingServices } from '../data/pricing.js';
import { createPortfolioBrowserRows } from '../ui/components.js';
import { collectBrandFiles, createStudioEmbed } from '../ui/embeds.js';
import { em } from '../ui/emojis.js';
import { openBudgetModalForService } from './tickets.js';

export type PortfolioViewState = {
  category: PortfolioCategoryId;
  pageIndex: number;
  totalItems: number;
  currentItem: PortfolioItem | null;
  embed: EmbedBuilder;
  files: AttachmentBuilder[];
  components: ReturnType<typeof createPortfolioBrowserRows>;
};

export function resolvePortfolioAssetPath(relativeAssetPath: string): string {
  return path.resolve(process.cwd(), relativeAssetPath);
}

export function getItemsByCategory(category: PortfolioCategoryId): PortfolioItem[] {
  if (category === 'all') {
    return portfolioItems;
  }

  if (category === 'sites') {
    return [];
  }

  return portfolioItems.filter((item) => item.category === category);
}

export function normalizePageIndex(index: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  const mod = index % total;
  return mod < 0 ? mod + total : mod;
}

export function isPortfolioCategoryId(value: string): value is PortfolioCategoryId {
  return portfolioCategories.some((category) => category.id === value);
}

function getCategoryMeta(category: PortfolioCategoryId): { label: string; description: string } {
  const found = portfolioCategories.find((entry) => entry.id === category);
  return {
    label: found?.label ?? 'Portfólio',
    description: found?.description ?? 'Acervo oficial do LWX Lab.',
  };
}

export function buildPortfolioViewState(
  category: PortfolioCategoryId,
  requestedIndex = 0,
): PortfolioViewState {
  const categoryMeta = getCategoryMeta(category);
  const baseFiles = collectBrandFiles(['emblem']);

  if (category === 'sites') {
    const sitesDescription =
      sitePortfolioItems.length > 0
        ? sitePortfolioItems
            .map((site, idx) => `${em('spark')} **${idx + 1}. [${site.title}](${site.url})**\n> ${site.note}`)
            .join('\n\n')
        : [
            `> ${em('knight')} **Experiências Web & Sistemas Interativos**`,
            `> Nossos projetos web com animações 3D e design interativo podem ser solicitados sob medida diretamente em <#${BOT_CONFIG.channels.budget}>.`,
          ].join('\n');

    const embed = createStudioEmbed('secondary')
      .setTitle(`Portfólio • ${categoryMeta.label}`)
      .setDescription(sitesDescription);

    return {
      category,
      pageIndex: 0,
      totalItems: sitePortfolioItems.length,
      currentItem: null,
      embed,
      files: baseFiles,
      components: createPortfolioBrowserRows(category, 0, Math.max(1, sitePortfolioItems.length), []),
    };
  }

  const items = getItemsByCategory(category);

  if (items.length === 0) {
    const emptyEmbed = createStudioEmbed('warning')
      .setTitle(`Portfólio • ${categoryMeta.label}`)
      .setDescription(
        `> ${em('spark')} Novas obras de **${categoryMeta.label}** estão sendo catalogadas. Selecione **Acervo Completo** no menu abaixo para explorar todas as artes disponíveis.`,
      );

    return {
      category,
      pageIndex: 0,
      totalItems: 0,
      currentItem: null,
      embed: emptyEmbed,
      files: baseFiles,
      components: createPortfolioBrowserRows(category, 0, 0, []),
    };
  }

  const pageIndex = normalizePageIndex(requestedIndex, items.length);
  const currentItem = items[pageIndex];

  if (!currentItem) {
    throw new Error('Falha ao resolver item do portfólio.');
  }

  const matchedService = pricingServices.find((s) => s.id === currentItem.serviceId);
  const absolutePath = resolvePortfolioAssetPath(currentItem.assetPath);
  const fileExists = fs.existsSync(absolutePath);
  const attachmentName = path.basename(currentItem.assetPath);

  const embed = createStudioEmbed('primary')
    .setTitle(`${currentItem.title}`)
    .setDescription(
      [
        `> ${em('palette')} *${currentItem.note}*`,
        '',
        `-# Gostou da direção visual desta obra? Clique em **Encomendar Neste Estilo** abaixo para abrir um orçamento personalizado.`,
      ].join('\n'),
    )
    .addFields(
      {
        name: `${em('crown')} Categoria`,
        value: `**${categoryMeta.label}**`,
        inline: true,
      },
      {
        name: `${em('flame')} Técnica & Estilo`,
        value: `${currentItem.technique}`,
        inline: true,
      },
      {
        name: `${em('spark')} Investimento Base`,
        value: matchedService ? `**${matchedService.priceLabel}** (${matchedService.deliveryEstimate})` : 'Sob consulta',
        inline: true,
      },
    );

  const files: AttachmentBuilder[] = [...baseFiles];
  if (fileExists) {
    files.push(new AttachmentBuilder(absolutePath, { name: attachmentName }));
    embed.setImage(`attachment://${attachmentName}`);
  }

  return {
    category,
    pageIndex,
    totalItems: items.length,
    currentItem,
    embed,
    files,
    components: createPortfolioBrowserRows(category, pageIndex, items.length, items, currentItem),
  };
}

export async function handlePortfolioOpenButton(
  interaction: ButtonInteraction,
  initialCategory: PortfolioCategoryId = 'all',
): Promise<void> {
  const state = buildPortfolioViewState(initialCategory, 0);

  await interaction.reply({
    embeds: [state.embed],
    files: state.files,
    components: state.components,
    flags: MessageFlags.Ephemeral,
  });
}

export async function handlePortfolioOrderThisButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const serviceId = parts[3] ?? 'custom';
  await openBudgetModalForService(interaction, serviceId);
}

export async function handlePortfolioCategorySelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const rawCategory = interaction.values[0] ?? 'all';
  const category: PortfolioCategoryId = isPortfolioCategoryId(rawCategory) ? rawCategory : 'all';
  const state = buildPortfolioViewState(category, 0);

  await interaction.update({
    embeds: [state.embed],
    files: state.files,
    components: state.components,
  });
}

export async function handlePortfolioJumpSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const rawValue = interaction.values[0] ?? '0:all';
  const [rawIdx, rawCat] = rawValue.split(':');
  const requestedIndex = Number.parseInt(rawIdx ?? '0', 10);
  const category: PortfolioCategoryId = rawCat && isPortfolioCategoryId(rawCat) ? rawCat : 'all';

  const state = buildPortfolioViewState(
    category,
    Number.isNaN(requestedIndex) ? 0 : requestedIndex,
  );

  // If the jump select was clicked directly on the public fixed panel, reply ephemerally so we don't overwrite the fixed panel!
  const isPublicPanel = interaction.message.embeds.some((emb) =>
    emb.footer?.text?.includes(BOT_CONFIG.panelMarkers.portfolio),
  );

  if (isPublicPanel) {
    await interaction.reply({
      embeds: [state.embed],
      files: state.files,
      components: state.components,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.update({
    embeds: [state.embed],
    files: state.files,
    components: state.components,
  });
}

export async function handlePortfolioNavigationButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const direction = parts[2];
  const rawCategory = parts[3] ?? 'all';
  const rawIndex = Number.parseInt(parts[4] ?? '0', 10);

  const category: PortfolioCategoryId = isPortfolioCategoryId(rawCategory) ? rawCategory : 'all';
  const delta = direction === 'prev' ? -1 : 1;
  const nextIndex = (Number.isNaN(rawIndex) ? 0 : rawIndex) + delta;

  const state = buildPortfolioViewState(category, nextIndex);

  await interaction.update({
    embeds: [state.embed],
    files: state.files,
    components: state.components,
  });
}

export async function handlePortfolioSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const rawCat = interaction.options.getString('categoria') ?? 'all';
  const rawPiece = interaction.options.getInteger('obra');
  const category: PortfolioCategoryId = isPortfolioCategoryId(rawCat) ? rawCat : 'all';
  const index = rawPiece ? Math.max(0, rawPiece - 1) : 0;

  const state = buildPortfolioViewState(category, index);
  await interaction.reply({
    embeds: [state.embed],
    files: state.files,
    components: state.components,
    flags: MessageFlags.Ephemeral,
  });
}
