import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import type {
  GeminiThinkingLevel,
  ModelExecutionMetadata,
  SiliaHistoryTurn,
  SiliaTaskType,
} from './types.js';

export const PRIMARY_VERTEX_MODEL = process.env.SILIA_PRIMARY_MODEL?.trim() || 'gemini-3.8-flash';
export const FALLBACK_VERTEX_MODEL_1 = process.env.SILIA_FALLBACK_MODEL_1?.trim() || 'gemini-3.6-flash';
export const FALLBACK_VERTEX_MODEL_2 =
  process.env.SILIA_FALLBACK_MODEL_2?.trim() || 'gemini-3.5-flash-lite';

export interface RouterRequest {
  task: SiliaTaskType;
  systemPrompt: string;
  userPrompt: string;
  history?: SiliaHistoryTurn[] | undefined;
  responseJsonSchema?: Record<string, unknown> | undefined;
  thinkingLevelOverride?: GeminiThinkingLevel | undefined;
  timeoutMs?: number | undefined;
}

export interface RouterResponse {
  text: string;
  metadata: ModelExecutionMetadata;
}

/**
 * Maps each Silia task to its appropriate Gemini 3.8 Flash thinking level.
 * Never returns MINIMAL (unsupported by gemini-3.8-flash).
 */
export function resolveThinkingLevelForTask(
  task: SiliaTaskType,
  override?: GeminiThinkingLevel,
): GeminiThinkingLevel {
  if (override === 'LOW' || override === 'MEDIUM' || override === 'HIGH') {
    return override;
  }

  switch (task) {
    case 'chat':
    case 'discovery':
    case 'visual_queries':
      return 'LOW';
    case 'proposal':
    case 'revision':
    case 'briefing':
    case 'quality_review':
      return 'MEDIUM';
    case 'diagnostic':
      return 'HIGH';
  }
}

function toSdkThinkingLevel(level: GeminiThinkingLevel): ThinkingLevel {
  switch (level) {
    case 'LOW':
      return ThinkingLevel.LOW;
    case 'HIGH':
      return ThinkingLevel.HIGH;
    case 'MEDIUM':
    default:
      return ThinkingLevel.MEDIUM;
  }
}

/**
 * Sanitizes conversation history according to Gemini 3.8 Flash strict sequence validation:
 * 1. Drops empty turns.
 * 2. Removes prefilled or trailing 'model' turns so the payload always ends with a 'user' turn.
 */
export function sanitizeGemini3History(
  history: SiliaHistoryTurn[],
  latestUserPrompt: string,
): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  const nonEmpty = history
    .map((h) => ({
      role: h.role === 'assistant' ? ('model' as const) : ('user' as const),
      text: h.content?.trim() ?? '',
    }))
    .filter((h) => h.text.length > 0);

  // Drop trailing model turns before appending the current user turn if needed,
  // and coalesce consecutive same-role turns so sequence validation always succeeds.
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
  for (const item of nonEmpty.slice(-8)) {
    const prev = contents[contents.length - 1];
    if (prev && prev.role === item.role) {
      prev.parts[0]!.text += `\n\n${item.text}`;
    } else {
      contents.push({
        role: item.role,
        parts: [{ text: item.text }],
      });
    }
  }

  const trimmedLatest = latestUserPrompt.trim() || 'Continuar.';
  const lastTurn = contents[contents.length - 1];
  if (lastTurn && lastTurn.role === 'user') {
    lastTurn.parts[0]!.text += `\n\n${trimmedLatest}`;
  } else {
    contents.push({
      role: 'user',
      parts: [{ text: trimmedLatest }],
    });
  }

  return contents;
}

/**
 * Builds the generation config for @google/genai.
 * Strictly strips temperature, topP, topK, candidateCount, frequencyPenalty, presencePenalty
 * when targeting gemini-3.8-flash per official Google Cloud documentation.
 */
export function buildVertexGenAiConfig(
  modelName: string,
  systemPrompt: string,
  thinkingLevel: GeminiThinkingLevel,
  responseJsonSchema?: Record<string, unknown>,
): Record<string, unknown> {
  const isGemini38 = modelName.includes('gemini-3.8');

  const config: Record<string, unknown> = {
    systemInstruction: systemPrompt,
  };

  if (isGemini38) {
    config.thinkingConfig = {
      thinkingLevel: toSdkThinkingLevel(thinkingLevel),
    };
  } else {
    // For 3.6-flash / 3.5-flash-lite fallback models
    config.thinkingConfig = {
      thinkingLevel: toSdkThinkingLevel(thinkingLevel === 'HIGH' ? 'MEDIUM' : thinkingLevel),
    };
  }

  if (responseJsonSchema) {
    config.responseMimeType = 'application/json';
    config.responseJsonSchema = responseJsonSchema;
  }

  return config;
}

