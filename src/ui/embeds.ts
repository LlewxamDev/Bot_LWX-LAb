import { EmbedBuilder } from 'discord.js';
import { THEME } from '../config/botConfig';

type TerminalEmbedInput = {
  command: string;
  title: string;
  description: string;
};

export function buildTerminalEmbed(input: TerminalEmbedInput): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(THEME.accent)
    .setTitle(`> ${input.command}`)
    .setDescription(`**${input.title}**\n${input.description}`)
    .setFooter({ text: THEME.footer })
    .setTimestamp();
}

export function renderStars(rating: number): string {
  return Array.from({ length: 5 }, (_, index) => (index < rating ? '★' : '☆')).join(' ');
}
