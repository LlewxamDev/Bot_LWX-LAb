import {
  type ActionRowBuilder,
  type AttachmentBuilder,
  type ButtonBuilder,
  type EmbedBuilder,
  type StringSelectMenuBuilder,
} from 'discord.js';
import { BOT_CONFIG } from '../config/botConfig.js';
import { portfolioCategories, portfolioItems } from '../data/portfolio.js';
import { pricingPolicies, pricingServices } from '../data/pricing.js';
import {
  createBudgetButtonRow,
  createBudgetUtilityRow,
  createPortfolioEntryButtonRow,
  createPortfolioQuickJumpRow,
  createPricingEntryButtonRow,
  createPricingSelectRow,
  createRegisterButtonRow,
  createReviewPromptButtonRow,
  createRulesButtonRow,
  createSiliaPanelButtonRow,
  createWelcomeOnboardingRow,
} from './components.js';
import {
  createDoubleBannerEmbeds,
  createSiliaEmbed,
  createStudioEmbed,
  getBrandAttachmentUrl,
} from './embeds.js';
import { em } from './emojis.js';

export type FixedPanelPayload = {
  marker: string;
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
  files: AttachmentBuilder[];
};

function withMarkerFooter(embed: EmbedBuilder, marker: string, iconKey: 'emblem' | 'siliaAvatar' = 'emblem'): EmbedBuilder {
  const prefix = iconKey === 'siliaAvatar' ? 'Silia AI • Estúdio LWX Lab' : BOT_CONFIG.brand.footer;
  return embed.setFooter({
    text: `${prefix} • ${marker}`,
    iconURL: getBrandAttachmentUrl(iconKey),
  });
}

// ============================================================================
// 1. PAINEL DE REGISTRO & CREDENCIAL OBRIGATÓRIA (#✅・registre-se)
// ============================================================================

export function buildRegisterPanelEmbed(): EmbedBuilder {
  return withMarkerFooter(
    createStudioEmbed('primary')
      .setThumbnail(getBrandAttachmentUrl('animatedEmblem'))
      .setImage(getBrandAttachmentUrl('divider'))
      .setTitle('Portão de Acesso & Credenciamento • LWX Lab')
      .setDescription(
        [
          `> ${em('knight')} **Bem-vindo ao estúdio oficial de criação visual de Llewxam.**`,
          '> Para manter a comunidade organizada e segura, **o restante do servidor fica bloqueado até você ativar sua credencial** no botão abaixo.',
          '',
          `### ${em('spark')} Como liberar seu acesso completo`,
        ].join('\n'),
      )
      .addFields(
        {
          name: `${em('verify')} 1. Credencial Obrigatória`,
          value: [
            'Clique em **Liberar Acesso** para receber o cargo de **Membro Verificado** e desbloquear todos os canais do servidor.',
            '-# Liberação imediata em 1 clique',
          ].join('\n'),
          inline: true,
        },
        {
          name: `${em('flame')} 2. Radares & Avisos`,
          value: [
            'Ative ou desative os cargos de **Avisos LWX** e **Drops & Eventos** quando quiser.',
            '-# Sem spam • Apenas lançamentos reais',
          ].join('\n'),
          inline: true,
        },
        {
          name: `${em('crown')} 3. Cartão de Membro`,
          value: [
            'Consulte seu **Dossiê LWX** com seus cargos ativos, pedidos em andamento e histórico.',
            '-# Visualização privada e instantânea',
          ].join('\n'),
          inline: true,
        },
      ),
    BOT_CONFIG.panelMarkers.register,
  );
}

export function buildRegisterPanelMessage(): FixedPanelPayload {
  const { headerEmbed, files } = createDoubleBannerEmbeds('register', 'primary');
  const bodyEmbed = buildRegisterPanelEmbed();

  return {
    marker: BOT_CONFIG.panelMarkers.register,
    embeds: [headerEmbed, bodyEmbed],
    components: [createRegisterButtonRow()],
    files,
  };
}

// ============================================================================
// 2. PAINEL DE PORTFÓLIO (#🖼️・portfólio)
// ============================================================================

