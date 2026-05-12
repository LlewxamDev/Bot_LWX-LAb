# Discord Portfolio Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current design slash commands with red Terminal Lab fixed channel panels, private portfolio/pricing/review/ticket flows, welcome messages, and one `/ia` command.

**Architecture:** Add local config/data files, pure Discord UI builders, runtime JSON storage for panel/ticket state, and channel-specific interaction handlers. Keep Discord side effects thin in `src/index.ts` and make most content testable through builder functions.

**Tech Stack:** TypeScript, Node.js, discord.js v14, OpenAI SDK, Google Generative AI fallback, Vitest for focused unit tests.

---

## File Structure

- Modify: `package.json` to add Vitest and useful scripts.
- Modify: `tsconfig.json` only if TypeScript/Vitest requires Node types.
- Create: `tests/configData.test.ts`
- Create: `tests/uiBuilders.test.ts`
- Create: `tests/interactionPayloads.test.ts`
- Create: `src/config/botConfig.ts`
- Create: `src/data/pricing.ts`
- Create: `src/data/githubProjects.ts`
- Create: `src/data/portfolio.ts`
- Create: `src/data/welcomeFacts.ts`
- Create: `src/storage/runtimeStore.ts`
- Create: `src/ui/embeds.ts`
- Create: `src/ui/components.ts`
- Create: `src/ui/panels.ts`
- Create: `src/systems/panels.ts`
- Create: `src/systems/portfolio.ts`
- Create: `src/systems/pricing.ts`
- Replace: `src/systems/reviews.ts`
- Replace: `src/systems/tickets.ts`
- Create: `src/systems/welcome.ts`
- Create: `src/commands/ai.ts`
- Modify: `src/ai/chatbot.ts`
- Replace most of: `src/index.ts`
- Keep unused legacy files initially: `src/commands/design/portfolio.ts`, `src/commands/design/orcamento.ts`; stop importing/registering them.
- Create: `assets/portfolio/design-01.jpg` through `assets/portfolio/design-11.jpg`
- Create runtime directory: `data/runtime/`

## Task 1: Add Test Tooling

**Files:**
- Modify: `package.json`
- Modify if needed: `tsconfig.json`

- [ ] **Step 1: Write the failing test command expectation**

Run:

```powershell
npm test -- --runInBand
```

Expected now: FAIL because `package.json` currently has `"test": "echo \"Error: no test specified\" && exit 1"`.

- [ ] **Step 2: Add Vitest and scripts**

Install:

```powershell
npm install -D vitest
```

Update `package.json` scripts to:

```json
{
  "scripts": {
    "dev": "npx tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 3: Verify the test command is now wired**

Run:

```powershell
npm test
```

Expected: Vitest starts and reports no test files or exits cleanly once test files exist in the next task.

- [ ] **Step 4: Commit if Git exists**

This workspace currently has no `.git`; skip commit here unless a Git repo is initialized before execution.

## Task 2: Local Config and Data

**Files:**
- Create: `tests/configData.test.ts`
- Create: `src/config/botConfig.ts`
- Create: `src/data/pricing.ts`
- Create: `src/data/githubProjects.ts`
- Create: `src/data/portfolio.ts`
- Create: `src/data/welcomeFacts.ts`

- [ ] **Step 1: Write failing tests for config and data**

Create `tests/configData.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CHANNEL_IDS, THEME, TIMING } from '../src/config/botConfig';
import { pricingServices } from '../src/data/pricing';
import { githubProjects } from '../src/data/githubProjects';
import { portfolioCategories, portfolioItems } from '../src/data/portfolio';
import { welcomeFacts } from '../src/data/welcomeFacts';

