export const BOT_CONFIG = {
  brand: {
    name: 'LWX Lab',
    signature: 'Llewxam • LWX Lab Design Studio',
    tagline: 'Direção de Arte • Identidade Visual • Ilustração & Projetos Digitais',
    footer: 'LWX Lab • Estúdio Oficial por Llewxam',
    palette: {
      // Exact Palette extracted from the Official Bot Logo (design-09.jpg — Purple Glitch Knight & Soul Flames)
      primary: 0x8B5CF6,   // #8B5CF6 - Royal Violet (Knight Armor)
      secondary: 0x52B7FF, // #52B7FF - Soul-Fire Cyan (Blue Flames)
      accent: 0xA87FFB,    // #A87FFB - Pixel Lavender (Llewxam Logo Title)
      scarf: 0xD6456B,     // #D6456B - Crimson-Rose Scarf
      obsidian: 0x161024,  // #161024 - Dark CRT Scanline Void
      iceBlue: 0xC4EBFF,   // #C4EBFF - Inner Flame Core
      success: 0x52B7FF,   // #52B7FF - Soul-Fire Cyan
      warning: 0xA87FFB,   // #A87FFB - Electric Lavender
      danger: 0xD6456B,    // #D6456B - Crimson-Rose Scarf
      star: 0x8B5CF6,      // #8B5CF6 - Royal Violet Star
    },
  },
  channels: {
    register: '1493076622448791572',
    portfolio: '1493077024422625531',
    pricing: '1493077221550723072',
    reviews: '1493077433677512774',
    reviewPrompt: '1503563707328757925',
    budget: '1493077618281550015',
    welcome: '1493076394916188180',
    rules: '1441618607212855379',
    announcements: '1493076740422111415',
    siliaAi: '1562178799641297088',
  },
  categories: {
    tickets: '1493077500660809810',
  },
  roles: {
    verified: '1493075161677561876',
    staff: '1441752196797435944',
    avisos: '1503766741031981139',
    notificacoes: '1493075002440810506',
  },
  customIds: {
    registerVerify: 'lwx:register:verify',
    registerAvisos: 'lwx:register:role_avisos',
    registerEventos: 'lwx:register:role_eventos',
    registerProfile: 'lwx:register:profile',

    rulesAccept: 'lwx:rules:accept',
    rulesFaq: 'lwx:rules:faq',

    portfolioOpen: 'lwx:portfolio:open',
    portfolioCatAll: 'lwx:portfolio:cat_all',
    portfolioCatBanners: 'lwx:portfolio:cat_banners',
    portfolioCatArt: 'lwx:portfolio:cat_art',
    portfolioCatBrand: 'lwx:portfolio:cat_brand',
    portfolioPrev: 'lwx:portfolio:prev',
    portfolioNext: 'lwx:portfolio:next',
    portfolioCategory: 'lwx:portfolio:category',
    portfolioJump: 'lwx:portfolio:jump',
    portfolioOrderThis: 'lwx:portfolio:order_this',

    pricingOpen: 'lwx:pricing:open',
    pricingSelect: 'lwx:pricing:select',
    pricingComboOpen: 'lwx:pricing:combo_open',
    pricingComboSelect: 'lwx:pricing:combo_select',

    reviewOpenModal: 'lwx:review:open_modal',
    reviewStar5: 'lwx:review:star_5',
    reviewStar4: 'lwx:review:star_4',
    reviewStar3: 'lwx:review:star_3',
    reviewModal: 'lwx:review:modal',

    budgetOpenModal: 'lwx:budget:open_modal',
    budgetQuickBanner: 'lwx:budget:quick_banner',
    budgetQuickArt: 'lwx:budget:quick_art',
    budgetQuickBrand: 'lwx:budget:quick_brand',
    budgetPaletteGen: 'lwx:budget:palette_gen',
    budgetModal: 'lwx:budget:modal',

    orderTrackOpen: 'lwx:order:track_open',
    orderStageSelect: 'lwx:order:stage_select',

    ticketClose: 'lwx:ticket:close',
    ticketClaim: 'lwx:ticket:claim',

    paletteReroll: 'lwx:palette:reroll',
    paletteUseInOrder: 'lwx:palette:use_order',

    siliaChat: 'lwx:silia:chat',
    siliaIdeate: 'lwx:silia:ideate',
    siliaToBriefing: 'lwx:silia:to_briefing',
    siliaClear: 'lwx:silia:clear',
    siliaProposalApprove: 'lwx:silia:proposal_approve',
    siliaProposalReject: 'lwx:silia:proposal_reject',
    siliaDiagFocus: 'lwx:silia:diag_focus',
    siliaContinueChat: 'lwx:silia:continue_chat',
    siliaFinalizeClose: 'lwx:silia:finalize_close',
  },
  panelMarkers: {
    register: 'LWX_PANEL_REGISTER_V1',
    portfolio: 'LWX_PANEL_PORTFOLIO_V1',
    pricing: 'LWX_PANEL_PRICING_V1',
    reviewPrompt: 'LWX_PANEL_REVIEW_PROMPT_V1',
    budget: 'LWX_PANEL_BUDGET_V1',
    rules: 'LWX_PANEL_RULES_V1',
    welcome: 'LWX_PANEL_WELCOME_V1',
    silia: 'LWX_PANEL_SILIA_V1',
  },
} as const;
