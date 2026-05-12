import { ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';
import { pricingServices } from '../data/pricing';
import { buildPricingSelect, buildTicketButton } from '../ui/components';
import { buildTerminalEmbed } from '../ui/embeds';

export function buildPricingBrowserPayload(serviceId = pricingServices[0]?.id ?? 'banner') {
  const service = pricingServices.find((item) => item.id === serviceId) ?? pricingServices[0];
  if (!service) throw new Error('Missing pricing services.');

  const embed = buildTerminalEmbed({
    command: `inspect price --service=${service.id}`,
    title: `${service.label} // ${service.basePrice}`,
    description: `${service.short}\n\n**Melhor para:** ${service.bestFor}`,
  });

  embed.addFields(
    { name: 'Entrega', value: service.delivery, inline: true },
    { name: 'Revisoes', value: service.revisions, inline: true },
    { name: 'Inclui', value: service.includes.map((item) => `- ${item}`).join('\n') },
  );

  return { embeds: [embed], components: [buildPricingSelect(service.id), buildTicketButton(service.id)] };
}

export async function handlePricingOpen(interaction: ButtonInteraction) {
  await interaction.reply({ ...buildPricingBrowserPayload(), ephemeral: true });
}

export async function handlePricingSelect(interaction: StringSelectMenuInteraction) {
  await interaction.update(buildPricingBrowserPayload(interaction.values[0]));
}