export function buildPortfolioEntryEmbed(): EmbedBuilder {
  const categoriesSummary = portfolioCategories
    .filter((c) => c.id !== 'all' && c.id !== 'sites')
    .map((c) => `${em('spark')} **${c.label}** — *${c.description}*`)
    .join('\n');

  return withMarkerFooter(
    createStudioEmbed('accent')
      .setThumbnail(getBrandAttachmentUrl('animatedEmblem'))
      .setImage(getBrandAttachmentUrl('divider'))
      .setTitle(`Galeria & Vitrine Oficial • ${portfolioItems.length} Obras Autorais`)
      .setDescription(
        [
          `> ${em('palette')} **Direção de arte autoral, composições de alto impacto e identidade visual exclusiva.**`,
          '> Navegue pelas categorias nos botões abaixo ou salte diretamente para qualquer obra usando o menu rápido.',
          '',
          `### ${em('crown')} Especialidades em Exposição`,
          categoriesSummary,
        ].join('\n'),
      )
      .addFields(
        {
          name: `${em('flame')} Banners & Posters HD`,
          value: 'Composições esportivas, headers sociais e iluminação cinematográfica.',
          inline: true,
        },
        {
          name: `${em('palette')} Ilustração & Concept`,
          value: 'Personagens autorais, estética dark-glitch, aquarela e arte conceitual.',
          inline: true,
        },
        {
          name: `${em('crown')} Identidade & Packs`,
          value: 'Logos, mascotes originais e sistemas visuais completos para servidores.',
          inline: true,
        },
      ),
    BOT_CONFIG.panelMarkers.portfolio,
  );
}

export function buildPortfolioPanelMessage(): FixedPanelPayload {
  const { headerEmbed, files } = createDoubleBannerEmbeds('portfolio', 'accent');
  const bodyEmbed = buildPortfolioEntryEmbed();

  return {
    marker: BOT_CONFIG.panelMarkers.portfolio,
    embeds: [headerEmbed, bodyEmbed],
    components: [createPortfolioEntryButtonRow(), createPortfolioQuickJumpRow()],
    files,
  };
}

// ============================================================================
// 3. PAINEL DE TABELA DE PREÇOS (#💰・tabela-de-preços)
// ============================================================================

export function buildPricingEntryEmbed(): EmbedBuilder {
  const serviceGrid = pricingServices.map((service) => ({
    name: `${em('flame')} ${service.name}`,
    value: [
      `**${service.priceLabel}**`,
      `⏱️ *${service.deliveryEstimate}*`,
      `-# ${service.revisionsIncluded}`,
    ].join('\n'),
    inline: true,
  }));

  return withMarkerFooter(
    createStudioEmbed('secondary')
      .setThumbnail(getBrandAttachmentUrl('animatedEmblem'))
      .setImage(getBrandAttachmentUrl('divider'))
      .setTitle('Tabela de Investimento & Simulador de Projetos')
      .setDescription(
        [
          `> ${em('spark')} **Valores super acessíveis de entrada no mercado com qualidade profissional de estúdio.**`,
          '> Selecione um serviço no menu abaixo para inspecionar os entregáveis ou use o **Simulador de Pacote / Combo** para calcular descontos automáticos de **10% OFF**.',
          '',
          `### ${em('verify')} Garantias do Estúdio LWX Lab`,
          pricingPolicies.map((p) => `${em('spark')} ${p}`).join('\n'),
        ].join('\n'),
      )
      .addFields(...serviceGrid),
    BOT_CONFIG.panelMarkers.pricing,
  );
}

export function buildPricingPanelMessage(): FixedPanelPayload {
  const { headerEmbed, files } = createDoubleBannerEmbeds('pricing', 'secondary');
  const bodyEmbed = buildPricingEntryEmbed();

  return {
    marker: BOT_CONFIG.panelMarkers.pricing,
    embeds: [headerEmbed, bodyEmbed],
    components: [createPricingSelectRow(), createPricingEntryButtonRow()],
    files,
  };
}

