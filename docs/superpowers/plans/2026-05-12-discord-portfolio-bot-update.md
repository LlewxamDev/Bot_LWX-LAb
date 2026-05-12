# Discord Portfolio Bot Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved portfolio, pricing, ticket, registration, and deployment updates for the LWX Lab Discord bot.

**Architecture:** Keep data-driven Discord builders and isolate new behavior into focused systems. Add registration/access setup in a new module, extend ticket state with mode/assignee/review lifecycle, and reuse the existing review flow with a ticket context.

**Tech Stack:** TypeScript, discord.js v14, Vitest, local JSON runtime state, Docker for deployment packaging.

---

### Task 1: Tests For Updated Data And Panels

**Files:**
- Modify: `tests/configData.test.ts`
- Modify: `tests/interactionPayloads.test.ts`
- Modify: `tests/uiBuilders.test.ts`

- [ ] Write failing tests that expect the register channel ID, Support role ID, `Cliente` and `Avisos LWX` role names, new portfolio categories, accurate item assignments, empty UI/UX and site states, and new pricing services.
- [ ] Run `npm test` and confirm the tests fail because the code still has old categories, old pricing, no register channel, and old site payload behavior.
- [ ] Implement the data/config/panel changes.
- [ ] Run `npm test` and confirm these tests pass.

### Task 2: Registration And Access Gate

**Files:**
- Create: `src/systems/registration.ts`
- Modify: `src/config/botConfig.ts`
- Modify: `src/ui/panels.ts`
- Modify: `src/systems/panels.ts`
- Modify: `src/index.ts`

- [ ] Write failing tests for registration panel payloads and access config.
- [ ] Run `npm test` and confirm missing exports fail.
- [ ] Implement registration panel, modal, announcement preference buttons, role creation, and configured-channel permission overwrites.
- [ ] Wire ready-time setup and interaction handlers.
- [ ] Run `npm test` and `npm run typecheck`.

### Task 3: Ticket Text/Call Ownership Flow

**Files:**
- Modify: `src/storage/runtimeStore.ts`
- Modify: `src/ui/components.ts`
- Modify: `src/systems/tickets.ts`
- Modify: `src/systems/reviews.ts`
- Modify: `src/index.ts`

- [ ] Write failing tests for ticket mode chooser payloads, support role checks, assignee label shortening, and ticket runtime state fields.
- [ ] Run `npm test` and confirm missing helpers fail.
- [ ] Implement text/call ticket creation, Support call decision controls, claim/finalize controls, voice-channel creation for accepted calls, and ticket-context review completion.
- [ ] Wire all new ticket custom IDs in the interaction router.
- [ ] Run `npm test` and `npm run typecheck`.

### Task 4: Deployment Packaging

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `docs/DEPLOY.md`
- Modify: `package.json`

- [ ] Add a `start` script for production.
- [ ] Add Docker packaging for an always-on Node process.
- [ ] Document Northflank free deployment and explain why Vercel is not recommended for this Gateway bot.
- [ ] Run `npm test` and `npm run typecheck`.

### Task 5: Final Verification

**Files:**
- All modified files.

- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Review the implementation against the approved request: portfolio categories, prices, ticket call/text flow, registration gate, and deployment guidance.
