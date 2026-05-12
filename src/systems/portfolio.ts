import { ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';
import { portfolioCategories, portfolioItems, sitePortfolioItems, type PortfolioCategoryId } from '../data/portfolio';
import { buildPortfolioCategorySelect, buildPortfolioPager } from '../ui/components';
import { buildTerminalEmbed } from '../ui/embeds';

function getCategoryLabel(category: PortfolioCategoryId) {
  return portfolioCategories.find((item) => item.id === category)?.label ?? category;
}

function buildProductionPayload(category: PortfolioCategoryId) {
  const label = getCategoryLabel(category);
  const embed = buildTerminalEmbed({
    command: `query portfolio --category=${category}`,
    title: `${label} // em producao`,
    description: 'Essa pasta ainda esta em producao. Assim que tiver um trabalho publico e confirmado, ele aparece aqui.',
  });

  return { embeds: [embed], components: [buildPortfolioCategorySelect(category)] };
}

export function buildPortfolioBrowserPayload(category: PortfolioCategoryId = 'all', index = 0): any {
  if (category === 'sites') {
    if (sitePortfolioItems.length === 0) return buildProductionPayload(category);

    const embed = buildTerminalEmbed({
      command: 'query portfolio --category=sites',
      title: 'Sites publicados',
      description: 'Somente sites com link publico e disponivel.',
    });

    embed.addFields(
      sitePortfolioItems.map((site) => ({
        name: site.title,
        value: `${site.note}\n${site.url}`,
      })),
    );

    return { embeds: [embed], components: [buildPortfolioCategorySelect(category)] };
  }

  const items = category === 'all' ? portfolioItems : portfolioItems.filter((item) => item.category === category);
  if (items.length === 0) return buildProductionPayload(category);

  const safeIndex = items.length === 0 ? 0 : ((index % items.length) + items.length) % items.length;
  const item = items[safeIndex];
  const embed = buildTerminalEmbed({
    command: `query portfolio --category=${category}`,
    title: item?.title ?? 'Arquivo vazio',
    description: item ? `${item.note}\nItem ${safeIndex + 1}/${items.length}` : 'Nenhum item encontrado nessa categoria.',
  });

  if (item) embed.setImage(`attachment://${item.assetPath.split('/').pop()}`);

  return {
    embeds: [embed],
    components: [buildPortfolioCategorySelect(category), buildPortfolioPager(category, safeIndex)],
    files: item ? [item.assetPath] : undefined,
  };
}

export async function handlePortfolioOpen(interaction: ButtonInteraction) {
  await interaction.reply({ ...buildPortfolioBrowserPayload('all', 0), ephemeral: true });
}

export async function handlePortfolioCategory(interaction: StringSelectMenuInteraction) {
  const category = interaction.values[0] as PortfolioCategoryId;

  await interaction.update(buildPortfolioBrowserPayload(category, 0));
}

export async function handlePortfolioPage(interaction: ButtonInteraction) {
  const [, , category, index] = interaction.customId.split(':');

  await interaction.update(buildPortfolioBrowserPayload(category as PortfolioCategoryId, Number(index)));
}
