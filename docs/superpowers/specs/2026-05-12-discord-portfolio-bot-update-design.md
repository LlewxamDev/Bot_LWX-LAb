# Discord Portfolio Bot Update Design

## Goal

Refine the LWX Lab Discord bot so portfolio categories are accurate, pricing includes bot services and a complete package, tickets support text/call workflows with Support ownership, registration gates access, and deployment guidance targets an always-on free host instead of Vercel serverless.

## Portfolio

The portfolio browser keeps private ephemeral responses and uses local assets only for visual work. Categories become `all`, `banners`, `logos`, `illustrations`, `packs`, `uiux`, and `sites`.

Assignments:

- `banners`: `design-03`, `design-04`, `design-06`.
- `logos`: `design-09`.
- `illustrations`: `design-01`, `design-02`, `design-05`, `design-07`, `design-08`, `design-11`.
- `packs`: `design-10`.
- `uiux`: empty state, displayed as in production.
- `sites`: empty state, displayed as in production, because no GitHub repository currently exposes a deployed site URL in metadata.

## Pricing

Pricing keeps the current select-driven private browser and adds:

- `bot_discord`, priced below WhatsApp bot.
- `bot_whatsapp`, priced above Discord bot because of API/integration complexity.
- `complete_custom`, the highest-priced package, covering site, bot, design, identity, and Discord server setup.

## Tickets

The ticket entry button opens a private mode chooser. Text mode creates a private text ticket immediately. Call mode creates a text ticket and marks the call request as pending; Support is mentioned and can accept or decline. Accepting creates a private voice channel with the same participant permissions. Declining switches the ticket to text and tells the client that call service is unavailable at the moment.

Support-only controls use role `1441752196797435944`. `Assumir ticket` stores the assignee and updates the button label with a shortened staff display name. A finalization button appears after the claim. Finalization sends the review flow inside the ticket. Once the client submits the review, the public review is posted and the ticket text/voice channels are scheduled for deletion.

## Registration

The registration panel is pinned in channel `1493076622448791572`. The bot ensures two roles exist by name: `Cliente` and `Avisos LWX`. Known bot channels are gated by denying `@everyone` and allowing `Cliente`, while the register and welcome channels remain visible. Registration uses a modal for required profile questions and then asks whether the user wants announcement notifications.

## Deployment

The bot is a long-running Discord Gateway process. Vercel serverless is not the recommended target for the full bot. The project will include a Dockerfile and deployment notes for Northflank free deployment, which is a better fit because it supports always-on services.

## Testing

Tests cover portfolio category accuracy and empty states, pricing ordering, registration config/panels, ticket helper payloads, and runtime state shape. TypeScript compilation remains a required final verification.
