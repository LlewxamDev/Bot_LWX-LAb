import { ChannelType, Client, TextChannel } from 'discord.js';
import { CHANNEL_IDS } from '../config/botConfig';
import { loadRuntimeState, saveRuntimeState } from '../storage/runtimeStore';
import { buildBudgetPanel, buildPortfolioPanel, buildPricingPanel, buildRegistrationPanel, buildReviewPanel } from '../ui/panels';

export function getPanelDefinitions() {
  return [
    { key: 'register', channelId: CHANNEL_IDS.register, build: buildRegistrationPanel },
    { key: 'portfolio', channelId: CHANNEL_IDS.portfolio, build: buildPortfolioPanel },
    { key: 'pricing', channelId: CHANNEL_IDS.pricing, build: buildPricingPanel },
    { key: 'reviewPrompt', channelId: CHANNEL_IDS.reviewPrompt, build: buildReviewPanel },
    { key: 'budget', channelId: CHANNEL_IDS.budget, build: buildBudgetPanel },
  ] as const;
}

export async function upsertFixedPanels(client: Client) {
  const state = loadRuntimeState();

  for (const panel of getPanelDefinitions()) {
    const channel = await client.channels.fetch(panel.channelId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildText) {
      console.warn(`Panel channel not found: ${panel.key} (${panel.channelId})`);
      continue;
    }

    const payload = panel.build();
    const textChannel = channel as TextChannel;
    const savedMessageId = state.panels[panel.key];
    const savedMessage = savedMessageId
      ? await textChannel.messages.fetch(savedMessageId).catch(() => null)
      : null;

    const message = savedMessage
      ? await savedMessage.edit(payload)
      : await textChannel.send(payload);

    state.panels[panel.key] = message.id;

    if (!message.pinned) {
      await message.pin().catch((error) => {
        console.warn(`Could not pin panel ${panel.key}:`, error);
      });
    }
  }

  saveRuntimeState(state);
}
