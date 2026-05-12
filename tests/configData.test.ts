import { describe, expect, it } from 'vitest';
import { ACCESS_CONTROL, CHANNEL_IDS, ROLE_CONFIG, THEME, TIMING } from '../src/config/botConfig';
import { portfolioCategories, portfolioItems } from '../src/data/portfolio';
import { pricingServices } from '../src/data/pricing';
import { welcomeFacts } from '../src/data/welcomeFacts';

function priceValue(price: string) {
  return Number(price.replace(/[^0-9]/g, ''));
}

describe('bot config and data', () => {
  it('contains all fixed channel ids from the approved spec', () => {
    expect(CHANNEL_IDS).toEqual({
      welcome: '1493076394916188180',
      register: '1493076622448791572',
      portfolio: '1493077024422625531',
      pricing: '1493077221550723072',
      publicReviews: '1493077433677512774',
      reviewPrompt: '1503563707328757925',
      budget: '1493077618281550015',
    });
    expect(THEME.accent).toBe(0xff243d);
    expect(TIMING.shortNoticeMs).toBeGreaterThanOrEqual(4000);
  });

  it('defines registration roles and protected bot channels', () => {
    expect(ROLE_CONFIG.supportRoleId).toBe('1441752196797435944');
    expect(ROLE_CONFIG.clientRoleName).toBe('Cliente');
    expect(ROLE_CONFIG.announcementsRoleName).toBe('Avisos LWX');
    expect(ACCESS_CONTROL.protectedChannelIds).toEqual([
      CHANNEL_IDS.portfolio,
      CHANNEL_IDS.pricing,
      CHANNEL_IDS.publicReviews,
      CHANNEL_IDS.reviewPrompt,
      CHANNEL_IDS.budget,
    ]);
  });

  it('has a pricing entry for every expected service', () => {
    expect(pricingServices.map((service) => service.id)).toEqual([
      'banner',
      'logo',
      'divider',
      'illustration',
      'uiux',
      'site_one_page',
      'site_complete',
      'server_pack',
      'bot_discord',
      'bot_whatsapp',
      'complete_custom',
    ]);

    const byId = new Map(pricingServices.map((service) => [service.id, service]));
    const discordBot = byId.get('bot_discord')!;
    const whatsappBot = byId.get('bot_whatsapp')!;
    const completeCustom = byId.get('complete_custom')!;
    expect(priceValue(whatsappBot.basePrice)).toBeGreaterThan(priceValue(discordBot.basePrice));
    expect(priceValue(completeCustom.basePrice)).toBe(Math.max(...pricingServices.map((service) => priceValue(service.basePrice))));
  });

  it('maps portfolio categories to exact local portfolio entries', () => {
    expect(portfolioCategories.map((category) => category.id)).toEqual([
      'all',
      'banners',
      'logos',
      'illustrations',
      'packs',
      'uiux',
      'sites',
    ]);
    expect(portfolioItems.length).toBe(11);
    expect(portfolioItems.every((item) => item.assetPath.startsWith('assets/portfolio/'))).toBe(true);
    expect(portfolioItems.filter((item) => item.category === 'banners').map((item) => item.id)).toEqual([
      'design-03',
      'design-04',
      'design-06',
    ]);
    expect(portfolioItems.filter((item) => item.category === 'logos').map((item) => item.id)).toEqual(['design-09']);
    expect(portfolioItems.filter((item) => item.category === 'packs').map((item) => item.id)).toEqual(['design-10']);
    expect(portfolioItems.filter((item) => item.category === 'uiux')).toEqual([]);
  });

  it('includes welcome facts', () => {
    expect(welcomeFacts.length).toBeGreaterThanOrEqual(8);
  });
});
