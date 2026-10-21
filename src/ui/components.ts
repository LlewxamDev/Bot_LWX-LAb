import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { BOT_CONFIG } from '../config/botConfig.js';
import {
  portfolioCategories,
  portfolioItems,
  type PortfolioCategoryId,
  type PortfolioItem,
} from '../data/portfolio.js';
import { pricingServices } from '../data/pricing.js';
import { btnEmoji, type LwxEmojiKey } from './emojis.js';

const CATEGORY_EMOJI_MAP: Record<PortfolioCategoryId, LwxEmojiKey> = {
  all: 'knight',
  banners: 'flame',
  logos: 'crown',
  illustrations: 'palette',
  packs: 'glitch',
  uiux: 'spark',
  sites: 'verify',
};

const SERVICE_EMOJI_MAP: Record<string, LwxEmojiKey> = {
  banner: 'flame',
  logo: 'crown',
  illustration: 'palette',
  server_pack: 'glitch',
  ui_kit: 'spark',
  web_landing: 'knight',
};

/**
 * Registration Panel Components:
 * 4 bespoke buttons with custom animated emojis (Verify + Notification Role Toggles + Member Dossier Card).
 */
export function createRegisterButtonRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.registerVerify)
      .setLabel('Liberar Acesso')
      .setEmoji(btnEmoji('verify'))
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.registerAvisos)
      .setLabel('Cargo • Avisos LWX')
      .setEmoji(btnEmoji('flame'))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.registerEventos)
      .setLabel('Cargo • Drops & Eventos')
      .setEmoji(btnEmoji('spark'))
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.registerProfile)
      .setLabel('Meu Cartão LWX')
      .setEmoji(btnEmoji('knight'))
      .setStyle(ButtonStyle.Secondary),
  );
}

/**
 * Portfolio Fixed Panel Components:
 * Row 1: Category quick-launch buttons with custom animated Knight/Flame emojis
 * Row 2: Direct Jump Select Menu to open any of the 11 artworks immediately
 */
export function createPortfolioEntryButtonRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.portfolioOpen)
      .setLabel(`Explorar Acervo (${portfolioItems.length})`)
      .setEmoji(btnEmoji('knight'))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.portfolioCatBanners)
      .setLabel('Banners & Posters')
      .setEmoji(btnEmoji('flame'))
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.portfolioCatArt)
      .setLabel('Ilustrações & Concept')
      .setEmoji(btnEmoji('palette'))
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.portfolioCatBrand)
      .setLabel('Logos & Packs')
      .setEmoji(btnEmoji('crown'))
      .setStyle(ButtonStyle.Secondary),
  );
}

