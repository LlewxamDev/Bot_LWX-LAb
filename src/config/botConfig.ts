export const CHANNEL_IDS = {
  welcome: '1493076394916188180',
  register: '1493076622448791572',
  portfolio: '1493077024422625531',
  pricing: '1493077221550723072',
  publicReviews: '1493077433677512774',
  reviewPrompt: '1503563707328757925',
  budget: '1493077618281550015',
} as const;

export const ROLE_CONFIG = {
  supportRoleId: '1441752196797435944',
  clientRoleName: 'Cliente',
  announcementsRoleName: 'Avisos LWX',
} as const;

export const ACCESS_CONTROL = {
  protectedChannelIds: [
    CHANNEL_IDS.portfolio,
    CHANNEL_IDS.pricing,
    CHANNEL_IDS.publicReviews,
    CHANNEL_IDS.reviewPrompt,
    CHANNEL_IDS.budget,
  ],
  publicChannelIds: [CHANNEL_IDS.welcome, CHANNEL_IDS.register],
} as const;

export const PANEL_KEYS = {
  register: 'register',
  portfolio: 'portfolio',
  pricing: 'pricing',
  reviewPrompt: 'reviewPrompt',
  budget: 'budget',
} as const;

export const THEME = {
  accent: 0xff243d,
  danger: 0xb00020,
  neutral: 0x101010,
  footer: 'LWX Lab // Terminal mode',
} as const;

export const TIMING = {
  shortNoticeMs: 7000,
  ticketCloseMs: 5000,
} as const;
