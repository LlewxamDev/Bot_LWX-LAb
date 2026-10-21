import { describe, expect, it } from 'vitest';
import { buildOrderCardEmbed } from '../src/systems/orders.js';
import { buildPaletteGeneratorMessage } from '../src/systems/palette.js';
import { buildPortfolioViewState } from '../src/systems/portfolio.js';
import { buildPricingComboEmbed, buildPricingDetailEmbed, getServiceById } from '../src/systems/pricing.js';
import { sanitizeTicketChannelName } from '../src/systems/tickets.js';

describe('Interactive Systems: Portfolio, Pricing Combo, Palette & Order Tracker', () => {
  it('builds unframed portfolio view states for each category', () => {
    const state = buildPortfolioViewState('banners', 0);
    expect(state.currentItem?.id).toBe('design-03');
    expect(state.embed.toJSON().image?.url).toBe('attachment://design-03.jpg');
    expect(state.components.length).toBe(3);
  });

  it('calculates 10% combo discount when 2 or more services are selected', () => {
    const single = buildPricingComboEmbed(['banner']).toJSON();
    expect(single.description).not.toContain('Bônus de Pacote Ativo');

    const combo = buildPricingComboEmbed(['banner', 'logo']).toJSON();
    expect(combo.description).toContain('Bônus de Pacote Ativo');
  });

  it('builds service detail embeds cleanly', () => {
    const logo = getServiceById('logo');
    const embed = buildPricingDetailEmbed(logo).toJSON();
    expect(embed.title).toContain(logo.name);
  });

  it('generates live palette card buffer and embed', () => {
    const pal = buildPaletteGeneratorMessage(0);
    expect(pal.palette.id).toBe('knight_glitch');
    expect(pal.files.length).toBeGreaterThanOrEqual(1);
  });

  it('builds visual order tracker card with progress bar', () => {
    const card = buildOrderCardEmbed({
      id: 'LWX-101',
      clientId: '12345',
      clientTag: 'Cliente#0001',
      service: 'Banner HD',
      deadline: '48h',
      stage: 'render',
      note: 'Aplicando iluminação azul e hachuras.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).toJSON();

    expect(card.title).toContain('#LWX-101');
    expect(card.description).toContain('60%');
  });

  it('sanitizes ticket channel names', () => {
    expect(sanitizeTicketChannelName('Llewxam Dev!', '123456789')).toBe('pedido-llewxam-dev-6789');
  });
});
