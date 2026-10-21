import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type EmbedBuilder,
  type ModalSubmitInteraction,
} from 'discord.js';
import { BOT_CONFIG } from '../config/botConfig.js';
import { collectBrandFiles, createStudioEmbed, getBrandAttachmentUrl } from '../ui/embeds.js';
import { em } from '../ui/emojis.js';

const REVIEW_STARS_INPUT_ID = 'lwx:review:stars';
const REVIEW_SERVICE_INPUT_ID = 'lwx:review:service';
const REVIEW_COMMENT_INPUT_ID = 'lwx:review:comment';

export type ReviewSubmission = {
  stars: number;
  service: string;
  comment: string;
};

export function parseReviewSubmission(
  rawStars: string,
  rawService: string,
  rawComment: string,
): { ok: true; value: ReviewSubmission } | { ok: false; error: string } {
  const normalizedStars = rawStars.trim();
  const stars = Number.parseInt(normalizedStars, 10);

  if (!/^[1-5]$/.test(normalizedStars) || Number.isNaN(stars) || stars < 1 || stars > 5) {
    return {
      ok: false,
      error: 'A nota deve ser um número inteiro de **1** a **5** estrelas.',
    };
  }

  const service = rawService.trim();
  if (service.length < 2) {
    return {
      ok: false,
      error: 'Informe qual serviço foi contratado (mínimo de 2 caracteres).',
    };
  }

  const comment = rawComment.trim();
  if (comment.length < 6) {
    return {
      ok: false,
      error: 'Escreva um depoimento com pelo menos 6 caracteres.',
    };
  }

  return {
    ok: true,
    value: {
      stars,
      service,
      comment,
    },
  };
}

export function formatStars(stars: number): string {
  const clamped = Math.max(1, Math.min(5, stars));
  return `${'⭐'.repeat(clamped)}${'▫️'.repeat(5 - clamped)} (${clamped}/5)`;
}

export function buildReviewModal(prefilledStars?: string): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(BOT_CONFIG.customIds.reviewModal)
    .setTitle('Avaliar Projeto • LWX Lab');

  const starsInput = new TextInputBuilder()
    .setCustomId(REVIEW_STARS_INPUT_ID)
    .setLabel('Nota de 1 a 5 estrelas')
    .setPlaceholder('Ex.: 5')
    .setMinLength(1)
    .setMaxLength(1)
    .setRequired(true)
    .setStyle(TextInputStyle.Short);

  if (prefilledStars) {
    starsInput.setValue(prefilledStars);
  }

  const serviceInput = new TextInputBuilder()
    .setCustomId(REVIEW_SERVICE_INPUT_ID)
    .setLabel('Qual projeto / serviço foi realizado?')
    .setPlaceholder('Ex.: Banner HD, Identidade Visual, Ilustração, Pack...')
    .setMinLength(2)
    .setMaxLength(80)
    .setRequired(true)
    .setStyle(TextInputStyle.Short);

  const commentInput = new TextInputBuilder()
    .setCustomId(REVIEW_COMMENT_INPUT_ID)
    .setLabel('Como foi sua experiência com o LWX Lab?')
    .setPlaceholder('Conte como foi o atendimento, prazo e resultado final da arte...')
    .setMinLength(6)
    .setMaxLength(900)
    .setRequired(true)
    .setStyle(TextInputStyle.Paragraph);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(starsInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(serviceInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(commentInput),
  );

  return modal;
}

export function buildPublishedReviewEmbed(
  authorTag: string,
  authorId: string,
  authorAvatarUrl: string | null,
  submission: ReviewSubmission,
): EmbedBuilder {
  const ratingLabels: Record<number, string> = {
    5: 'Excelência Máxima',
    4: 'Muito Satisfeito',
    3: 'Satisfeito',
    2: 'Regular',
    1: 'Insatisfeito',
  };
  const label = ratingLabels[submission.stars] ?? 'Avaliação';

  const embed = createStudioEmbed(submission.stars >= 5 ? 'primary' : 'secondary')
    .setImage(getBrandAttachmentUrl('divider'))
    .setTitle(`Depoimento de Cliente • ${label}`)
    .setDescription(
      [
        `> ${em('spark')} *"${submission.comment}"*`,
      ].join('\n'),
    )
    .addFields(
      {
        name: `${em('crown')} Cliente`,
        value: `<@${authorId}>\n-# ${authorTag}`,
        inline: true,
      },
      {
        name: `${em('palette')} Projeto Entregue`,
        value: `**${submission.service}**`,
        inline: true,
      },
      {
        name: `${em('flame')} Classificação`,
        value: `**${formatStars(submission.stars)}**`,
        inline: true,
      },
    );

  if (authorAvatarUrl) {
    embed.setThumbnail(authorAvatarUrl);
  }

  return embed;
}

export async function handleReviewOpenModalButton(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
): Promise<void> {
  let prefill: string | undefined;
  if (interaction.isButton()) {
    if (interaction.customId === BOT_CONFIG.customIds.reviewStar5) prefill = '5';
    else if (interaction.customId === BOT_CONFIG.customIds.reviewStar4) prefill = '4';
    else if (interaction.customId === BOT_CONFIG.customIds.reviewStar3) prefill = '3';
  }
  await interaction.showModal(buildReviewModal(prefill));
}

export async function handleReviewModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const rawStars = interaction.fields.getTextInputValue(REVIEW_STARS_INPUT_ID);
  const rawService = interaction.fields.getTextInputValue(REVIEW_SERVICE_INPUT_ID);
  const rawComment = interaction.fields.getTextInputValue(REVIEW_COMMENT_INPUT_ID);

  const parsed = parseReviewSubmission(rawStars, rawService, rawComment);

  if (!parsed.ok) {
    const errorEmbed = createStudioEmbed('danger')
      .setTitle('Avaliação Inválida')
      .setDescription(`> ${parsed.error}`);

    await interaction.reply({
      embeds: [errorEmbed],
      files: collectBrandFiles(['emblem']),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({
      content: 'Esta ação só pode ser usada dentro do servidor.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const reviewsChannel =
    guild.channels.cache.get(BOT_CONFIG.channels.reviews) ??
    (await guild.channels.fetch(BOT_CONFIG.channels.reviews));

  if (!reviewsChannel || !reviewsChannel.isTextBased()) {
    await interaction.reply({
      content: 'O canal público de avaliações não foi encontrado.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const avatarUrl = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });
  const reviewEmbed = buildPublishedReviewEmbed(
    interaction.user.tag,
    interaction.user.id,
    avatarUrl,
    parsed.value,
  );
  const files = collectBrandFiles(['emblem', 'divider']);

  await reviewsChannel.send({
    embeds: [reviewEmbed],
    files,
  });

  const confirmEmbed = createStudioEmbed('primary')
    .setTitle('Depoimento Publicado • Obrigado!')
    .setDescription(
      [
        `> ${em('verify')} Muito obrigado pelo seu feedback, ${interaction.user}!`,
        `> Sua avaliação de **${parsed.value.stars} estrelas** para **${parsed.value.service}** já está publicada em <#${BOT_CONFIG.channels.reviews}>.`,
      ].join('\n'),
    );

  await interaction.reply({
    embeds: [confirmEmbed],
    files: collectBrandFiles(['emblem']),
    flags: MessageFlags.Ephemeral,
  });
}