describe('bot config and data', () => {
  it('contains all fixed channel ids from the approved spec', () => {
    expect(CHANNEL_IDS).toEqual({
      welcome: '1493076394916188180',
      portfolio: '1493077024422625531',
      pricing: '1493077221550723072',
      publicReviews: '1493077433677512774',
      reviewPrompt: '1503563707328757925',
      budget: '1493077618281550015',
    });
    expect(THEME.accent).toBe(0xff243d);
    expect(TIMING.shortNoticeMs).toBeGreaterThanOrEqual(4000);
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
    ]);
  });

  it('maps portfolio categories to local portfolio entries', () => {
    expect(portfolioCategories.map((category) => category.id)).toEqual([
      'all',
      'banners',
      'logos',
      'uiux',
      'sites',
    ]);
    expect(portfolioItems.length).toBe(11);
    expect(portfolioItems.every((item) => item.assetPath.startsWith('assets/portfolio/'))).toBe(true);
  });

  it('includes curated GitHub projects and welcome facts', () => {
    expect(githubProjects.some((project) => project.name === 'AegisHub')).toBe(true);
    expect(githubProjects.some((project) => project.name === 'Portf-lio')).toBe(true);
    expect(welcomeFacts.length).toBeGreaterThanOrEqual(8);
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm test -- tests/configData.test.ts
```

Expected: FAIL with missing modules such as `../src/config/botConfig`.

- [ ] **Step 3: Implement config and data**

Create `src/config/botConfig.ts` with channel IDs, panel keys, theme, and timing:

```ts
export const CHANNEL_IDS = {
  welcome: '1493076394916188180',
  portfolio: '1493077024422625531',
  pricing: '1493077221550723072',
  publicReviews: '1493077433677512774',
  reviewPrompt: '1503563707328757925',
  budget: '1493077618281550015',
} as const;

export const PANEL_KEYS = {
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
```

Create `src/data/pricing.ts` with the approved prices:

```ts
export type PricingService = {
  id: string;
  label: string;
  short: string;
  basePrice: string;
  delivery: string;
  revisions: string;
  includes: string[];
  bestFor: string;
};

export const pricingServices: PricingService[] = [
  {
    id: 'banner',
    label: 'Banner',
    short: 'Impacto visual para Discord, YouTube, X/Twitter ou perfil.',
    basePrice: 'A partir de R$ 55',
    delivery: '1 a 3 dias',
    revisions: '2 ajustes leves inclusos',
    includes: ['Composicao visual', 'Tipografia', 'Export final em alta qualidade'],
    bestFor: 'Divulgar servidor, canal, perfil ou campanha.',
  },
  {
    id: 'logo',
    label: 'Logo',
    short: 'Marca visual limpa, memoravel e pronta para uso.',
    basePrice: 'A partir de R$ 90',
    delivery: '2 a 5 dias',
    revisions: '2 rodadas de ajuste',
    includes: ['Conceito visual', 'Versao principal', 'Arquivo transparente quando aplicavel'],
    bestFor: 'Servidores, marcas pessoais, projetos e comunidades.',
  },
  {
    id: 'divider',
    label: 'Barrinha / Divisoria',
    short: 'Separadores visuais para organizar canais e apresentacoes.',
    basePrice: 'A partir de R$ 35',
    delivery: '1 a 2 dias',
    revisions: '1 ajuste leve incluso',
    includes: ['Estilo alinhado ao tema', 'Tamanho otimizado', 'Export pronto para Discord'],
    bestFor: 'Deixar canais, regras e anuncios mais bonitos.',
  },
  {
    id: 'illustration',
    label: 'Ilustracao simples',
    short: 'Arte personalizada com composicao e acabamento estilizado.',
    basePrice: 'A partir de R$ 120',
    delivery: '3 a 7 dias',
    revisions: '2 ajustes conforme escopo',
    includes: ['Direcao visual', 'Arte final', 'Export para uso digital'],
    bestFor: 'Personagens, mascotes simples e pecas especiais.',
  },
  {
    id: 'uiux',
    label: 'UI/UX Screen',
    short: 'Tela ou interface organizada para produto, site ou app.',
    basePrice: 'A partir de R$ 160',
    delivery: '3 a 6 dias',
    revisions: '2 rodadas de ajuste',
    includes: ['Layout', 'Hierarquia visual', 'Componentes principais'],
    bestFor: 'Landing pages, dashboards, apps e ideias de produto.',
  },
  {
    id: 'site_one_page',
    label: 'Site one-page',
    short: 'Site de pagina unica com visual forte e responsivo.',
    basePrice: 'A partir de R$ 350',
    delivery: '5 a 10 dias',
    revisions: '2 rodadas de ajuste',
    includes: ['Layout responsivo', 'Codigo base', 'Publicacao combinada no ticket'],
    bestFor: 'Portfolio, apresentacao, comunidade ou produto pequeno.',
  },
  {
    id: 'site_complete',
    label: 'Site completo',
    short: 'Site com multiplas secoes/paginas e acabamento mais profundo.',
    basePrice: 'A partir de R$ 650',
    delivery: '10 a 20 dias',
    revisions: 'Escopo combinado no ticket',
    includes: ['Arquitetura visual', 'Paginas principais', 'Ajustes responsivos'],
    bestFor: 'Projetos maiores, marcas e produtos com mais conteudo.',
  },
  {
    id: 'server_pack',
    label: 'Pacote servidor / marca',
    short: 'Combo visual para deixar servidor ou marca consistente.',
    basePrice: 'A partir de R$ 220',
    delivery: '4 a 8 dias',
    revisions: '2 rodadas de ajuste',
    includes: ['Logo ou icone simples', 'Banner', 'Barrinhas/divisorias base'],
    bestFor: 'Lancar ou reformular um servidor com identidade visual.',
  },
];
```

Create `src/data/githubProjects.ts` with curated site/project entries:

```ts
export type GitHubProject = {
  name: string;
  description: string;
  url: string;
  homepage?: string;
  language: string;
};

export const githubProjects: GitHubProject[] = [
  {
    name: 'AegisHub',
    description: 'Security analyzer for GitHub repositories with Rust engine, secret detection, scoring, and React dashboard.',
    url: 'https://github.com/Lamarq7eYT/AegisHub',
    language: 'Rust',
  },
  {
    name: 'AegisCore',
    description: 'Hybrid TypeScript and Rust web-defense platform for auth, sessions, risk scoring, observability, and secure APIs.',
    url: 'https://github.com/Lamarq7eYT/AegisCore',
    language: 'TypeScript',
  },
  {
    name: 'Portf-lio',
    description: 'Cinematic TypeScript portfolio built with React, Vite, Three.js, GSAP, Framer Motion, and interactive scenes.',
    url: 'https://github.com/Lamarq7eYT/Portf-lio',
    language: 'TypeScript',
  },
  {
    name: 'HackerPage',
    description: 'Immersive Three.js web experience about hacker history, cybersecurity incidents, and digital investigation.',
    url: 'https://github.com/Lamarq7eYT/HackerPage',
    language: 'HTML',
  },
  {
    name: 'CalcASM',
    description: 'Assembly x86-64 calculator with browser-based instruction visualizer for registers, flags, stack, and operations.',
    url: 'https://github.com/Lamarq7eYT/CalcASM',
    language: 'JavaScript',
  },
  {
    name: 'WhiteHolewithASM',
    description: 'Experimental white hole visualization built with Windows x64 Assembly, OpenGL, GLSL shaders, and WebGL preview.',
    url: 'https://github.com/Lamarq7eYT/WhiteHolewithASM',
    language: 'Assembly',
  },
];
```

Create `src/data/portfolio.ts` with 11 local assets distributed by category:

```ts
export type PortfolioCategoryId = 'all' | 'banners' | 'logos' | 'uiux' | 'sites';

export type PortfolioCategory = {
  id: PortfolioCategoryId;
  label: string;
  description: string;
};

export type PortfolioItem = {
  id: string;
  title: string;
  category: Exclude<PortfolioCategoryId, 'all' | 'sites'>;
  assetPath: string;
  note: string;
};

export const portfolioCategories: PortfolioCategory[] = [
  { id: 'all', label: 'Todos', description: 'Tudo que ja esta no arquivo visual.' },
  { id: 'banners', label: 'Banners', description: 'Composicoes para impacto rapido.' },
  { id: 'logos', label: 'Logos', description: 'Identidade visual e marca.' },
  { id: 'uiux', label: 'UI/UX', description: 'Interfaces, telas e layouts.' },
  { id: 'sites', label: 'Sites', description: 'Projetos web e repositorios.' },
];

export const portfolioItems: PortfolioItem[] = [
  { id: 'design-01', title: 'Design 01', category: 'banners', assetPath: 'assets/portfolio/design-01.jpg', note: 'Extraido do portfolio publico.' },
  { id: 'design-02', title: 'Design 02', category: 'banners', assetPath: 'assets/portfolio/design-02.jpg', note: 'Extraido do portfolio publico.' },
  { id: 'design-03', title: 'Design 03', category: 'banners', assetPath: 'assets/portfolio/design-03.jpg', note: 'Extraido do portfolio publico.' },
  { id: 'design-04', title: 'Design 04', category: 'logos', assetPath: 'assets/portfolio/design-04.jpg', note: 'Extraido do portfolio publico.' },
  { id: 'design-05', title: 'Design 05', category: 'logos', assetPath: 'assets/portfolio/design-05.jpg', note: 'Extraido do portfolio publico.' },
  { id: 'design-06', title: 'Design 06', category: 'logos', assetPath: 'assets/portfolio/design-06.jpg', note: 'Extraido do portfolio publico.' },
  { id: 'design-07', title: 'Design 07', category: 'uiux', assetPath: 'assets/portfolio/design-07.jpg', note: 'Extraido do portfolio publico.' },
  { id: 'design-08', title: 'Design 08', category: 'uiux', assetPath: 'assets/portfolio/design-08.jpg', note: 'Extraido do portfolio publico.' },
  { id: 'design-09', title: 'Design 09', category: 'uiux', assetPath: 'assets/portfolio/design-09.jpg', note: 'Extraido do portfolio publico.' },
  { id: 'design-10', title: 'Design 10', category: 'banners', assetPath: 'assets/portfolio/design-10.jpg', note: 'Extraido do portfolio publico.' },
  { id: 'design-11', title: 'Design 11', category: 'uiux', assetPath: 'assets/portfolio/design-11.jpg', note: 'Extraido do portfolio publico.' },
];
```

Create `src/data/welcomeFacts.ts`:

```ts
export const welcomeFacts = [
  'Interfaces boas costumam parecer simples porque escondem muitas decisoes bem feitas.',
  'Um bom banner precisa funcionar em poucos segundos: contraste, foco e leitura.',
  'Tipografia muda o clima de uma marca antes mesmo da pessoa ler a frase.',
  'UX nao e so beleza: e reduzir atrito para a pessoa chegar onde quer.',
  'Cores fortes funcionam melhor quando existe espaco escuro para elas respirarem.',
  'Um portfolio bom mostra processo e resultado, nao apenas imagens bonitas.',
  'Identidade visual consistente faz um servidor parecer mais confiavel.',
  'Microcopy e design tambem: uma frase curta pode guiar melhor que dez botoes.',
];
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```powershell
npm test -- tests/configData.test.ts
```

Expected: PASS.

## Task 3: Extract Local Portfolio Assets

**Files:**
- Create: `assets/portfolio/design-01.jpg` through `assets/portfolio/design-11.jpg`

- [ ] **Step 1: Create asset directory and extract images**

Run:

```powershell
New-Item -ItemType Directory -Force -Path 'assets\portfolio' | Out-Null
$html = (Invoke-WebRequest -Uri 'https://llewxam.netlify.app' -UseBasicParsing -TimeoutSec 30).Content
$matches = [regex]::Matches($html, 'data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)')
$i = 0
foreach ($match in $matches) {
  $i++
  $bytes = [Convert]::FromBase64String($match.Groups[2].Value)
  $path = ('assets\portfolio\design-{0:D2}.jpg' -f $i)
  [IO.File]::WriteAllBytes((Join-Path (Get-Location) $path), $bytes)
}
```

Expected: 11 JPG files are created.

- [ ] **Step 2: Verify asset count**

Run:

```powershell
(Get-ChildItem -LiteralPath 'assets\portfolio' -Filter '*.jpg').Count
```

Expected: `11`.

## Task 4: Terminal Lab UI Builders

**Files:**
- Create: `tests/uiBuilders.test.ts`
- Create: `src/ui/embeds.ts`
- Create: `src/ui/components.ts`
- Create: `src/ui/panels.ts`

- [ ] **Step 1: Write failing tests for pure UI builders**

Create `tests/uiBuilders.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildTerminalEmbed, renderStars } from '../src/ui/embeds';
import { buildPortfolioCategorySelect, buildStarButtons } from '../src/ui/components';
import { buildPortfolioPanel, buildPricingPanel } from '../src/ui/panels';

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
    expect(buildPortfolioCategorySelect('all').toJSON().components[0].custom_id).toBe('portfolio:category');
    expect(buildStarButtons(3).toJSON().components.map((button: any) => button.custom_id)).toEqual([
      'review:rate:1',
      'review:rate:2',
      'review:rate:3',
      'review:rate:4',
      'review:rate:5',
    ]);
  });

  it('builds fixed panel payloads', () => {
    expect(buildPortfolioPanel().embeds[0].toJSON().title).toBe('> lwx.portfolio.open()');
    expect(buildPricingPanel().components.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm test -- tests/uiBuilders.test.ts
```

Expected: FAIL with missing UI modules.

- [ ] **Step 3: Implement embed helpers**

Create `src/ui/embeds.ts`:

```ts
import { EmbedBuilder } from 'discord.js';
import { THEME } from '../config/botConfig';

type TerminalEmbedInput = {
  command: string;
  title: string;
  description: string;
};

export function buildTerminalEmbed(input: TerminalEmbedInput): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(THEME.accent)
    .setTitle(`> ${input.command}`)
    .setDescription(`**${input.title}**\n${input.description}`)
    .setFooter({ text: THEME.footer })
    .setTimestamp();
}

export function renderStars(rating: number): string {
  return Array.from({ length: 5 }, (_, index) => (index < rating ? '★' : '☆')).join(' ');
}
```

- [ ] **Step 4: Implement component helpers**

Create `src/ui/components.ts` with select menus/buttons:

```ts
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from 'discord.js';
import { portfolioCategories, type PortfolioCategoryId } from '../data/portfolio';
import { pricingServices } from '../data/pricing';

export function buildPortfolioOpenButton() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('portfolio:open')
      .setLabel('Abrir arquivo')
      .setStyle(ButtonStyle.Danger),
  );
}

export function buildPortfolioCategorySelect(selected: PortfolioCategoryId = 'all') {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('portfolio:category')
      .setPlaceholder('Escolha a pasta do portfolio')
      .addOptions(
        portfolioCategories.map((category) => ({
          label: category.label,
          description: category.description,
          value: category.id,
          default: category.id === selected,
        })),
      ),
  );
}

export function buildPortfolioPager(category: string, index: number) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`portfolio:page:${category}:${Math.max(0, index - 1)}`)
      .setLabel('Anterior')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`portfolio:page:${category}:${index + 1}`)
      .setLabel('Proximo')
      .setStyle(ButtonStyle.Danger),
  );
}

export function buildPricingOpenButton() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('pricing:open')
      .setLabel('Abrir tabela')
      .setStyle(ButtonStyle.Danger),
  );
}

export function buildPricingSelect(selected = pricingServices[0]?.id ?? 'banner') {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('pricing:service')
      .setPlaceholder('Escolha o servico')
      .addOptions(
        pricingServices.map((service) => ({
          label: service.label,
          description: service.short.slice(0, 100),
          value: service.id,
          default: service.id === selected,
        })),
      ),
  );
}

export function buildTicketButton(serviceId = 'custom') {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:open:${serviceId}`)
      .setLabel('Abrir ticket')
      .setStyle(ButtonStyle.Danger),
  );
}

