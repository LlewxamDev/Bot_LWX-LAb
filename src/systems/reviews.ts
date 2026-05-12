import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { CHANNEL_IDS, TIMING } from '../config/botConfig';
import { loadRuntimeState, saveRuntimeState } from '../storage/runtimeStore';
import { buildStarButtons } from '../ui/components';
import { buildTerminalEmbed, renderStars } from '../ui/embeds';

export function buildReviewRatingPayload(rating = 0, context = 'public') {
  const contextSuffix = context === 'public' ? '' : `:${context}`;
  const embed = buildTerminalEmbed({
    command: 'lwx.review.rate()',
    title: 'Escolha sua nota',
    description: `Clique em uma estrela.\n\n${renderStars(rating)}`,
  });

  const feedbackRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`review:feedback:${rating}${contextSuffix}`)
      .setLabel('Escrever feedback')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(rating < 1),
  );

  return { embeds: [embed], components: [buildStarButtons(rating, context), feedbackRow] };
}

export function buildPublicReviewPayload(userId: string, rating: number, feedback: string) {
  return {
    embeds: [
      buildTerminalEmbed({
        command: 'review.publish()',
        title: `Nova avaliacao // ${renderStars(rating)}`,
        description: `${renderStars(rating)}\n\n*${feedback}*\n\nEnviado por <@${userId}>`,
      }),
    ],
  };
}

export async function handleReviewOpen(interaction: ButtonInteraction) {
  await interaction.reply({ ...buildReviewRatingPayload(), ephemeral: true });
}

export async function handleReviewRate(interaction: ButtonInteraction) {
  const [, , ratingValue, context = 'public'] = interaction.customId.split(':');
  const rating = Number(ratingValue);

  await interaction.update(buildReviewRatingPayload(rating, context));
}

export async function handleReviewFeedback(interaction: ButtonInteraction) {
  const [, , ratingValue, context = 'public'] = interaction.customId.split(':');
  const rating = Number(ratingValue);
  const contextSuffix = context === 'public' ? '' : `:${context}`;
  const modal = new ModalBuilder()
    .setCustomId(`review:submit:${rating}${contextSuffix}`)
    .setTitle('Feedback LWX Lab');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('feedback')
        .setLabel('Conte como foi sua experiencia')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(900),
    ),
  );

  await interaction.showModal(modal);
}

export async function handleReviewSubmit(interaction: ModalSubmitInteraction) {
  const [, , ratingValue, context = 'public'] = interaction.customId.split(':');
  const rating = Number(ratingValue);
  const feedback = interaction.fields.getTextInputValue('feedback');
  const channel = await interaction.client.channels.fetch(CHANNEL_IDS.publicReviews).catch(() => null);

  if (channel?.type === ChannelType.GuildText) {
    await channel.send(buildPublicReviewPayload(interaction.user.id, rating, feedback));
  }

  await interaction.reply({ content: 'Feedback publicado. Obrigado por avaliar o LWX Lab.', ephemeral: true });
  setTimeout(() => interaction.deleteReply().catch(() => undefined), TIMING.shortNoticeMs);

  if (context === 'ticket' && interaction.channel?.type === ChannelType.GuildText) {
    const ticketChannel = interaction.channel;
    const state = loadRuntimeState();
    const ticket = state.tickets[ticketChannel.id];
    if (ticket) {
      ticket.status = 'closed';
      saveRuntimeState(state);

      if (ticket.voiceChannelId) {
        const voiceChannel = await interaction.client.channels.fetch(ticket.voiceChannelId).catch(() => null);
        if (voiceChannel?.type === ChannelType.GuildVoice) {
          setTimeout(() => voiceChannel.delete().catch(() => undefined), TIMING.ticketCloseMs);
        }
      }
    }

    await ticketChannel.send('Avaliacao recebida. Ticket finalizado; este canal sera removido em alguns segundos.');
    setTimeout(() => ticketChannel.delete().catch(() => undefined), TIMING.ticketCloseMs);
  }
}