export function createPortfolioQuickJumpRow(): ActionRowBuilder<StringSelectMenuBuilder> {
  const select = new StringSelectMenuBuilder()
    .setCustomId(BOT_CONFIG.customIds.portfolioJump)
    .setPlaceholder('⚡ Saltar direto para uma obra do acervo LWX Lab...')
    .addOptions(
      portfolioItems.map((item, idx) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(`${String(idx + 1).padStart(2, '0')} • ${item.title}`.slice(0, 100))
          .setValue(`${idx}:all`)
          .setDescription(item.technique.slice(0, 100))
          .setEmoji(btnEmoji(CATEGORY_EMOJI_MAP[item.category] ?? 'spark')),
      ),
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

/**
 * Interactive Portfolio Browser Rows (pure unframed artworks + navigation + direct order button).
 */
export function createPortfolioBrowserRows(
  selectedCategory: PortfolioCategoryId,
  pageIndex: number,
  totalItems: number,
  categoryItems: PortfolioItem[] = [],
  currentItem?: PortfolioItem,
): [
  ActionRowBuilder<StringSelectMenuBuilder>,
  ActionRowBuilder<StringSelectMenuBuilder>,
  ActionRowBuilder<ButtonBuilder>,
] {
  const categorySelect = new StringSelectMenuBuilder()
    .setCustomId(BOT_CONFIG.customIds.portfolioCategory)
    .setPlaceholder('Filtrar categoria do acervo...')
    .addOptions(
      portfolioCategories.map((category) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(category.label)
          .setValue(category.id)
          .setDescription(category.description.slice(0, 100))
          .setEmoji(btnEmoji(CATEGORY_EMOJI_MAP[category.id] ?? 'spark'))
          .setDefault(category.id === selectedCategory),
      ),
    );

  const jumpOptions =
    categoryItems.length > 0
      ? categoryItems.slice(0, 25).map((item, idx) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(`${String(idx + 1).padStart(2, '0')} • ${item.title}`.slice(0, 100))
            .setValue(`${idx}:${selectedCategory}`)
            .setDescription(item.technique.slice(0, 100))
            .setEmoji(btnEmoji(CATEGORY_EMOJI_MAP[item.category] ?? 'spark'))
            .setDefault(idx === pageIndex),
        )
      : [
          new StringSelectMenuOptionBuilder()
            .setLabel('Nenhuma obra nesta categoria')
            .setValue('0:all')
            .setDescription('Selecione outra categoria acima')
            .setDefault(true),
        ];

  const jumpSelect = new StringSelectMenuBuilder()
    .setCustomId(BOT_CONFIG.customIds.portfolioJump)
    .setPlaceholder('Ir direto para uma obra...')
    .setDisabled(categoryItems.length <= 1)
    .addOptions(jumpOptions);

  const disableNav = totalItems <= 1;
  const serviceId = currentItem?.serviceId ?? 'custom';

  const navButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${BOT_CONFIG.customIds.portfolioPrev}:${selectedCategory}:${pageIndex}`)
      .setLabel('Anterior')
      .setEmoji(btnEmoji('glitch'))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disableNav),
    new ButtonBuilder()
      .setCustomId('lwx:portfolio:counter_pill')
      .setLabel(`Obra ${String(pageIndex + 1).padStart(2, '0')}/${String(Math.max(1, totalItems)).padStart(2, '0')}`)
      .setEmoji(btnEmoji('knight'))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`${BOT_CONFIG.customIds.portfolioNext}:${selectedCategory}:${pageIndex}`)
      .setLabel('Próxima')
      .setEmoji(btnEmoji('flame'))
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disableNav),
    new ButtonBuilder()
      .setCustomId(`${BOT_CONFIG.customIds.portfolioOrderThis}:${serviceId}`)
      .setLabel('Encomendar Neste Estilo')
      .setEmoji(btnEmoji('ticket'))
      .setStyle(ButtonStyle.Success),
  );

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(categorySelect),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(jumpSelect),
    navButtons,
  ];
}

/**
 * Pricing Panel Components:
 * Row 1: Direct interactive Service Select Menu right on the panel
 * Row 2: Combo Calculator + Start Briefing + View Portfolio buttons
 */
export function createPricingSelectRow(selectedServiceId?: string): ActionRowBuilder<StringSelectMenuBuilder> {
  const select = new StringSelectMenuBuilder()
    .setCustomId(BOT_CONFIG.customIds.pricingSelect)
    .setPlaceholder('💎 Selecione um serviço para inspecionar escopo, prazo e valor...')
    .addOptions(
      pricingServices.map((service) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(`${service.name} — ${service.priceLabel}`)
          .setValue(service.id)
          .setDescription(`Prazo: ${service.deliveryEstimate} • ${service.revisionsIncluded}`.slice(0, 100))
          .setEmoji(btnEmoji(SERVICE_EMOJI_MAP[service.id] ?? 'spark'))
          .setDefault(service.id === selectedServiceId),
      ),
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

export function createPricingEntryButtonRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.pricingComboOpen)
      .setLabel('Simulador de Pacote / Combo')
      .setEmoji(btnEmoji('spark'))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.budgetOpenModal)
      .setLabel('Iniciar Orçamento')
      .setEmoji(btnEmoji('ticket'))
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.portfolioOpen)
      .setLabel('Ver Portfólio')
      .setEmoji(btnEmoji('palette'))
      .setStyle(ButtonStyle.Secondary),
  );
}

export function createPricingComboSelectRow(): ActionRowBuilder<StringSelectMenuBuilder> {
  const select = new StringSelectMenuBuilder()
    .setCustomId(BOT_CONFIG.customIds.pricingComboSelect)
    .setPlaceholder('🧮 Selecione 1 ou mais serviços para calcular o pacote...')
    .setMinValues(1)
    .setMaxValues(pricingServices.length)
    .addOptions(
      pricingServices.map((service) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(`${service.name} (${service.priceLabel})`)
          .setValue(service.id)
          .setDescription(service.summary.slice(0, 100))
          .setEmoji(btnEmoji(SERVICE_EMOJI_MAP[service.id] ?? 'spark')),
      ),
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

/**
 * Review Panel Components:
 * 1-Click Star Rating buttons that pre-fill the rating + full modal button!
 */
export function createReviewPromptButtonRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.reviewStar5)
      .setLabel('5★ Excelente')
      .setEmoji(btnEmoji('crown'))
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.reviewStar4)
      .setLabel('4★ Muito Bom')
      .setEmoji(btnEmoji('flame'))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.reviewStar3)
      .setLabel('3★ Regular')
      .setEmoji(btnEmoji('spark'))
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.reviewOpenModal)
      .setLabel('Escrever Feedback')
      .setEmoji(btnEmoji('ticket'))
      .setStyle(ButtonStyle.Secondary),
  );
}

/**
 * Budget / Ticket Panel Components:
 * Row 1: Express Service Buttons + Full Custom Briefing
 * Row 2: Combo Simulator + Visual Palette Generator
 */
export function createBudgetButtonRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.budgetOpenModal)
      .setLabel('Briefing Sob Medida')
      .setEmoji(btnEmoji('ticket'))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.budgetQuickBanner)
      .setLabel('Banner / Header')
      .setEmoji(btnEmoji('flame'))
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.budgetQuickArt)
      .setLabel('Ilustração / OC')
      .setEmoji(btnEmoji('palette'))
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.budgetQuickBrand)
      .setLabel('Logo / Pack Visual')
      .setEmoji(btnEmoji('crown'))
      .setStyle(ButtonStyle.Secondary),
  );
}

export function createBudgetUtilityRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.pricingComboOpen)
      .setLabel('Simular Valor do Projeto')
      .setEmoji(btnEmoji('spark'))
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.budgetPaletteGen)
      .setLabel('Gerar Ideia de Paleta')
      .setEmoji(btnEmoji('glitch'))
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.orderTrackOpen)
      .setLabel('Rastrear Meu Pedido')
      .setEmoji(btnEmoji('flame'))
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.portfolioOpen)
      .setLabel('Explorar Referências')
      .setEmoji(btnEmoji('knight'))
      .setStyle(ButtonStyle.Secondary),
  );
}

/**
 * Ticket Channel Control Row (Inside Private Order Channel).
 */
export function createTicketControlRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.ticketClaim)
      .setLabel('Assumir Atendimento')
      .setEmoji(btnEmoji('knight'))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.orderTrackOpen)
      .setLabel('Ver Progresso do Pedido')
      .setEmoji(btnEmoji('flame'))
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.budgetPaletteGen)
      .setLabel('Gerar Paleta pro Projeto')
      .setEmoji(btnEmoji('palette'))
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.ticketClose)
      .setLabel('Finalizar & Arquivar')
      .setEmoji(btnEmoji('verify'))
      .setStyle(ButtonStyle.Danger),
  );
}

export function createTicketStageSelectRow(orderId: string): ActionRowBuilder<StringSelectMenuBuilder> {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`${BOT_CONFIG.customIds.orderStageSelect}:${orderId}`)
    .setPlaceholder(`🛠️ [Staff] Atualizar etapa da encomenda #${orderId}...`)
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('1/5 • Briefing & Referências')
        .setValue('briefing')
        .setDescription('Alinhamento inicial de conceito, cores e direção de arte.')
        .setEmoji(btnEmoji('ticket')),
      new StringSelectMenuOptionBuilder()
        .setLabel('2/5 • Esboço & Estrutura')
        .setValue('sketch')
        .setDescription('Construção do layout base, composição e silhuetas.')
        .setEmoji(btnEmoji('palette')),
      new StringSelectMenuOptionBuilder()
        .setLabel('3/5 • Render & Iluminação')
        .setValue('render')
        .setDescription('Aplicação de texturas, efeitos de luz, tipografia e acabamento.')
        .setEmoji(btnEmoji('flame')),
      new StringSelectMenuOptionBuilder()
        .setLabel('4/5 • Revisão com Cliente')
        .setValue('review')
        .setDescription('Prévias enviadas para aprovação e ajustes de detalhes.')
        .setEmoji(btnEmoji('spark')),
      new StringSelectMenuOptionBuilder()
        .setLabel('5/5 • Projeto Finalizado')
        .setValue('delivered')
        .setDescription('Arquivos master entregues em alta resolução.')
        .setEmoji(btnEmoji('verify')),
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

/**
 * Rules & Terms Interactive Row (#📜・regras-e-termos).
 */
export function createRulesButtonRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.rulesAccept)
      .setLabel('Li e Concordo com os Termos')
      .setEmoji(btnEmoji('verify'))
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.rulesFaq)
      .setLabel('Dúvidas Frequentes (FAQ)')
      .setEmoji(btnEmoji('spark'))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.pricingComboOpen)
      .setLabel('Simular Valores')
      .setEmoji(btnEmoji('flame'))
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.budgetOpenModal)
      .setLabel('Fazer Orçamento')
      .setEmoji(btnEmoji('ticket'))
      .setStyle(ButtonStyle.Secondary),
  );
}

/**
 * Silia AI Fixed Panel Row (#🤖・silia-ai):
 * Two main commands requested by the user:
 * 1. Conversar com a Silia AI
 * 2. Aprimorar Ideia com Silia AI
 */
export function createSiliaPanelButtonRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.siliaChat)
      .setLabel('Conversar com a Silia AI')
      .setEmoji(btnEmoji('silia'))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.siliaIdeate)
      .setLabel('Aprimorar Ideia com Silia AI')
      .setEmoji(btnEmoji('spark'))
      .setStyle(ButtonStyle.Success),
  );
}

/**
 * Welcome Onboarding Interactive Row.
 */
export function createWelcomeOnboardingRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.portfolioOpen)
      .setLabel('Explorar Portfólio')
      .setEmoji(btnEmoji('knight'))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.pricingComboOpen)
      .setLabel('Simular Orçamento')
      .setEmoji(btnEmoji('spark'))
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.budgetOpenModal)
      .setLabel('Fazer Pedido')
      .setEmoji(btnEmoji('ticket'))
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(BOT_CONFIG.customIds.registerProfile)
      .setLabel('Meu Cartão')
      .setEmoji(btnEmoji('crown'))
      .setStyle(ButtonStyle.Secondary),
  );
}
