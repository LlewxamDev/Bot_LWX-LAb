import {
  MessageFlags,
  PermissionFlagsBits,
  type AttachmentBuilder,
  type ChatInputCommandInteraction,
  type EmbedBuilder,
  type GuildMember,
} from 'discord.js';
import { BOT_CONFIG } from '../config/botConfig.js';
import { welcomeFacts } from '../data/welcomeFacts.js';
import { createWelcomeOnboardingRow } from '../ui/components.js';
import {
  collectBrandFiles,
  createDoubleBannerEmbeds,
  createStudioEmbed,
  getBrandAttachmentUrl,
} from '../ui/embeds.js';
import { em } from '../ui/emojis.js';

export function buildWelcomeMessagePayload(member: GuildMember): {
  content: string;
  embeds: EmbedBuilder[];
  files: AttachmentBuilder[];
  components: ReturnType<typeof createWelcomeOnboardingRow>[];
} {
  const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
  const randomFact =
    welcomeFacts[member.guild.memberCount % welcomeFacts.length] ??
    welcomeFacts[0] ??
    'Identidade visual consistente transforma qualquer projeto.';

  const { headerEmbed, files } = createDoubleBannerEmbeds('welcome', 'primary');

  const welcomeEmbed = createStudioEmbed('primary')
    .setThumbnail(avatarUrl)
    .setImage(getBrandAttachmentUrl('divider'))
    .setTitle(`Bem-vindo(a) ao LWX Lab, ${member.displayName}!`)
    .setDescription(
      [
        `> ${em('knight')} Olá, ${member}! Você é o **Membro #${member.guild.memberCount}** do estúdio oficial de **Llewxam**.`,
        `> *${randomFact}*`,
        '',
        `### ${em('spark')} Comece por aqui`,
      ].join('\n'),
    )
    .addFields(
      {
        name: `${em('verify')} 1. Credenciamento`,
        value: `Libere seu acesso completo em <#${BOT_CONFIG.channels.register}>.`,
        inline: true,
      },
      {
        name: `${em('palette')} 2. Portfólio & Preços`,
        value: `Explore <#${BOT_CONFIG.channels.portfolio}> e <#${BOT_CONFIG.channels.pricing}>.`,
        inline: true,
      },
      {
        name: `${em('ticket')} 3. Faça seu Pedido`,
        value: `Abra seu briefing privado em <#${BOT_CONFIG.channels.budget}>.`,
        inline: true,
      },
    );

  return {
    content: `${em('flame')} Seja muito bem-vindo(a) ao **LWX Lab**, ${member}!`,
    embeds: [headerEmbed, welcomeEmbed],
    files,
    components: [createWelcomeOnboardingRow()],
  };
}

export async function handleGuildMemberWelcome(member: GuildMember): Promise<void> {
  const welcomeChannel =
    member.guild.channels.cache.get(BOT_CONFIG.channels.welcome) ??
    (await member.guild.channels.fetch(BOT_CONFIG.channels.welcome).catch(() => null));

  if (!welcomeChannel || !welcomeChannel.isTextBased()) {
    return;
  }

  try {
    const payload = buildWelcomeMessagePayload(member);
    await welcomeChannel.send(payload);
  } catch (error) {
    console.error('Erro ao enviar mensagem de boas-vindas:', error);
  }
}

/**
 * Mandatory /boas-vindas Slash Command Handler:
 * Allows testing/previewing the Animated GIF Welcome Double-Embed Hub or sending it officially to #👋・boas-vindas.
 */
export async function handleWelcomeSlashCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: 'Este comando só pode ser utilizado dentro do servidor.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const sub = interaction.options.getSubcommand(false) ?? 'testar';
  const targetUser = interaction.options.getUser('membro') ?? interaction.user;
  const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

  if (!targetMember) {
    await interaction.reply({
      content: 'Não foi possível localizar o membro selecionado no servidor.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === 'enviar') {
    const caller = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    const isStaff =
      caller?.roles.cache.has(BOT_CONFIG.roles.staff) ||
      caller?.permissions.has(PermissionFlagsBits.ManageGuild) ||
      caller?.permissions.has(PermissionFlagsBits.Administrator);

    if (!isStaff) {
      await interaction.reply({
        embeds: [
          createStudioEmbed('danger')
            .setTitle('Acesso Restrito à Equipe')
            .setDescription(
              `> ${em('knight')} Apenas a equipe do **LWX Lab** pode disparar boas-vindas públicas no canal oficial. Use \`/boas-vindas testar\` para visualizar sua prévia!`,
            ),
        ],
        files: collectBrandFiles(['emblem']),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await handleGuildMemberWelcome(targetMember);

    await interaction.editReply({
      embeds: [
        createStudioEmbed('secondary')
          .setTitle('Boas-Vindas Enviada!')
          .setDescription(
            `> ${em('verify')} O painel animado de boas-vindas para ${targetMember} foi enviado com sucesso em <#${BOT_CONFIG.channels.welcome}>!`,
          ),
      ],
      files: collectBrandFiles(['emblem']),
    });
    return;
  }

  // sub === 'testar'
  const payload = buildWelcomeMessagePayload(targetMember);

  await interaction.reply({
    content: payload.content,
    embeds: payload.embeds,
    files: payload.files,
    components: payload.components,
    flags: MessageFlags.Ephemeral,
  });
}