export function buildReviewOpenButton() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('review:open')
      .setLabel('Avaliar')
      .setStyle(ButtonStyle.Danger),
  );
}

export function buildStarButtons(selectedRating = 0) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    [1, 2, 3, 4, 5].map((rating) =>
      new ButtonBuilder()
        .setCustomId(`review:rate:${rating}`)
        .setLabel(rating <= selectedRating ? '★' : '☆')
        .setStyle(rating <= selectedRating ? ButtonStyle.Danger : ButtonStyle.Secondary),
    ),
  );
}
```

- [ ] **Step 5: Implement fixed panel builders**

Create `src/ui/panels.ts`:

```ts
import { buildTerminalEmbed } from './embeds';
import { buildPortfolioOpenButton, buildPricingOpenButton, buildReviewOpenButton, buildTicketButton } from './components';

export function buildPortfolioPanel() {
  return {
    embeds: [
      buildTerminalEmbed({
        command: 'lwx.portfolio.open()',
        title: 'Arquivo de trabalhos',
        description: 'Escolha uma categoria e receba uma galeria privada, organizada e sem poluir o canal.',
      }),
    ],
    components: [buildPortfolioOpenButton()],
  };
}

export function buildPricingPanel() {
  return {
    embeds: [
      buildTerminalEmbed({
        command: 'lwx.pricing.inspect()',
        title: 'Tabela de precos',
        description: 'Selecione o servico para ver preco base, prazo, revisoes e como abrir um orcamento.',
      }),
    ],
    components: [buildPricingOpenButton()],
  };
}

