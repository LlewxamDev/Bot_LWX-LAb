import { describe, expect, it } from 'vitest';
import { buildPublishedReviewEmbed, formatStars } from '../src/systems/reviews.js';
import {
  createBudgetButtonRow,
  createBudgetUtilityRow,
  createPortfolioEntryButtonRow,
  createPricingEntryButtonRow,
  createRegisterButtonRow,
  createReviewPromptButtonRow,
  createRulesButtonRow,
  createSiliaPanelButtonRow,
} from '../src/ui/components.js';
import { buildProgressBar, createSiliaEmbed, createStudioEmbed } from '../src/ui/embeds.js';
import {
  buildBudgetPanelMessage,
  buildPortfolioPanelMessage,
  buildPricingPanelMessage,
  buildRegisterPanelMessage,
  buildReviewPromptPanelMessage,
  buildRulesPanelMessage,
  buildSiliaPanelMessage,
  buildWelcomeFixedPanelMessage,
} from '../src/ui/panels.js';

describe('Knight-Style Luxury UI Builders & Animated GIF Panels', () => {
  it('creates clean studio and Silia AI embeds without terminal ansi blocks', () => {
    const json = createStudioEmbed('primary').setTitle('Teste').toJSON();
    expect(json.color).toBe(0x8B5CF6);
    expect(json.author?.name).toContain('LWX Lab');
    expect(json.description ?? '').not.toContain('```ansi');

    const siliaJson = createSiliaEmbed('primary').setTitle('Silia').toJSON();
    expect(siliaJson.author?.name).toContain('Silia AI');
    expect(siliaJson.thumbnail?.url).toBe('attachment://silia-emblem.gif');
  });

  it('builds Double-Embed fixed panels with animated GIF banners and divider for all channels', () => {
    const portfolioPanel = buildPortfolioPanelMessage();
    expect(portfolioPanel.embeds.length).toBe(2);
    expect(portfolioPanel.embeds[0]?.toJSON().image?.url).toBe('attachment://banner-portfolio.gif');
    expect(portfolioPanel.embeds[1]?.toJSON().image?.url).toBe('attachment://divider-glitch.gif');

    const registerPanel = buildRegisterPanelMessage();
    expect(registerPanel.embeds.length).toBe(2);
    expect(registerPanel.embeds[0]?.toJSON().image?.url).toBe('attachment://banner-register.gif');

    const pricingPanel = buildPricingPanelMessage();
    expect(pricingPanel.embeds.length).toBe(2);
    expect(pricingPanel.embeds[0]?.toJSON().image?.url).toBe('attachment://banner-pricing.gif');

    const budgetPanel = buildBudgetPanelMessage();
    expect(budgetPanel.embeds.length).toBe(2);
    expect(budgetPanel.components.length).toBe(2);

    const reviewPanel = buildReviewPromptPanelMessage();
    expect(reviewPanel.embeds.length).toBe(2);

    const rulesPanel = buildRulesPanelMessage();
    expect(rulesPanel.embeds.length).toBe(2);
    expect(rulesPanel.components.length).toBe(1);

    const welcomePanel = buildWelcomeFixedPanelMessage();
    expect(welcomePanel.embeds.length).toBe(2);
    expect(welcomePanel.embeds[0]?.toJSON().image?.url).toBe('attachment://banner-welcome.gif');

    const siliaPanel = buildSiliaPanelMessage();
    expect(siliaPanel.embeds.length).toBe(2);
    expect(siliaPanel.embeds[0]?.toJSON().image?.url).toBe('attachment://banner-silia.gif');
    expect(siliaPanel.embeds[1]?.toJSON().thumbnail?.url).toBe('attachment://silia-emblem.gif');
  });

  it('builds multi-button action bars for all studio panels including Silia AI and Rules', () => {
    expect(createRegisterButtonRow().components.length).toBe(4);
    expect(createPortfolioEntryButtonRow().components.length).toBe(4);
    expect(createPricingEntryButtonRow().components.length).toBe(3);
    expect(createBudgetButtonRow().components.length).toBe(4);
    expect(createBudgetUtilityRow().components.length).toBe(4);
    expect(createReviewPromptButtonRow().components.length).toBe(4);
    expect(createRulesButtonRow().components.length).toBe(4);
    expect(createSiliaPanelButtonRow().components.length).toBe(2);
  });

  it('renders star ratings and progress bars cleanly', () => {
    expect(formatStars(5)).toContain('⭐⭐⭐⭐⭐');
    expect(buildProgressBar(3, 5, 10)).toContain('60%');
  });

  it('builds published review embed without terminal codeblocks', () => {
    const embed = buildPublishedReviewEmbed('Cliente#0001', '123456', null, {
      stars: 5,
      service: 'Banner HD',
      comment: 'Arte incrível e entrega super rápida!',
    }).toJSON();

    expect(embed.description).toContain('Arte incrível e entrega super rápida!');
    expect(embed.description).not.toContain('```');
  });
});
