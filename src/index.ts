import { Client, Events, GatewayIntentBits, REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { askAI } from './ai/chatbot';
import * as cmdAI from './commands/ai';
import { upsertFixedPanels } from './systems/panels';
import { handlePortfolioCategory, handlePortfolioOpen, handlePortfolioPage } from './systems/portfolio';
import { handlePricingOpen, handlePricingSelect } from './systems/pricing';
import {
  ensureServerAccessSetup,
  handleAnnouncementPreference,
  handleRegistrationOpen,
  handleRegistrationSubmit,
} from './systems/registration';
import { handleReviewFeedback, handleReviewOpen, handleReviewRate, handleReviewSubmit } from './systems/reviews';
import {
  handleTicketCallDecision,
  handleTicketClaim,
  handleTicketClose,
  handleTicketFinish,
  handleTicketModeSelect,
  handleTicketStart,
} from './systems/tickets';
import { handleWelcome } from './systems/welcome';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

const commands = [cmdAI.data.toJSON()];

client.once(Events.ClientReady, async (c) => {
  console.log(`Logado com sucesso como ${c.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || '');
  try {
    await rest.put(Routes.applicationGuildCommands(c.user.id, process.env.GUILD_ID || ''), { body: commands });
    console.log('Slash commands atualizados: /ia');
  } catch (error) {
    console.error('Erro ao registrar comandos', error);
  }

  await ensureServerAccessSetup(client);
  await upsertFixedPanels(client);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'ia') await cmdAI.execute(interaction);
    return;
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'register:open') await handleRegistrationOpen(interaction);
    else if (interaction.customId.startsWith('register:announcements:')) await handleAnnouncementPreference(interaction);
    else if (interaction.customId === 'portfolio:open') await handlePortfolioOpen(interaction);
    else if (interaction.customId.startsWith('portfolio:page:')) await handlePortfolioPage(interaction);
    else if (interaction.customId === 'pricing:open') await handlePricingOpen(interaction);
    else if (interaction.customId === 'review:open') await handleReviewOpen(interaction);
    else if (interaction.customId.startsWith('review:rate:')) await handleReviewRate(interaction);
    else if (interaction.customId.startsWith('review:feedback:')) await handleReviewFeedback(interaction);
    else if (interaction.customId.startsWith('ticket:start:')) await handleTicketStart(interaction);
    else if (interaction.customId.startsWith('ticket:mode:')) await handleTicketModeSelect(interaction);
    else if (interaction.customId.startsWith('ticket:call:')) await handleTicketCallDecision(interaction);
    else if (interaction.customId === 'ticket:claim') await handleTicketClaim(interaction);
    else if (interaction.customId === 'ticket:finish') await handleTicketFinish(interaction);
    else if (interaction.customId === 'ticket:close') await handleTicketClose(interaction);
    return;
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'portfolio:category') await handlePortfolioCategory(interaction);
    else if (interaction.customId === 'pricing:service') await handlePricingSelect(interaction);
    return;
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'register:submit') await handleRegistrationSubmit(interaction);
    else if (interaction.customId.startsWith('review:submit:')) await handleReviewSubmit(interaction);
  }
});

client.on(Events.GuildMemberAdd, handleWelcome);

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const isMention = message.mentions.has(client.user?.id || '');
  const isDM = !message.guild;
  if (!isMention && !isDM) return;

  const cleanContent = message.content.replace(/<@!?[0-9]+>/g, '').trim();
  await message.channel.sendTyping();
  const iaResponse = await askAI(cleanContent || 'Ola');
  await message.reply(iaResponse);
});

if (!process.env.DISCORD_TOKEN) {
  console.log('IMPORTANTE: Preencha o DISCORD_TOKEN no arquivo .env');
} else {
  client.login(process.env.DISCORD_TOKEN);
}
