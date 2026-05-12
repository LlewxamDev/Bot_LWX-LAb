# Discord Portfolio Bot Design

## Status

Approved direction: local config/data files, fixed channel panels, red Terminal Lab visual style, and only one slash command for AI chat.

This workspace is not a Git repository, so the spec cannot be committed from here.

## Goals

Build the Discord bot around fixed panels in the server channels instead of public slash commands. The panels should feel like a red "Terminal Lab": black/dark embeds, red accent color, console-style titles, compact fields, and buttons/select menus.

The bot should:

- Show real portfolio work from `https://llewxam.netlify.app`.
- Show site/project work from `https://github.com/Lamarq7eYT`.
- Keep portfolio, pricing, review, and ticket interactions private to the user.
- Replace private content inside the same private interaction flow when the user changes category/service.
- Delete short private notices after a small delay where Discord allows it.
- Remove current `/portfolio` and `/orcamento` slash commands.
- Keep only one slash command for AI chat, plus optional mention/DM AI behavior.
- Send welcome messages in the welcome channel when members join.

## Channel Map

- Welcome: `1493076394916188180`
- Portfolio: `1493077024422625531`
- Pricing: `1493077221550723072`
- Public reviews: `1493077433677512774`
- Review prompt: `1503563707328757925`
- Budget/ticket prompt: `1493077618281550015`

## Discord Constraints

Discord embeds do not support custom CSS, custom fonts, or true pinned UI widgets. The design will use:

- Embed color `#ff243d`.
- Dark embed titles and descriptions with command-like text such as `> lwx.portfolio.open()`.
- Fields for compact data.
- Buttons and select menus for navigation.
- Attachments for local portfolio images.
- Message pinning when the bot has `Manage Messages`; otherwise the bot still keeps one persistent panel per channel by updating the saved message.

Ephemeral messages from old interactions cannot always be deleted later by a new interaction. To meet the "replace instead of stacking" behavior, the fixed public panel opens a private control surface first. Category/service changes then happen inside that same private message using component updates.

## Architecture

Add a small local data layer:

- `src/config/botConfig.ts`: channel IDs, color, timing, Discord labels, panel keys.
- `src/data/portfolio.ts`: portfolio categories and local asset paths extracted from the Netlify portfolio.
- `src/data/pricing.ts`: service names, base prices, delivery notes, revision notes, and ticket service IDs.
- `src/data/welcomeFacts.ts`: random welcome curiosities.
- `src/data/githubProjects.ts`: curated project/site entries from the GitHub profile.

Add reusable UI builders:

- `src/ui/embeds.ts`: Terminal Lab embed helpers.
- `src/ui/components.ts`: buttons, select menus, star rows, and ticket buttons.
- `src/ui/panels.ts`: fixed public panel builders for portfolio, pricing, reviews, and tickets.

Add interaction systems:

- `src/systems/panels.ts`: upsert fixed channel messages, save message IDs, and pin when possible.
- `src/systems/portfolio.ts`: private portfolio browser with category select and next/previous image controls.
- `src/systems/pricing.ts`: private pricing browser with service select and ticket call-to-action.
- `src/systems/reviews.ts`: review rating flow, feedback modal, and public review post.
- `src/systems/tickets.ts`: ticket channel creation and closing.
- `src/systems/welcome.ts`: member join welcome messages.
- `src/commands/ai.ts`: only slash command left in the command list.

Store runtime state in local JSON:

- `data/runtime/panels.json`: saved fixed panel message IDs.
- `data/runtime/tickets.json`: ticket owner, selected service, channel ID, status.

## Portfolio Flow

The bot posts one fixed panel in the portfolio channel. The panel has a red Terminal Lab embed and an "Abrir arquivo" button.

When a user clicks it, the bot replies ephemerally with a private portfolio browser:

- A category select with `Banners`, `Logos`, `UI/UX`, `Sites`, and `Todos`.
- A result embed for the selected category.
- For design categories, the embed attaches one local image preview and includes previous/next buttons.
- For sites, the embed lists curated GitHub projects with repo links and homepage links when available.
- Switching category or page updates the same private message.

Portfolio images come from the 11 embedded images found in the Netlify portfolio and are saved locally under `assets/portfolio/`.

## Pricing Flow

The bot posts one fixed panel in the pricing channel. The panel has a red Terminal Lab embed and an "Abrir tabela" button.

The private pricing browser includes a service select. Price suggestions:

- Banner: from R$ 55
- Logo: from R$ 90
- Barrinha/divisoria: from R$ 35
- Ilustracao simples: from R$ 120
- UI/UX screen: from R$ 160
- Site one-page: from R$ 350
- Site completo: from R$ 650
- Pacote servidor/marca: from R$ 220

Each service view shows:

- Base price.
- Best use case.
- What is included.
- Estimated delivery range.
- Revision guidance.
- Button to open a ticket with that service preselected.

## Review Flow

The bot posts one fixed panel in the review prompt channel. The public panel explains that reviews are public after submission and includes a "Avaliar" button.

The private review flow:

1. User clicks "Avaliar".
2. Bot sends an ephemeral rating message with five star buttons.
3. Clicking a star updates the same private message with filled and empty stars.
4. The private message shows a "Escrever feedback" button.
5. Clicking it opens a modal for feedback text.
6. On submit, the bot posts to the public reviews channel with stars on top and italic feedback below.
7. The bot confirms privately and deletes the confirmation after a short delay when possible.

## Ticket Flow

The bot posts one fixed panel in the budget channel. The panel has a red Terminal Lab embed and an "Abrir ticket" button.

When a user opens a ticket:

- Create a private text channel named from the user and service.
- Allow the user and bot. If `SUPPORT_ROLE_ID` is set in `.env`, allow that role too; otherwise server administrators can still enter through Discord's administrator override.
- Deny everyone else.
- Send a ticket intro embed with selected service context.
- Add a "Fechar ticket" button.
- On close, notify the ticket channel, remind the user to review in the review prompt channel, save state, and delete the channel after a delay.

## Welcome Flow

Add `GuildMembers` intent and handle `GuildMemberAdd`.

When a member joins:

- Send an embed to the welcome channel.
- Mention the user.
- Include account creation date, server member count, and one random curiosity from `welcomeFacts`.
- Use the red Terminal Lab style without making the message too long.

This requires the Server Members Intent enabled in the Discord Developer Portal.

## AI Flow

Replace current AI prompt with a lighter "fun and research" personality. The AI should:

- Be entertaining and useful, like a general chat assistant.
- Help users research, brainstorm, and ask casual questions.
- Avoid acting like a sales employee.
- Keep responses Discord-friendly and concise.
- Mention tickets only when users ask about commissions, prices, or hiring.

Register only `/ia` as a slash command. The command should accept a required text prompt and reply publicly by default so people can chat together. Existing mention/DM behavior can remain because it is not a slash command.

## Error Handling

- If a configured channel is missing, log the channel ID and continue booting.
- If pinning fails, log a warning and leave the panel unpinned.
- If an interaction expires or cannot be deleted, ignore the deletion error.
- If a portfolio image cannot load, show the text entry and a link to the public portfolio instead.
- If ticket creation fails, send a private error message with permission guidance.
- If AI providers fail, reply with a friendly temporary failure message.

## Testing

Use focused unit tests for pure builders and data behavior:

- Channel config contains all required IDs.
- Pricing data includes every service in the select menu.
- Portfolio categories map to entries.
- Review star rendering lights the expected number of stars.
- Panel upsert logic chooses update instead of duplicate when a saved message exists.
- AI command is the only slash command registered besides no legacy design commands.

Run TypeScript checks after implementation.
