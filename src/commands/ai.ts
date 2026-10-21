import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import { askStudioAssistant } from '../ai/chatbot.js';
import { BOT_CONFIG } from '../config/botConfig.js';
import { handleMemberProfileInteraction } from '../systems/registration.js';
import { handleOrderSlashCommand } from '../systems/orders.js';
import { STUDIO_PALETTES, handlePaletteGenInteraction } from '../systems/palette.js';
import { upsertFixedPanels, upsertSinglePanel } from '../systems/panels.js';
import { handlePortfolioSlashCommand } from '../systems/portfolio.js';
import { handlePricingComboOpen } from '../systems/pricing.js';
import { handleReviewOpenModalButton } from '../systems/reviews.js';
import { handleWelcomeSlashCommand } from '../systems/welcome.js';
import { collectBrandFiles, createStudioEmbed, getBrandAttachmentUrl } from '../ui/embeds.js';
import { btnEmoji, em } from '../ui/emojis.js';

export const aiSlashCommand = new SlashCommandBuilder()
  .setName('ia')
  .setDescription('Conversa com o Diretor Criativo IA do estúdio LWX Lab.')
  .addStringOption((option) =>
    option
      .setName('pergunta')
      .setDescription('Sua dúvida sobre serviços, estilos, prazos, preços ou ideias para seu projeto.')
      .setRequired(true)
      .setMinLength(2)
      .setMaxLength(500),
  );

export const welcomeSlashCommand = new SlashCommandBuilder()
  .setName('boas-vindas')
  .setDescription('Gera, testa ou envia o painel e cartão visual de boas-vindas do LWX Lab.')
  .addSubcommand((sub) =>
    sub
      .setName('testar')
      .setDescription('Gera uma prévia em tempo real do cartão e painel de boas-vindas.')
      .addUserOption((opt) =>
        opt.setName('membro').setDescription('Membro para exibir no cartão (opcional).').setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('enviar')
      .setDescription('[Staff] Envia oficialmente as boas-vindas de um membro no canal #👋・boas-vindas.')
      .addUserOption((opt) =>
        opt.setName('membro').setDescription('Membro que receberá as boas-vindas.').setRequired(true),
      ),
  );

export const portfolioSlashCommand = new SlashCommandBuilder()
  .setName('portfolio')
  .setDescription('Explora o acervo oficial de artes e designs do LWX Lab.')
  .addStringOption((opt) =>
    opt
      .setName('categoria')
      .setDescription('Filtrar por especialidade.')
      .setRequired(false)
      .addChoices(
        { name: '✨ Acervo Completo', value: 'all' },
        { name: '🖼️ Banners & Posters HD', value: 'banners' },
        { name: '🎨 Ilustrações & Concept', value: 'illustrations' },
        { name: '👑 Logos & Identidade', value: 'logos' },
        { name: '📦 Packs Visuais', value: 'packs' },
      ),
  )
  .addIntegerOption((opt) =>
    opt
      .setName('obra')
      .setDescription('Ir direto para o número da obra (1 a 11).')
      .setMinValue(1)
      .setMaxValue(11)
      .setRequired(false),
  );

export const simularSlashCommand = new SlashCommandBuilder()
  .setName('simular')
  .setDescription('Abre a calculadora interativa de pacotes e combos de serviços (com 10% OFF em combos).');

export const paletaSlashCommand = new SlashCommandBuilder()
  .setName('paleta')
  .setDescription('Gera um cartão visual de paleta de cores e direção de arte para inspirar seu projeto.')
  .addStringOption((opt) =>
    opt
      .setName('estilo')
      .setDescription('Escolha uma direção de arte ou deixe em branco para sortear.')
      .setRequired(false)
      .addChoices(
        ...STUDIO_PALETTES.map((p) => ({
          name: p.name,
          value: p.id,
        })),
      ),
  );

export const pedidoSlashCommand = new SlashCommandBuilder()
  .setName('pedido')
  .setDescription('Acompanha ou atualiza o progresso visual de uma encomenda no LWX Lab.')
  .addSubcommand((sub) =>
    sub
      .setName('consultar')
      .setDescription('Consulta a barra de progresso e etapa atual do seu pedido.')
      .addStringOption((opt) =>
        opt.setName('codigo').setDescription('Código do pedido (ex.: LWX-101). Opcional.').setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('criar')
      .setDescription('[Staff] Registra uma nova encomenda rastreável para um cliente.')
      .addUserOption((opt) => opt.setName('cliente').setDescription('Cliente da encomenda.').setRequired(true))
      .addStringOption((opt) => opt.setName('servico').setDescription('Serviço contratado.').setRequired(true))
      .addStringOption((opt) => opt.setName('prazo').setDescription('Prazo estimado (ex.: 48h).').setRequired(false))
      .addStringOption((opt) => opt.setName('nota').setDescription('Observação inicial.').setRequired(false)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('atualizar')
      .setDescription('[Staff] Atualiza a etapa de produção de uma encomenda.')
      .addStringOption((opt) => opt.setName('codigo').setDescription('Código (ex.: LWX-101).').setRequired(true))
      .addStringOption((opt) =>
        opt
          .setName('etapa')
          .setDescription('Nova etapa de produção.')
          .setRequired(true)
          .addChoices(
            { name: '1/5 • Briefing & Referências', value: 'briefing' },
            { name: '2/5 • Esboço & Estrutura', value: 'sketch' },
            { name: '3/5 • Render & Iluminação', value: 'render' },
            { name: '4/5 • Revisão com Cliente', value: 'review' },
            { name: '5/5 • Projeto Finalizado', value: 'delivered' },
          ),
      )
      .addStringOption((opt) => opt.setName('nota').setDescription('Nota para o cliente.').setRequired(false)),
  );

export const perfilSlashCommand = new SlashCommandBuilder()
  .setName('perfil')
  .setDescription('Exibe o Cartão Oficial de Membro e Cliente no LWX Lab.')
  .addUserOption((opt) =>
    opt.setName('membro').setDescription('Membro para consultar (opcional).').setRequired(false),
  );

export const avaliarSlashCommand = new SlashCommandBuilder()
  .setName('avaliar')
  .setDescription('Abre o formulário oficial para avaliar um projeto entregue pelo LWX Lab.');

export const painelSlashCommand = new SlashCommandBuilder()
  .setName('painel')
  .setDescription('[Staff] Atualiza e republica os painéis fixos oficiais do servidor.')
  .addStringOption((opt) =>
    opt
      .setName('qual')
      .setDescription('Qual painel deseja atualizar?')
      .setRequired(false)
      .addChoices(
        { name: 'Todos os Painéis', value: 'all' },
        { name: 'Portfólio (#portfólio)', value: 'portfolio' },
        { name: 'Tabela de Preços (#tabela-de-preços)', value: 'pricing' },
        { name: 'Orçamentos (#fazer-orçamento)', value: 'budget' },
        { name: 'Registro (#registre-se)', value: 'register' },
        { name: 'Avaliar (#avaliar)', value: 'reviewPrompt' },
        { name: 'Diretrizes (#regras-e-termos)', value: 'rules' },
      ),
  );

export function getSlashCommandDefinitions(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
  return [
    aiSlashCommand.toJSON(),
    welcomeSlashCommand.toJSON(),
    portfolioSlashCommand.toJSON(),
    simularSlashCommand.toJSON(),
    paletaSlashCommand.toJSON(),
    pedidoSlashCommand.toJSON(),
    perfilSlashCommand.toJSON(),
    avaliarSlashCommand.toJSON(),
    painelSlashCommand.toJSON(),
  ];
}

export async function handleAiCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const question = interaction.options.getString('pergunta', true).trim();

  await interaction.deferReply();

  const answer = await askStudioAssistant(question, interaction.user.displayName);
  const files = collectBrandFiles(['emblem', 'animatedEmblem', 'divider']);

  const embed = createStudioEmbed('primary')
    .setThumbnail(getBrandAttachmentUrl('animatedEmblem'))
    .setImage(getBrandAttachmentUrl('divider'))
    .setTitle('Diretor Criativo IA • LWX Lab')
    .setDescription(
      [
        `> ${em('knight')} **Consulta de ${interaction.user}:** *${question}*`,
        '',
        answer,
      ].join('\n'),
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.budgetOpenModal)
      .setLabel('Abrir Orçamento')
      .setEmoji(btnEmoji('ticket'))
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.pricingComboOpen)
      .setLabel('Simular Valores')
      .setEmoji(btnEmoji('spark'))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.budgetPaletteGen)
      .setLabel('Gerar Paleta')
      .setEmoji(btnEmoji('palette'))
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.editReply({
    embeds: [embed],
    files,
    components: [row],
  });
}

