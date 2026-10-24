import fs from 'node:fs';
import path from 'node:path';
import type { ProjectCategory, SiliaTaskType } from './types.js';

export interface KnowledgeChunk {
  id: string;
  sourceFile: string;
  heading: string;
  content: string;
  tokens: string[];
}

interface FewShotDataset {
  version: string;
  positiveExamples: Array<{
    id: string;
    category: string;
    clientRequest: string;
    whyItIsGood: string;
    proposalSummary: Record<string, unknown>;
  }>;
  negativeExamples: Array<{
    id: string;
    flawedOutput: string;
    whyItIsBad: string;
  }>;
}

const DOCS_ROOT = path.resolve(process.cwd(), 'docs', 'silia');
let cachedChunks: KnowledgeChunk[] | null = null;
let cachedPrompts = new Map<string, string>();
let cachedFewShots: FewShotDataset | null = null;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9#]+/)
    .filter((t) => t.length >= 3);
}

export function loadPromptTemplate(promptFileName: string, fallback = ''): string {
  const cached = cachedPrompts.get(promptFileName);
  if (cached) {
    return cached;
  }

  const fullPath = path.join(DOCS_ROOT, 'prompts', promptFileName);
  try {
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8').trim();
      cachedPrompts.set(promptFileName, content);
      return content;
    }
  } catch {
    // Fallback if file read fails
  }
  return fallback;
}

export function getPromptForTask(task: SiliaTaskType): string {
  switch (task) {
    case 'chat':
      return loadPromptTemplate('silia-chat.md');
    case 'discovery':
      return loadPromptTemplate('creative-discovery.md');
    case 'proposal':
      return loadPromptTemplate('creative-director.md');
    case 'visual_queries':
      return loadPromptTemplate('visual-research.md');
    case 'revision':
    case 'diagnostic':
      return loadPromptTemplate('proposal-revision.md');
    case 'briefing':
      return loadPromptTemplate('briefing-writer.md');
    case 'quality_review':
      return loadPromptTemplate('briefing-quality-review.md');
  }
}

export function buildKnowledgeIndex(forceReload = false): KnowledgeChunk[] {
  if (cachedChunks && !forceReload) {
    return cachedChunks;
  }

  const chunks: KnowledgeChunk[] = [];
  const playbookPath = path.join(DOCS_ROOT, 'SILIA_CREATIVE_PLAYBOOK.md');

  try {
    if (fs.existsSync(playbookPath)) {
      const raw = fs.readFileSync(playbookPath, 'utf8');
      const sections = raw.split(/\n(?=##\s+|\n###\s+)/g);
      sections.forEach((sec, index) => {
        const trimmed = sec.trim();
        if (!trimmed) return;
        const firstLine = trimmed.split('\n')[0]?.replace(/^#+\s*/, '').trim() || `Seção ${index + 1}`;
        chunks.push({
          id: `playbook-${index + 1}`,
          sourceFile: 'SILIA_CREATIVE_PLAYBOOK.md',
          heading: firstLine,
          content: trimmed,
          tokens: tokenize(trimmed),
        });
      });
    }
  } catch {
    // Ignore errors during index build
  }

  cachedChunks = chunks;
  return chunks;
}

export function retrieveRelevantKnowledge(
  query: string,
  projectCategory?: ProjectCategory,
  topK = 3,
): KnowledgeChunk[] {
  const index = buildKnowledgeIndex();
  if (index.length === 0) {
    return [];
  }

  const enrichedQuery = `${query} ${projectCategory ?? ''} cor tipografia composicao hierarquia`;
  const queryTokens = new Set(tokenize(enrichedQuery));

  const scored = index.map((chunk) => {
    let score = 0;
    for (const token of chunk.tokens) {
      if (queryTokens.has(token)) {
        score += 1;
      }
    }
    if (projectCategory && chunk.content.toLowerCase().includes(projectCategory)) {
      score += 4;
    }
    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((s) => s.chunk);
}

export function loadFewShotExamples(category?: ProjectCategory): string {
  if (!cachedFewShots) {
    const filePath = path.join(DOCS_ROOT, 'examples', 'few-shot-proposals.json');
    try {
      if (fs.existsSync(filePath)) {
        cachedFewShots = JSON.parse(fs.readFileSync(filePath, 'utf8')) as FewShotDataset;
      }
    } catch {
      cachedFewShots = null;
    }
  }

  if (!cachedFewShots) {
    return '';
  }

  const matchingPos = category
    ? cachedFewShots.positiveExamples.filter((e) => e.category === category)
    : cachedFewShots.positiveExamples.slice(0, 2);
  const selectedPos = matchingPos.length > 0 ? matchingPos : cachedFewShots.positiveExamples.slice(0, 2);
  const selectedNeg = cachedFewShots.negativeExamples.slice(0, 2);

  return [
    '### Exemplos Positivos de Direção de Arte (Siga este nível de precisão):',
    ...selectedPos.map(
      (ex) => `- **Caso (${ex.category}):** "${ex.clientRequest}" -> **Por que é excelente:** ${ex.whyItIsGood}`,
    ),
    '',
    '### Exemplos Negativos (PROIBIDO repetir estes erros):',
    ...selectedNeg.map((neg) => `- **Erro:** "${neg.flawedOutput}" -> **Por que falha:** ${neg.whyItIsBad}`),
  ].join('\n');
}
