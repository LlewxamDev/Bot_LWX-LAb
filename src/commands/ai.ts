import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { askAI } from '../ai/chatbot';

export const data = new SlashCommandBuilder()
  .setName('ia')
  .setDescription('Converse com a IA do LWX Lab.')
  .addStringOption((option) =>
    option
      .setName('mensagem')
      .setDescription('O que voce quer perguntar ou pesquisar?')
      .setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const message = interaction.options.getString('mensagem', true);

  await interaction.deferReply();
  const response = await askAI(message);
  await interaction.editReply(response);
}