// ============================================================================
// 4. PAINEL DE AVALIAÇÕES (#✍️・avaliar)
// ============================================================================

export function buildReviewPromptEmbed(): EmbedBuilder {
  return withMarkerFooter(
    createStudioEmbed('secondary')
      .setThumbnail(getBrandAttachmentUrl('animatedEmblem'))
      .setImage(getBrandAttachmentUrl('divider'))
      .setTitle('Mural de Reputação & Feedback de Clientes')
      .setDescription(
        [
          `> ${em('crown')} **Recebeu sua encomenda no LWX Lab? Sua avaliação constrói nossa vitrine oficial!**`,
          `> Escolha sua nota com **1 clique** nos botões abaixo para abrir o formulário já preenchido e publicar seu depoimento em <#${BOT_CONFIG.channels.reviews}>.`,
        ].join('\n'),
      )
      .addFields(
        {
          name: `${em('crown')} Nota em 1 Clique`,
          value: 'Clique direto em **5★**, **4★** ou **3★** para abrir o formulário com a nota selecionada.',
          inline: true,
        },
        {
          name: `${em('palette')} Projeto & Serviço`,
          value: 'Informe qual arte, banner, logo ou pack visual foi desenvolvido para você.',
          inline: true,
        },
        {
          name: `${em('verify')} Publicação Oficial`,
          value: `Seu depoimento recebe selo verificado e vai direto para <#${BOT_CONFIG.channels.reviews}>.`,
          inline: true,
        },
      ),
    BOT_CONFIG.panelMarkers.reviewPrompt,
  );
}

export function buildReviewPromptPanelMessage(): FixedPanelPayload {
  const { headerEmbed, files } = createDoubleBannerEmbeds('reviews', 'secondary');
  const bodyEmbed = buildReviewPromptEmbed();

  return {
    marker: BOT_CONFIG.panelMarkers.reviewPrompt,
    embeds: [headerEmbed, bodyEmbed],
    components: [createReviewPromptButtonRow()],
    files,
  };
}

// ============================================================================
// 5. PAINEL DE ORÇAMENTOS, PALETA & RASTREADOR (#🎫・fazer-orçamento)
// ============================================================================

export function buildBudgetPanelEmbed(): EmbedBuilder {
  return withMarkerFooter(
    createStudioEmbed('scarf')
      .setThumbnail(getBrandAttachmentUrl('animatedEmblem'))
      .setImage(getBrandAttachmentUrl('divider'))
      .setTitle('Central de Orçamentos, Paletas & Rastreio de Pedidos')
      .setDescription(
        [
          `> ${em('ticket')} **Transforme sua ideia em um projeto visual único com direção de arte dedicada.**`,
          '> Escolha um **atalho rápido por categoria** na primeira fileira ou utilize as **ferramentas de apoio** (Simulador de Valor, Gerador de Paleta e Rastreador de Pedido) logo abaixo.',
        ].join('\n'),
      )
      .addFields(
        {
          name: `${em('ticket')} 1. Briefing Rápido`,
          value: [
            'Use o botão geral ou clique direto em **Banner**, **Ilustração** ou **Logo/Pack**.',
            '-# Sala privada criada na hora',
          ].join('\n'),
          inline: true,
        },
        {
          name: `${em('palette')} 2. Direção & Rastreio`,
          value: [
            'Alinhamento direto com **Llewxam**, envio de esboços e revisões guiadas.',
            '-# Acompanhe em tempo real no botão Rastrear Meu Pedido',
          ].join('\n'),
          inline: true,
        },
        {
          name: `${em('verify')} 3. Entrega Master`,
          value: [
            'Arquivos finais exportados em alta definição prontos para uso imediato.',
            '-# Qualidade máxima sem compressão',
          ].join('\n'),
          inline: true,
        },
      ),
    BOT_CONFIG.panelMarkers.budget,
  );
}

export function buildBudgetPanelMessage(): FixedPanelPayload {
  const { headerEmbed, files } = createDoubleBannerEmbeds('budget', 'scarf');
  const bodyEmbed = buildBudgetPanelEmbed();

  return {
    marker: BOT_CONFIG.panelMarkers.budget,
    embeds: [headerEmbed, bodyEmbed],
    components: [createBudgetButtonRow(), createBudgetUtilityRow()],
    files,
  };
}

