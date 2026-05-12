import {
  ActionRowBuilder,
  ButtonInteraction,
  ChannelType,
  Client,
  Guild,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { ACCESS_CONTROL, ROLE_CONFIG, TIMING } from '../config/botConfig';
import { buildAnnouncementPreferenceRows } from '../ui/components';
import { buildTerminalEmbed } from '../ui/embeds';

async function ensureRole(guild: Guild, roleName: string) {
  const existing = guild.roles.cache.find((role) => role.name === roleName);
  if (existing) return existing;

  return guild.roles.create({
    name: roleName,
    reason: 'LWX Lab registration setup',
  });
}

export async function ensureServerAccessSetup(client: Client) {
  const guildId = process.env.GUILD_ID || client.guilds.cache.first()?.id;
  if (!guildId) return;

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return;

  const clientRole = await ensureRole(guild, ROLE_CONFIG.clientRoleName);
  await ensureRole(guild, ROLE_CONFIG.announcementsRoleName);

  for (const channelId of ACCESS_CONTROL.publicChannelIds) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildText) continue;

    await channel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: true }).catch((error) => {
      console.warn(`Could not show public channel ${channelId} to @everyone:`, error);
    });
  }

  for (const channelId of ACCESS_CONTROL.protectedChannelIds) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildText) continue;

    await channel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }).catch((error) => {
      console.warn(`Could not hide channel ${channelId} from @everyone:`, error);
    });
    await channel.permissionOverwrites.edit(clientRole, { ViewChannel: true }).catch((error) => {
      console.warn(`Could not allow client role on channel ${channelId}:`, error);
    });
  }
}

function buildRegistrationModal() {
  const modal = new ModalBuilder()
    .setCustomId('register:submit')
    .setTitle('Registro LWX Lab');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('display_name')
        .setLabel('Nome ou apelido')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(40),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('main_interest')
        .setLabel('O que voce procura aqui?')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(80),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('project_goal')
        .setLabel('Qual seu objetivo com design/site/bot?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(400),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('reference')
        .setLabel('Referencia ou contato opcional')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(120),
    ),
  );

  return modal;
}

export async function handleRegistrationOpen(interaction: ButtonInteraction) {
  await interaction.showModal(buildRegistrationModal());
}

export async function handleRegistrationSubmit(interaction: ModalSubmitInteraction) {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: 'Registro disponivel apenas dentro do servidor.', ephemeral: true });
    return;
  }

  const role = await ensureRole(guild, ROLE_CONFIG.clientRoleName);
  const member = await guild.members.fetch(interaction.user.id).catch(() => null);
  if (member) await member.roles.add(role).catch(() => undefined);

  const interest = interaction.fields.getTextInputValue('main_interest');
  const goal = interaction.fields.getTextInputValue('project_goal');
  const embed = buildTerminalEmbed({
    command: 'lwx.register.complete()',
    title: 'Registro concluido',
    description: `Acesso liberado para <@${interaction.user.id}>.\n\nInteresse: ${interest}\nObjetivo: ${goal}\n\nQuer receber notificacoes de anuncios?`,
  });

  await interaction.reply({ embeds: [embed], components: [buildAnnouncementPreferenceRows()], ephemeral: true });
}

export async function handleAnnouncementPreference(interaction: ButtonInteraction) {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: 'Preferencia salva apenas dentro do servidor.', ephemeral: true });
    return;
  }

  const wantsAnnouncements = interaction.customId.endsWith(':yes');
  const role = await ensureRole(guild, ROLE_CONFIG.announcementsRoleName);
  const member = await guild.members.fetch(interaction.user.id).catch(() => null);

  if (member) {
    if (wantsAnnouncements) await member.roles.add(role).catch(() => undefined);
    else await member.roles.remove(role).catch(() => undefined);
  }

  await interaction.update({
    content: wantsAnnouncements ? 'Registro finalizado. Voce recebera avisos do servidor.' : 'Registro finalizado sem avisos.',
    embeds: [],
    components: [],
  });

  setTimeout(() => interaction.deleteReply().catch(() => undefined), TIMING.shortNoticeMs);
}
