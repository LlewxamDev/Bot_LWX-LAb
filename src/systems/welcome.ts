import { ChannelType, GuildMember } from 'discord.js';
import { CHANNEL_IDS } from '../config/botConfig';
import { welcomeFacts } from '../data/welcomeFacts';
import { buildTerminalEmbed } from '../ui/embeds';

export async function handleWelcome(member: GuildMember) {
  const channel = await member.client.channels.fetch(CHANNEL_IDS.welcome).catch(() => null);
  if (channel?.type !== ChannelType.GuildText) return;

  const fact = welcomeFacts[Math.floor(Math.random() * welcomeFacts.length)];
  const embed = buildTerminalEmbed({
    command: 'member.join()',
    title: `Bem-vindo, ${member.user.username}`,
    description: `<@${member.id}> entrou no servidor.\n\nConta criada em <t:${Math.floor(member.user.createdTimestamp / 1000)}:D>\nMembro #${member.guild.memberCount}\n\nCuriosidade: ${fact}`,
  });

  await channel.send({ embeds: [embed] });
}