export function buildReviewPanel() {
  return {
    embeds: [
      buildTerminalEmbed({
        command: 'lwx.review.rate()',
        title: 'Avalie sua experiencia',
        description: 'Clique para escolher estrelas e escrever um feedback. A avaliacao final aparece no canal de avaliacoes.',
      }),
    ],
    components: [buildReviewOpenButton()],
  };
}

export function buildBudgetPanel() {
  return {
    embeds: [
      buildTerminalEmbed({
        command: 'lwx.ticket.open()',
        title: 'Fazer um orcamento',
        description: 'Abra um ticket privado para explicar sua ideia, combinar escopo e receber atendimento.',
      }),
    ],
    components: [buildTicketButton()],
  };
}
```

- [ ] **Step 6: Run tests to verify GREEN**

Run:

```powershell
npm test -- tests/uiBuilders.test.ts
```

Expected: PASS.

## Task 5: Runtime Store and Fixed Panel Upsert

**Files:**
- Create: `tests/interactionPayloads.test.ts`
- Create: `src/storage/runtimeStore.ts`
- Create: `src/systems/panels.ts`

- [ ] **Step 1: Write failing tests for runtime defaults and panel keys**

Create the first part of `tests/interactionPayloads.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDefaultRuntimeState } from '../src/storage/runtimeStore';
import { getPanelDefinitions } from '../src/systems/panels';

