import { describe, expect, it } from 'vitest';
import { BOT_CONFIG } from '../src/config/botConfig.js';
import { portfolioCategories, portfolioItems } from '../src/data/portfolio.js';
import { pricingServices } from '../src/data/pricing.js';

describe('LWX Lab Knight-Style Config & Studio Data', () => {
  it('uses the official Knight Logo color palette (design-09.jpg)', () => {
    expect(BOT_CONFIG.brand.palette.primary).toBe(0x8B5CF6);
    expect(BOT_CONFIG.brand.palette.secondary).toBe(0x52B7FF);
    expect(BOT_CONFIG.brand.palette.accent).toBe(0xA87FFB);
    expect(BOT_CONFIG.brand.palette.scarf).toBe(0xD6456B);
  });

  it('contains all fixed channel IDs for LWX Lab BR', () => {
    expect(BOT_CONFIG.channels.register).toBe('1493076622448791572');
    expect(BOT_CONFIG.channels.portfolio).toBe('1493077024422625531');
    expect(BOT_CONFIG.channels.pricing).toBe('1493077221550723072');
    expect(BOT_CONFIG.channels.reviews).toBe('1493077433677512774');
    expect(BOT_CONFIG.channels.reviewPrompt).toBe('1503563707328757925');
    expect(BOT_CONFIG.channels.budget).toBe('1493077618281550015');
    expect(BOT_CONFIG.channels.welcome).toBe('1493076394916188180');
    expect(BOT_CONFIG.channels.rules).toBe('1441618607212855379');
  });

  it('maps portfolio categories to pure unframed local portfolio assets', () => {
    expect(portfolioCategories.map((c) => c.id)).toEqual([
      'all',
      'banners',
      'logos',
      'illustrations',
      'packs',
      'uiux',
      'sites',
    ]);
    expect(portfolioItems.length).toBe(11);
    expect(portfolioItems.every((item) => item.assetPath.startsWith('assets/portfolio/design-'))).toBe(true);
    expect(portfolioItems.some((item) => 'showcasePath' in item)).toBe(false);
  });

  it('has accessible market-entry pricing for every studio service', () => {
    expect(pricingServices.length).toBe(11);
    const banner = pricingServices.find((s) => s.id === 'banner');
    const divider = pricingServices.find((s) => s.id === 'divider');
    const logo = pricingServices.find((s) => s.id === 'logo');
    expect(banner?.priceLabel).toBe('A partir de R$ 20');
    expect(divider?.priceLabel).toBe('A partir de R$ 10');
    expect(logo?.priceLabel).toBe('A partir de R$ 30');
  });
});