// ============================================================================
// 6. PAINEL DE DIRETRIZES & TERMOS REFEITO (#📜・regras-e-termos)
// ============================================================================

export function buildRulesPanelEmbed(): EmbedBuilder {
  return withMarkerFooter(
    createStudioEmbed('scarf')
      .setThumbnail(getBrandAttachmentUrl('animatedEmblem'))
      .setImage(getBrandAttachmentUrl('divider'))
      .setTitle('Código de Conduta & Termos Oficiais • LWX Lab')
      .setDescription(
        [
          `> ${em('knight')} **Bem-vindo às diretrizes oficiais do estúdio LWX Lab, dirigido por Llewxam.**`,
          '> Nosso objetivo é garantir um ambiente respeitoso para a comunidade e um processo de encomenda 100% transparente, ágil e seguro para cada cliente.',
          '',
          `### ${em('spark')} Pilares da Comunidade & Comissões`,
        ].join('\n'),
      )
      .addFields(
        {
          name: `${em('verify')} 01 • Convivência & Organização`,
          value: [
            '• **Respeito Acima de Tudo:** Trate membros, clientes e equipe com educação. Ofensas, preconceito ou assédio geram banimento imediato.',
            '• **Zero Spam ou Divulgação:** É proibido flood, correntes, links suspeitos ou divulgação de terceiros em canais públicos ou DMs.',
            '• **Foco por Canal:** Use os canais de painéis para interagir com as ferramentas do bot e os canais de comunidade para conversar.',
          ].join('\n'),
          inline: false,
        },
        {
          name: `${em('ticket')} 02 • Atendimento & Orçamentos`,
          value: [
            `• **Exclusividade via Ticket:** Toda negociação, envio de referências e orçamento acontece em sala privada aberta em <#${BOT_CONFIG.channels.budget}>.`,
            '• **Briefing Claro:** Quanto mais detalhes você informar (ou lapidar com a **Silia AI**), mais rápido e certeiro será o primeiro esboço.',
          ].join('\n'),
          inline: false,
        },
        {
          name: `${em('flame')} 03 • Prazos, Revisões & Pagamento`,
          value: [
            '• **Cronograma Ágil:** O prazo combinado passa a valer a partir da confirmação do pedido no ticket.',
            '• **Prévias & Ajustes:** Você acompanha o progresso (Esboço → Render → Revisão) e conta com rodadas de ajustes dentro do escopo aprovado.',
            '• **Alteração de Escopo:** Mudanças completas de ideia após aprovação do esboço podem gerar ajuste proporcional de prazo ou valor.',
          ].join('\n'),
          inline: false,
        },
        {
          name: `${em('crown')} 04 • Entrega Master & Direitos de Uso`,
          value: [
            '• **Arquivos Finais:** Entregues em máxima resolução (PNG/JPG/GIF ou código-fonte conforme o serviço contratado).',
            '• **Vitrine Oficial:** O cliente recebe licença de uso da peça, e o estúdio **LWX Lab** pode exibir a obra em seu portfólio (salvo pedidos confidenciais combinados antes).',
          ].join('\n'),
          inline: false,
        },
      ),
    BOT_CONFIG.panelMarkers.rules,
  );
}

export function buildRulesPanelMessage(): FixedPanelPayload {
  const { headerEmbed, files } = createDoubleBannerEmbeds('rules', 'scarf');
  const bodyEmbed = buildRulesPanelEmbed();

  return {
    marker: BOT_CONFIG.panelMarkers.rules,
    embeds: [headerEmbed, bodyEmbed],
    components: [createRulesButtonRow()],
    files,
  };
}

// ============================================================================
// 7. PAINEL FIXO DE BOAS-VINDAS (#👋・boas-vindas)
// ============================================================================