describe('runtime and panel definitions', () => {
  it('starts with empty panel and ticket state', () => {
    expect(createDefaultRuntimeState()).toEqual({ panels: {}, tickets: {} });
  });

  it('defines all fixed channel panels', () => {
    expect(getPanelDefinitions().map((panel) => panel.key)).toEqual([
      'portfolio',
      'pricing',
      'reviewPrompt',
      'budget',
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm test -- tests/interactionPayloads.test.ts
```

Expected: FAIL with missing storage/panel modules.

- [ ] **Step 3: Implement runtime JSON store**

Create `src/storage/runtimeStore.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';

export type RuntimeState = {
  panels: Record<string, string>;
  tickets: Record<string, { ownerId: string; serviceId: string; status: 'open' | 'closed' }>;
};

const runtimeDir = path.resolve('data/runtime');
const runtimePath = path.join(runtimeDir, 'state.json');

export function createDefaultRuntimeState(): RuntimeState {
  return { panels: {}, tickets: {} };
}

export function loadRuntimeState(): RuntimeState {
  if (!fs.existsSync(runtimePath)) return createDefaultRuntimeState();
  return { ...createDefaultRuntimeState(), ...JSON.parse(fs.readFileSync(runtimePath, 'utf8')) };
}

export function saveRuntimeState(state: RuntimeState) {
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.writeFileSync(runtimePath, JSON.stringify(state, null, 2));
}
```

- [ ] **Step 4: Implement fixed panel definitions and upsert**

Create `src/systems/panels.ts`:

```ts
import { ChannelType, Client, TextChannel } from 'discord.js';
import { CHANNEL_IDS } from '../config/botConfig';
import { loadRuntimeState, saveRuntimeState } from '../storage/runtimeStore';
import { buildBudgetPanel, buildPortfolioPanel, buildPricingPanel, buildReviewPanel } from '../ui/panels';

export function getPanelDefinitions() {
  return [
    { key: 'portfolio', channelId: CHANNEL_IDS.portfolio, build: buildPortfolioPanel },
    { key: 'pricing', channelId: CHANNEL_IDS.pricing, build: buildPricingPanel },
    { key: 'reviewPrompt', channelId: CHANNEL_IDS.reviewPrompt, build: buildReviewPanel },
    { key: 'budget', channelId: CHANNEL_IDS.budget, build: buildBudgetPanel },
  ] as const;
}

export async function upsertFixedPanels(client: Client) {
  const state = loadRuntimeState();

  for (const panel of getPanelDefinitions()) {
    const channel = await client.channels.fetch(panel.channelId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildText) {
      console.warn(`Panel channel not found: ${panel.key} (${panel.channelId})`);
      continue;
    }

    const payload = panel.build();
    const textChannel = channel as TextChannel;
    const savedMessageId = state.panels[panel.key];
    const savedMessage = savedMessageId
      ? await textChannel.messages.fetch(savedMessageId).catch(() => null)
      : null;

    const message = savedMessage
      ? await savedMessage.edit(payload)
      : await textChannel.send(payload);

    state.panels[panel.key] = message.id;

    if (!message.pinned) {
      await message.pin().catch((error) => {
        console.warn(`Could not pin panel ${panel.key}:`, error);
      });
    }
  }

  saveRuntimeState(state);
}
```

- [ ] **Step 5: Run tests to verify GREEN**

Run:

```powershell
npm test -- tests/interactionPayloads.test.ts
```

Expected: PASS.

## Task 6: Portfolio and Pricing Private Browsers

**Files:**
- Extend: `tests/interactionPayloads.test.ts`
- Create: `src/systems/portfolio.ts`
- Create: `src/systems/pricing.ts`

- [ ] **Step 1: Add failing tests for browser payload builders**

Append to `tests/interactionPayloads.test.ts`:

```ts
import { buildPortfolioBrowserPayload } from '../src/systems/portfolio';
import { buildPricingBrowserPayload } from '../src/systems/pricing';

describe('private browser payloads', () => {
  it('builds a portfolio payload for image categories', () => {
    const payload = buildPortfolioBrowserPayload('banners', 0);
    expect(payload.embeds[0].toJSON().title).toBe('> query portfolio --category=banners');
    expect(payload.files?.[0]).toContain('assets/portfolio/');
    expect(payload.components.length).toBeGreaterThanOrEqual(2);
  });

  it('builds a site portfolio payload from GitHub projects', () => {
    const payload = buildPortfolioBrowserPayload('sites', 0);
    expect(payload.embeds[0].toJSON().fields?.some((field) => field.name.includes('AegisHub'))).toBe(true);
    expect(payload.files).toBeUndefined();
  });

  it('builds a pricing payload with ticket action', () => {
    const payload = buildPricingBrowserPayload('logo');
    expect(payload.embeds[0].toJSON().title).toBe('> inspect price --service=logo');
    expect(payload.components.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm test -- tests/interactionPayloads.test.ts
```

Expected: FAIL with missing `systems/portfolio` and `systems/pricing`.

- [ ] **Step 3: Implement portfolio payload and handlers**

Create `src/systems/portfolio.ts`:

```ts
import type { ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';
import { githubProjects } from '../data/githubProjects';
import { portfolioItems, type PortfolioCategoryId } from '../data/portfolio';
import { buildPortfolioCategorySelect, buildPortfolioPager } from '../ui/components';
import { buildTerminalEmbed } from '../ui/embeds';

export function buildPortfolioBrowserPayload(category: PortfolioCategoryId = 'all', index = 0) {
  if (category === 'sites') {
    const embed = buildTerminalEmbed({
      command: 'query portfolio --category=sites',
      title: 'Sites e projetos',
      description: 'Projetos selecionados do GitHub do Llew.',
    });

    embed.addFields(
      githubProjects.slice(0, 6).map((project) => ({
        name: `${project.name} // ${project.language}`,
        value: `${project.description}\n${project.url}`,
      })),
    );

    return { embeds: [embed], components: [buildPortfolioCategorySelect(category)] };
  }

  const items = category === 'all' ? portfolioItems : portfolioItems.filter((item) => item.category === category);
  const safeIndex = items.length === 0 ? 0 : ((index % items.length) + items.length) % items.length;
  const item = items[safeIndex];
  const embed = buildTerminalEmbed({
    command: `query portfolio --category=${category}`,
    title: item?.title ?? 'Arquivo vazio',
    description: item ? `${item.note}\nItem ${safeIndex + 1}/${items.length}` : 'Nenhum item encontrado nessa categoria.',
  });

  if (item) embed.setImage(`attachment://${item.assetPath.split('/').pop()}`);

  return {
    embeds: [embed],
    components: [buildPortfolioCategorySelect(category), buildPortfolioPager(category, safeIndex)],
    files: item ? [item.assetPath] : undefined,
  };
}

export async function handlePortfolioOpen(interaction: ButtonInteraction) {
  await interaction.reply({ ...buildPortfolioBrowserPayload('all', 0), ephemeral: true });
}

export async function handlePortfolioCategory(interaction: StringSelectMenuInteraction) {
  const category = interaction.values[0] as PortfolioCategoryId;
  await interaction.update(buildPortfolioBrowserPayload(category, 0));
}

export async function handlePortfolioPage(interaction: ButtonInteraction) {
  const [, , category, index] = interaction.customId.split(':');
  await interaction.update(buildPortfolioBrowserPayload(category as PortfolioCategoryId, Number(index)));
}
```

- [ ] **Step 4: Implement pricing payload and handlers**

Create `src/systems/pricing.ts`:

```ts
import type { ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';
import { pricingServices } from '../data/pricing';
import { buildPricingSelect, buildTicketButton } from '../ui/components';
import { buildTerminalEmbed } from '../ui/embeds';

export function buildPricingBrowserPayload(serviceId = pricingServices[0]?.id ?? 'banner') {
  const service = pricingServices.find((item) => item.id === serviceId) ?? pricingServices[0];
  const embed = buildTerminalEmbed({
    command: `inspect price --service=${service.id}`,
    title: `${service.label} // ${service.basePrice}`,
    description: `${service.short}\n\n**Melhor para:** ${service.bestFor}`,
  });

  embed.addFields(
    { name: 'Entrega', value: service.delivery, inline: true },
    { name: 'Revisoes', value: service.revisions, inline: true },
    { name: 'Inclui', value: service.includes.map((item) => `- ${item}`).join('\n') },
  );

  return { embeds: [embed], components: [buildPricingSelect(service.id), buildTicketButton(service.id)] };
}

export async function handlePricingOpen(interaction: ButtonInteraction) {
  await interaction.reply({ ...buildPricingBrowserPayload(), ephemeral: true });
}

export async function handlePricingSelect(interaction: StringSelectMenuInteraction) {
  await interaction.update(buildPricingBrowserPayload(interaction.values[0]));
}
```

- [ ] **Step 5: Run tests to verify GREEN**

Run:

```powershell
npm test -- tests/interactionPayloads.test.ts
```

Expected: PASS.

## Task 7: Reviews, Tickets, Welcome, and AI Command

**Files:**
- Extend: `tests/uiBuilders.test.ts`
- Replace: `src/systems/reviews.ts`
- Replace: `src/systems/tickets.ts`
- Create: `src/systems/welcome.ts`
- Create: `src/commands/ai.ts`
- Modify: `src/ai/chatbot.ts`

- [ ] **Step 1: Add failing tests for review publish payload and AI command**

Append to `tests/uiBuilders.test.ts`:

```ts
import { buildPublicReviewPayload } from '../src/systems/reviews';
import { data as aiCommandData } from '../src/commands/ai';

describe('reviews and AI command', () => {
  it('builds public review payload with italic feedback', () => {
    const payload = buildPublicReviewPayload('123', 4, 'Atendimento muito bom');
    const json = payload.embeds[0].toJSON();
    expect(json.description).toContain('★ ★ ★ ★ ☆');
    expect(json.description).toContain('*Atendimento muito bom*');
  });

  it('defines /ia as the only intended slash command', () => {
    const json = aiCommandData.toJSON();
    expect(json.name).toBe('ia');
    expect(json.options?.[0].name).toBe('mensagem');
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm test -- tests/uiBuilders.test.ts
```

Expected: FAIL until review system and AI command exist.

- [ ] **Step 3: Replace review system**

Replace `src/systems/reviews.ts` with:

```ts
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ModalSubmitInteraction,
} from 'discord.js';
import { CHANNEL_IDS, TIMING } from '../config/botConfig';
import { buildStarButtons } from '../ui/components';
import { buildTerminalEmbed, renderStars } from '../ui/embeds';

export function buildReviewRatingPayload(rating = 0) {
  const embed = buildTerminalEmbed({
    command: 'lwx.review.rate()',
    title: 'Escolha sua nota',
    description: `Clique em uma estrela.\n\n${renderStars(rating)}`,
  });

  const feedbackRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`review:feedback:${rating}`)
      .setLabel('Escrever feedback')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(rating < 1),
  );

  return { embeds: [embed], components: [buildStarButtons(rating), feedbackRow] };
}

export function buildPublicReviewPayload(userId: string, rating: number, feedback: string) {
  return {
    embeds: [
      buildTerminalEmbed({
        command: 'review.publish()',
        title: `Nova avaliacao // ${renderStars(rating)}`,
        description: `${renderStars(rating)}\n\n*${feedback}*\n\nEnviado por <@${userId}>`,
      }),
    ],
  };
}

export async function handleReviewOpen(interaction: ButtonInteraction) {
  await interaction.reply({ ...buildReviewRatingPayload(), ephemeral: true });
}

export async function handleReviewRate(interaction: ButtonInteraction) {
  const rating = Number(interaction.customId.split(':')[2]);
  await interaction.update(buildReviewRatingPayload(rating));
}

export async function handleReviewFeedback(interaction: ButtonInteraction) {
  const rating = Number(interaction.customId.split(':')[2]);
  const modal = new ModalBuilder()
    .setCustomId(`review:submit:${rating}`)
    .setTitle('Feedback LWX Lab');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('feedback')
        .setLabel('Conte como foi sua experiencia')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(900),
    ),
  );

  await interaction.showModal(modal);
}

export async function handleReviewSubmit(interaction: ModalSubmitInteraction) {
  const rating = Number(interaction.customId.split(':')[2]);
  const feedback = interaction.fields.getTextInputValue('feedback');
  const channel = await interaction.client.channels.fetch(CHANNEL_IDS.publicReviews).catch(() => null);

  if (channel?.type === ChannelType.GuildText) {
    await channel.send(buildPublicReviewPayload(interaction.user.id, rating, feedback));
  }

  await interaction.reply({ content: 'Feedback publicado. Obrigado por avaliar o LWX Lab.', ephemeral: true });
  setTimeout(() => interaction.deleteReply().catch(() => undefined), TIMING.shortNoticeMs);
}
```

- [ ] **Step 4: Replace ticket system**

Replace `src/systems/tickets.ts` with a service-aware ticket creator:

```ts
import {
  ButtonInteraction,
  ChannelType,
  PermissionsBitField,
  TextChannel,
} from 'discord.js';
import { TIMING } from '../config/botConfig';
import { pricingServices } from '../data/pricing';
import { loadRuntimeState, saveRuntimeState } from '../storage/runtimeStore';
import { buildTerminalEmbed } from '../ui/embeds';

function normalizeChannelName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 80);
}

export async function handleTicketOpen(interaction: ButtonInteraction) {
  const guild = interaction.guild;
  if (!guild) return;

  const serviceId = interaction.customId.split(':')[2] ?? 'custom';
  const service = pricingServices.find((item) => item.id === serviceId);
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
      ],
    },
    {
      id: interaction.client.user.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ManageChannels,
      ],
    },
  ];

  if (process.env.SUPPORT_ROLE_ID) {
    overwrites.push({
      id: process.env.SUPPORT_ROLE_ID,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
      ],
    } as any);
  }

  try {
    const channel = await guild.channels.create({
      name: normalizeChannelName(`ticket-${interaction.user.username}-${service?.id ?? 'orcamento'}`),
      type: ChannelType.GuildText,
      permissionOverwrites: overwrites,
    });

    const embed = buildTerminalEmbed({
      command: 'ticket.session.start()',
      title: service ? `Orcamento // ${service.label}` : 'Orcamento personalizado',
      description: `Ola <@${interaction.user.id}>. Descreva sua ideia, referencias, prazo e onde esse design/site sera usado.`,
    });

    await channel.send({
      embeds: [embed],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              custom_id: 'ticket:close',
              label: 'Fechar ticket',
              style: 4,
            },
          ],
        },
      ],
    });

    const state = loadRuntimeState();
    state.tickets[channel.id] = { ownerId: interaction.user.id, serviceId, status: 'open' };
    saveRuntimeState(state);

    await interaction.reply({ content: `Ticket aberto: ${channel}`, ephemeral: true });
    setTimeout(() => interaction.deleteReply().catch(() => undefined), TIMING.shortNoticeMs);
  } catch (error) {
    console.error('Erro ao criar canal de ticket:', error);
    await interaction.reply({ content: 'Nao consegui criar o ticket. Verifique as permissoes do bot.', ephemeral: true });
  }
}

export async function handleTicketClose(interaction: ButtonInteraction) {
  const channel = interaction.channel as TextChannel | null;
  await interaction.reply('Ticket fechado. O canal sera removido em alguns segundos. Para avaliar, use o painel do canal de avaliacoes.');

  if (channel) {
    const state = loadRuntimeState();
    if (state.tickets[channel.id]) state.tickets[channel.id].status = 'closed';
    saveRuntimeState(state);
    setTimeout(() => channel.delete().catch(() => undefined), TIMING.ticketCloseMs);
  }
}
```

- [ ] **Step 5: Add welcome system**

Create `src/systems/welcome.ts`:

```ts
import { ChannelType, GuildMember } from 'discord.js';
import { CHANNEL_IDS } from '../config/botConfig';
import { welcomeFacts } from '../data/welcomeFacts';
import { buildTerminalEmbed } from '../ui/embeds';

export async function handleWelcome(member: GuildMember) {
  const channel = await member.client.channels.fetch(CHANNEL_IDS.welcome).catch(() => null);
  if (channel?.type !== ChannelType.GuildText) return;

  const fact = welcomeFacts[Math.floor(Math.random() * welcomeFacts.length)];
  const embed = buildTerminalEmbed({
    command: 'member.join()',
    title: `Bem-vindo, ${member.user.username}`,
    description: `<@${member.id}> entrou no servidor.\n\nConta criada em <t:${Math.floor(member.user.createdTimestamp / 1000)}:D>\nMembro #${member.guild.memberCount}\n\nCuriosidade: ${fact}`,
  });

  await channel.send({ embeds: [embed] });
}
```

- [ ] **Step 6: Add AI slash command and prompt**

Create `src/commands/ai.ts`:

```ts
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { askAI } from '../ai/chatbot';

export const data = new SlashCommandBuilder()
  .setName('ia')
  .setDescription('Converse com a IA do LWX Lab.')
  .addStringOption((option) =>
    option
      .setName('mensagem')
      .setDescription('O que voce quer perguntar ou pesquisar?')
      .setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const message = interaction.options.getString('mensagem', true);
  await interaction.deferReply();
  const response = await askAI(message);
  await interaction.editReply(response);
}
```

Update `src/ai/chatbot.ts` prompt to remove sales-first behavior:

```ts
const SYSTEM_PROMPT = `Voce e a IA do LWX Lab: divertida, curiosa, direta e boa em pesquisar, explicar, brainstormar e conversar com usuarios no Discord.
Seu papel principal e entreter e ajudar, como uma IA geral de chat.
Regras:
1. Responda em portugues do Brasil por padrao, de forma clara e compacta.
2. Pode ser descontraida, mas sem exagerar e sem fingir informacoes.
3. Se perguntarem sobre comprar design, preco, portfolio ou contratar o Llew, direcione para os paineis fixos do servidor ou para abrir ticket.
4. Se nao souber algo, diga isso e ofereca um caminho de pesquisa.
5. Evite blocos gigantes; prefira respostas boas para leitura no Discord.`;
```

- [ ] **Step 7: Run tests to verify GREEN**

Run:

```powershell
npm test -- tests/uiBuilders.test.ts
```

Expected: PASS.

## Task 8: Wire the Bot Entry Point

**Files:**
- Replace most of: `src/index.ts`

- [ ] **Step 1: Update imports, intents, slash registration, and handlers**

Replace legacy command imports and interaction routing in `src/index.ts` with:

```ts
import { Client, Events, GatewayIntentBits, REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import * as cmdAI from './commands/ai';
import { askAI } from './ai/chatbot';
import { upsertFixedPanels } from './systems/panels';
import { handlePortfolioCategory, handlePortfolioOpen, handlePortfolioPage } from './systems/portfolio';
import { handlePricingOpen, handlePricingSelect } from './systems/pricing';
import { handleReviewFeedback, handleReviewOpen, handleReviewRate, handleReviewSubmit } from './systems/reviews';
import { handleTicketClose, handleTicketOpen } from './systems/tickets';
import { handleWelcome } from './systems/welcome';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

const commands = [cmdAI.data.toJSON()];

client.once(Events.ClientReady, async (c) => {
  console.log(`Logado com sucesso como ${c.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || '');
  try {
    await rest.put(Routes.applicationGuildCommands(c.user.id, process.env.GUILD_ID || ''), { body: commands });
    console.log('Slash commands atualizados: /ia');
  } catch (error) {
    console.error('Erro ao registrar comandos', error);
  }

  await upsertFixedPanels(client);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'ia') await cmdAI.execute(interaction);
    return;
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'portfolio:open') await handlePortfolioOpen(interaction);
    else if (interaction.customId.startsWith('portfolio:page:')) await handlePortfolioPage(interaction);
    else if (interaction.customId === 'pricing:open') await handlePricingOpen(interaction);
    else if (interaction.customId === 'review:open') await handleReviewOpen(interaction);
    else if (interaction.customId.startsWith('review:rate:')) await handleReviewRate(interaction);
    else if (interaction.customId.startsWith('review:feedback:')) await handleReviewFeedback(interaction);
    else if (interaction.customId.startsWith('ticket:open:')) await handleTicketOpen(interaction);
    else if (interaction.customId === 'ticket:close') await handleTicketClose(interaction);
    return;
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'portfolio:category') await handlePortfolioCategory(interaction);
    else if (interaction.customId === 'pricing:service') await handlePricingSelect(interaction);
    return;
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('review:submit:')) await handleReviewSubmit(interaction);
  }
});

client.on(Events.GuildMemberAdd, handleWelcome);

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const isMention = message.mentions.has(client.user?.id || '');
  const isDM = !message.guild;
  if (!isMention && !isDM) return;

  const cleanContent = message.content.replace(/<@!?[0-9]+>/g, '').trim();
  await message.channel.sendTyping();
  const iaResponse = await askAI(cleanContent || 'Ola');
  await message.reply(iaResponse);
});

if (!process.env.DISCORD_TOKEN) {
  console.log('IMPORTANTE: Preencha o DISCORD_TOKEN no arquivo .env');
} else {
  client.login(process.env.DISCORD_TOKEN);
}
```

- [ ] **Step 2: Run all tests and typecheck**

Run:

```powershell
npm test
npm run typecheck
```

Expected: PASS. If `verbatimModuleSyntax` conflicts with CommonJS/package settings, fix by aligning `tsconfig.json` with the current runtime setup, for example using `module: "NodeNext"` and compatible package type, or relaxing `verbatimModuleSyntax` while preserving runtime behavior.

## Task 9: Manual Discord Verification

**Files:**
- No code files unless defects are found.

- [ ] **Step 1: Start the bot**

Run:

```powershell
npm run dev
```

Expected:

- Bot logs in.
- Slash command refresh says only `/ia`.
- Fixed panels are sent or edited in the four configured channels.

- [ ] **Step 2: Verify Discord permissions**

In Discord, confirm:

- Bot can view/send in all configured channels.
- Bot can manage/pin messages if pinned panels are desired.
- Bot can create/manage ticket channels.
- Server Members Intent is enabled in the Developer Portal for welcome messages.

- [ ] **Step 3: Verify flows manually**

Manual checks:

- Portfolio channel: click panel, select `Banners`, `Logos`, `UI/UX`, `Sites`, and use next/previous.
- Pricing channel: open table, select each service, open a ticket from at least one service.
- Review prompt channel: click evaluate, choose 3 stars, verify `★ ★ ★ ☆ ☆`, submit modal, confirm public review appears.
- Budget channel: open and close a ticket.
- Welcome channel: test with a member join if possible.
- `/ia`: ask a casual question and verify it is not sales-first.

- [ ] **Step 4: Final verification**

Run:

```powershell
npm test
npm run typecheck
```

Expected: PASS before reporting complete.

