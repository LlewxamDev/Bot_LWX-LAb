import { describe, expect, it } from 'vitest';
import { buildPortfolioBrowserPayload } from '../src/systems/portfolio';
import { getPanelDefinitions } from '../src/systems/panels';
import { buildPricingBrowserPayload } from '../src/systems/pricing';
import { buildTicketModePayload, buildTicketOverwriteTargets, createTicketState, shortenStaffName } from '../src/systems/tickets';
import { createDefaultRuntimeState } from '../src/storage/runtimeStore';

describe('runtime and panel definitions', () => {
  it('starts with empty panel and ticket state', () => {
    expect(createDefaultRuntimeState()).toEqual({ panels: {}, tickets: {} });
  });

  it('defines all fixed channel panels', () => {
    expect(getPanelDefinitions().map((panel) => panel.key)).toEqual([
      'register',
      'portfolio',
      'pricing',
      'reviewPrompt',
      'budget',
    ]);
  });
});

describe('private browser payloads', () => {
  it('builds a portfolio payload for image categories', () => {
    const payload = buildPortfolioBrowserPayload('banners', 0);

    expect(payload.embeds[0]!.toJSON().title).toBe('> query portfolio --category=banners');
    expect(payload.files?.[0]).toContain('assets/portfolio/');
    expect(payload.components.length).toBeGreaterThanOrEqual(2);
  });

  it('builds a site portfolio payload from GitHub projects', () => {
    const payload = buildPortfolioBrowserPayload('sites', 0);
    const json = payload.embeds[0]!.toJSON();

    expect(json.description).toContain('em producao');
    expect(json.fields).toBeUndefined();
    expect(payload.files).toBeUndefined();
  });

  it('builds empty production state for UI/UX while it has no exact asset', () => {
    const payload = buildPortfolioBrowserPayload('uiux', 0);
    const json = payload.embeds[0]!.toJSON();

    expect(json.description).toContain('em producao');
    expect(payload.files).toBeUndefined();
  });

  it('builds a pricing payload with ticket action', () => {
    const payload = buildPricingBrowserPayload('logo');

    expect(payload.embeds[0]!.toJSON().title).toBe('> inspect price --service=logo');
    expect(payload.components.length).toBe(2);
  });
});

describe('ticket payload helpers', () => {
  it('builds text/call chooser controls for a selected service', () => {
    const payload = buildTicketModePayload('bot_discord');
    const buttons = payload.components[0]!.toJSON().components;

    expect(buttons.map((button: any) => button.custom_id)).toEqual([
      'ticket:mode:text:bot_discord',
      'ticket:mode:call:bot_discord',
    ]);
  });

  it('shortens staff names for claimed ticket buttons', () => {
    expect(shortenStaffName('SuporteLWXGrandeDemais')).toBe('SuporteLWXGran...');
    expect(shortenStaffName('Llew')).toBe('Llew');
  });

  it('creates ticket state with service, mode and call status', () => {
    expect(createTicketState('123', 'bot_whatsapp', 'call')).toMatchObject({
      ownerId: '123',
      serviceId: 'bot_whatsapp',
      mode: 'call',
      callStatus: 'pending',
      status: 'open',
    });
  });

  it('builds ticket permission targets around the owner instead of the staff clicker', () => {
    expect(buildTicketOverwriteTargets('client-123', 'bot-456', 'everyone-789')).toEqual({
      everyoneId: 'everyone-789',
      ownerId: 'client-123',
      botId: 'bot-456',
      supportRoleId: '1441752196797435944',
    });
  });
});