export function isVertexAdcConfigured(): boolean {
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  return Boolean(project && project.length > 0 && project !== 'your-gcp-project-id');
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout (${ms}ms) em ${label}`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function callSiliaModelRouter(req: RouterRequest): Promise<RouterResponse> {
  if (process.env.SILIA_OFFLINE_MODE === 'true' || process.env.VITEST) {
    throw new Error('Modo offline/teste ativo — usando motor de arquétipos local');
  }
  const startTime = Date.now();
  const thinkingLevel = resolveThinkingLevelForTask(req.task, req.thinkingLevelOverride);
  const timeoutMs = req.timeoutMs ?? 22_000;
  const history = req.history ?? [];
  const fallbackReasons: string[] = [];

  // 1. Primary Route: Google Cloud Vertex AI / Gemini Enterprise (@google/genai)
  if (isVertexAdcConfigured()) {
    const project = process.env.GOOGLE_CLOUD_PROJECT!.trim();
    const location = process.env.GOOGLE_CLOUD_LOCATION?.trim() || 'global';
    const vertexModels = [
      PRIMARY_VERTEX_MODEL,
      FALLBACK_VERTEX_MODEL_1,
      FALLBACK_VERTEX_MODEL_2,
    ].filter((m, idx, arr) => Boolean(m) && arr.indexOf(m) === idx);

    const client = new GoogleGenAI({
      vertexai: true,
      project,
      location,
    });

    const contents = sanitizeGemini3History(history, req.userPrompt);

    for (let i = 0; i < vertexModels.length; i++) {
      const modelName = vertexModels[i]!;
      try {
        const config = buildVertexGenAiConfig(
          modelName,
          req.systemPrompt,
          thinkingLevel,
          req.responseJsonSchema,
        );

        const response = await withTimeout(
          client.models.generateContent({
            model: modelName,
            contents,
            config,
          }),
          timeoutMs,
          `VertexAI:${modelName}`,
        );

        const text = response.text?.trim();
        if (text) {
          return {
            text,
            metadata: {
              provider: 'vertex-gemini',
              model: modelName,
              thinkingLevel,
              latencyMs: Date.now() - startTime,
              fallbackOccurred: i > 0,
              fallbackReason: fallbackReasons.length > 0 ? fallbackReasons.join(' | ') : undefined,
            },
          };
        }
        fallbackReasons.push(`${modelName}: empty response`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        fallbackReasons.push(`${modelName}: ${msg.slice(0, 120)}`);
        console.warn(`[SiliaRouter] Vertex model ${modelName} falhou:`, msg);
      }
    }
  } else {
    fallbackReasons.push('GOOGLE_CLOUD_PROJECT não configurado');
  }

  // 2. Fallback Route A: OpenAI SDK (if OPENAI_API_KEY is configured)
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'missing-openai-key') {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await withTimeout(
        openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: req.systemPrompt },
            ...history.slice(-6).map((h) => ({ role: h.role, content: h.content })),
            { role: 'user', content: req.userPrompt },
          ],
          max_tokens: req.responseJsonSchema ? 1400 : 600,
          temperature: 0.7,
          ...(req.responseJsonSchema ? { response_format: { type: 'json_object' as const } } : {}),
        }),
        timeoutMs,
        'OpenAI:gpt-4o-mini',
      );

      const text = response.choices[0]?.message?.content?.trim();
      if (text) {
        return {
          text,
          metadata: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            latencyMs: Date.now() - startTime,
            fallbackOccurred: true,
            fallbackReason: fallbackReasons.join(' | '),
          },
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      fallbackReasons.push(`openai: ${msg.slice(0, 100)}`);
    }
  }

  // 3. Fallback Route B: Gemini Developer API Key (if GEMINI_API_KEY is configured)
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your-gemini-api-key') {
    const geminiKeyModels = [
      process.env.GEMINI_MODEL?.trim(),
      'gemini-2.5-flash',
      'gemini-2.0-flash',
    ].filter((m, idx, arr): m is string => Boolean(m) && arr.indexOf(m) === idx);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const transcript = [
      ...history.slice(-6).map((h) => `${h.role === 'user' ? 'Cliente' : 'Silia AI'}: ${h.content}`),
      `Cliente: ${req.userPrompt}`,
    ].join('\n\n');

    for (const modelName of geminiKeyModels) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: req.systemPrompt,
        });
        const result = await withTimeout(
          model.generateContent(transcript),
          timeoutMs,
          `GeminiKey:${modelName}`,
        );
        const text = result.response.text()?.trim();
        if (text) {
          return {
            text,
            metadata: {
              provider: 'gemini-api-key',
              model: modelName,
              latencyMs: Date.now() - startTime,
              fallbackOccurred: true,
              fallbackReason: fallbackReasons.join(' | '),
            },
          };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        fallbackReasons.push(`gemini-key(${modelName}): ${msg.slice(0, 90)}`);
      }
    }
  }

  // 4. Fallback Route C: Real-time Keyless OpenAI-compatible Provider (Pollinations)
  const freeModels = ['openai', 'mistral'];
  for (const freeModel of freeModels) {
    try {
      const response = await withTimeout(
        fetch('https://text.pollinations.ai/openai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: freeModel,
            messages: [
              { role: 'system', content: req.systemPrompt },
              ...history.slice(-6).map((h) => ({ role: h.role, content: h.content })),
              { role: 'user', content: req.userPrompt },
            ],
            temperature: 0.7,
            ...(req.responseJsonSchema ? { response_format: { type: 'json_object' } } : {}),
          }),
        }),
        14_000,
        `Pollinations:${freeModel}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const rawContent = data.choices?.[0]?.message?.content?.trim();
      if (rawContent) {
        const cleaned =
          rawContent.split(/\n---\s*\n|\n\*?Support Pollinations/i)[0]?.trim() || rawContent;
        return {
          text: cleaned,
          metadata: {
            provider: 'pollinations',
            model: `pollinations-${freeModel}`,
            latencyMs: Date.now() - startTime,
            fallbackOccurred: true,
            fallbackReason: fallbackReasons.join(' | '),
          },
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      fallbackReasons.push(`pollinations(${freeModel}): ${msg.slice(0, 80)}`);
    }
  }

  throw new Error(`Todos os provedores remotos falharam: ${fallbackReasons.join(' -> ')}`);
}