export async function handlePainelSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.guild
    ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null)
    : null;

  const isStaff =
    member?.roles.cache.has(BOT_CONFIG.roles.staff) ||
    member?.permissions.has(PermissionFlagsBits.ManageGuild) ||
    member?.permissions.has(PermissionFlagsBits.Administrator);

  if (!isStaff) {
    await interaction.reply({
      embeds: [
        createStudioEmbed('danger')
          .setTitle('Acesso Restrito à Equipe')
          .setDescription(`> ${em('knight')} Apenas administradores e staff podem republicar os painéis fixos.`),
      ],
      files: collectBrandFiles(['emblem']),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const target = interaction.options.getString('qual') ?? 'all';
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (target === 'all') {
    await upsertFixedPanels(interaction.client);
  } else {
    await upsertSinglePanel(interaction.client, target);
  }

  await interaction.editReply({
    embeds: [
      createStudioEmbed('secondary')
        .setTitle('Painéis Sincronizados!')
        .setDescription(
          `> ${em('verify')} Os painéis selecionados (\`${target}\`) foram atualizados com os novos banners animados em GIF e emojis oficiais!`,
        ),
    ],
    files: collectBrandFiles(['emblem']),
  });
}

export async function dispatchSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  switch (interaction.commandName) {
    case 'ia':
      await handleAiCommand(interaction);
      break;
    case 'boas-vindas':
      await handleWelcomeSlashCommand(interaction);
      break;
    case 'portfolio':
      await handlePortfolioSlashCommand(interaction);
      break;
    case 'simular':
      await handlePricingComboOpen(interaction);
      break;
    case 'paleta':
      await handlePaletteGenInteraction(interaction);
      break;
    case 'pedido':
      await handleOrderSlashCommand(interaction);
      break;
    case 'perfil':
      await handleMemberProfileInteraction(interaction);
      break;
    case 'avaliar':
      await handleReviewOpenModalButton(interaction);
      break;
    case 'painel':
      await handlePainelSlashCommand(interaction);
      break;
    default:
      break;
  }
}
