import { describe, expect, it } from 'vitest';
import { data as aiCommandData } from '../src/commands/ai';
import { buildPublicReviewPayload } from '../src/systems/reviews';
import { buildPortfolioCategorySelect, buildStarButtons, buildTicketClaimRow, buildTicketModeButtons } from '../src/ui/components';
import { buildTerminalEmbed, renderStars } from '../src/ui/embeds';
import { buildBudgetPanel, buildPortfolioPanel, buildPricingPanel, buildRegistrationPanel } from '../src/ui/panels';

describe('Terminal Lab UI builders', () => {
  it('builds red terminal embeds', () => {
    const json = buildTerminalEmbed({
      command: 'lwx.test()',
      title: 'Teste',
      description: 'Descricao',
    }).toJSON();

    expect(json.color).toBe(0xff243d);
    expect(json.title).toBe('> lwx.test()');
    expect(json.description).toContain('**Teste**');
  });

  it('renders filled and empty stars', () => {
    expect(renderStars(3)).toBe('★ ★ ★ ☆ ☆');
    expect(renderStars(5)).toBe('★ ★ ★ ★ ★');
  });

  it('builds portfolio and star controls with stable custom ids', () => {
    const portfolioRow = buildPortfolioCategorySelect('all').toJSON();
    const starRow = buildStarButtons(3).toJSON();

    expect(portfolioRow.components[0]!.custom_id).toBe('portfolio:category');
    expect(starRow.components.map((button) => (button as any).custom_id)).toEqual([
      'review:rate:1',
      'review:rate:2',
      'review:rate:3',
      'review:rate:4',
      'review:rate:5',
    ]);
  });

  it('builds fixed panel payloads', () => {
    expect(buildPortfolioPanel().embeds[0]!.toJSON().title).toBe('> lwx.portfolio.open()');
    expect(buildRegistrationPanel().embeds[0]!.toJSON().title).toBe('> lwx.register.start()');
    expect((buildBudgetPanel().components[0]!.toJSON().components[0]! as any).custom_id).toBe('ticket:start:custom');
    expect(buildPricingPanel().components.length).toBeGreaterThan(0);
  });

  it('builds ticket mode and claim controls', () => {
    const modeRow = buildTicketModeButtons('site_complete').toJSON();
    const claimRow = buildTicketClaimRow('SuporteLWXGrandeDemais').toJSON();

    expect(modeRow.components.map((button: any) => button.custom_id)).toEqual([
      'ticket:mode:text:site_complete',
      'ticket:mode:call:site_complete',
    ]);
    expect((claimRow.components[0]! as any).label).toContain('SuporteLWXGran...');
    expect((claimRow.components[0]! as any).disabled).toBe(true);
  });
});

describe('reviews and AI command', () => {
  it('builds public review payload with italic feedback', () => {
    const payload = buildPublicReviewPayload('123', 4, 'Atendimento muito bom');
    const json = payload.embeds[0]!.toJSON();

    expect(json.description).toContain('★ ★ ★ ★ ☆');
    expect(json.description).toContain('*Atendimento muito bom*');
  });

  it('defines /ia as the only intended slash command', () => {
    const json = aiCommandData.toJSON();

    expect(json.name).toBe('ia');
    expect(json.options?.[0]!.name).toBe('mensagem');
  });
});