export function buildWelcomeFixedPanelEmbed(): EmbedBuilder {
  return withMarkerFooter(
    createStudioEmbed('primary')
      .setThumbnail(getBrandAttachmentUrl('animatedEmblem'))
      .setImage(getBrandAttachmentUrl('divider'))
      .setTitle('Hall de Entrada & Recepção • LWX Lab')
      .setDescription(
        [
          `> ${em('knight')} **Seja muito bem-vindo(a) ao servidor oficial de Design & Criação Visual de Llewxam!**`,
          '> Aqui cada novo membro recebe sua saudação oficial ao entrar no estúdio. Utilize os atalhos abaixo para navegar diretamente pelas nossas galerias e ferramentas:',
        ].join('\n'),
      )
      .addFields(
        {
          name: `${em('verify')} 1. Registre-se`,
          value: `Ative sua credencial em <#${BOT_CONFIG.channels.register}> para liberar todo o servidor.`,
          inline: true,
        },
        {
          name: `${em('palette')} 2. Acervo & Preços`,
          value: `Explore <#${BOT_CONFIG.channels.portfolio}> e veja nossos novos valores em <#${BOT_CONFIG.channels.pricing}>.`,
          inline: true,
        },
        {
          name: `${em('silia')} 3. Silia AI & Pedidos`,
          value: `Refine sua ideia com a **Silia AI** ou abra seu ticket em <#${BOT_CONFIG.channels.budget}>.`,
          inline: true,
        },
      ),
    BOT_CONFIG.panelMarkers.welcome,
  );
}

export function buildWelcomeFixedPanelMessage(): FixedPanelPayload {
  const { headerEmbed, files } = createDoubleBannerEmbeds('welcome', 'primary');
  const bodyEmbed = buildWelcomeFixedPanelEmbed();

  return {
    marker: BOT_CONFIG.panelMarkers.welcome,
    embeds: [headerEmbed, bodyEmbed],
    components: [createWelcomeOnboardingRow()],
    files,
  };
}

// ============================================================================
// 8. PAINEL EXCLUSIVO DA SILIA AI (#🤖・silia-ai)
// ============================================================================

export function buildSiliaPanelEmbed(): EmbedBuilder {
  return withMarkerFooter(
    createSiliaEmbed('primary')
      .setTitle('Silia AI • Assistente Criativa & Consultora de Ideias')
      .setDescription(
        [
          `> ${em('silia')} **Olá! Eu sou a Silia AI, a inteligência artificial oficial do estúdio LWX Lab!** *(piscadinha dourada ✨)*`,
          '> Escolha um dos dois modos nos botões abaixo. **Ao apertar em um dos botões, você abre sua conversa privada comigo e qualquer mensagem enviada neste canal será respondida por mim!**',
          '',
          `### ${em('spark')} Escolha como quer interagir comigo`,
        ].join('\n'),
      )
      .addFields(
        {
          name: `${em('silia')} 1. Conversar com a Silia AI`,
          value: [
            'Bata um papo livre comigo sobre criatividade, jogos, arte, curiosidades ou tire dúvidas rápidas sobre o funcionamento do **LWX Lab**.',
            '-# Modo de conversa descontraída e livre',
          ].join('\n'),
          inline: true,
        },
        {
          name: `${em('palette')} 2. Aprimorar Ideia com Silia AI`,
          value: [
            'Tem uma ideia de banner, logo, ilustração ou pack mas não sabe como explicar? Eu ajudo você a escolher **cores, estilo e monto o briefing pronto** para o **Llewxam**!',
            '-# Ideal antes de abrir seu orçamento',
          ].join('\n'),
          inline: true,
        },
      ),
    BOT_CONFIG.panelMarkers.silia,
    'siliaAvatar',
  );
}

export function buildSiliaPanelMessage(): FixedPanelPayload {
  const { headerEmbed, files } = createDoubleBannerEmbeds('silia', 'primary');
  const bodyEmbed = buildSiliaPanelEmbed();

  return {
    marker: BOT_CONFIG.panelMarkers.silia,
    embeds: [headerEmbed, bodyEmbed],
    components: [createSiliaPanelButtonRow()],
    files,
  };
}
