import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'missing-openai-key',
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_MODEL_FALLBACKS = [DEFAULT_GEMINI_MODEL, 'gemini-flash-latest', 'gemini-2.0-flash'];

export type SiliaMode = 'chat' | 'ideate';

export type SiliaHistoryTurn = {
  role: 'user' | 'assistant';
  content: string;
};

const SILIA_CHAT_PROMPT = `Você é a Silia AI ✨, a inteligência artificial oficial e mascote fofa do estúdio LWX Lab (criado pelo designer Llewxam).
Sua aparência: uma robozinha minimalista nas cores roxo-violeta (#8B5CF6) e azul-ciano (#52B7FF), sem boca, com olhinhos brilhantes e uma piscadinha com estrelinha dourada.
Seu modo atual: CONVERSA LIVRE (Conversar com a Silia AI).
Regras:
1. Responda sempre em português do Brasil, de forma carismática, acolhedora, inteligente e natural.
2. Converse sobre qualquer assunto que o usuário trouxer (dia a dia, jogos, criatividade, curiosidades, tecnologia, arte ou o servidor LWX Lab).
3. Não use blocos de código de terminal. Mantenha respostas concisas, bem formatadas e agradáveis de ler (máximo de 2 a 3 parágrafos curtos).`;

const SILIA_IDEATE_PROMPT = `Você é a Silia AI ✨, a consultora de direção criativa do estúdio LWX Lab (do designer Llewxam).
Seu modo atual: APRIMORAR IDEIA DE DESIGN (ajudar o cliente a estruturar e lapidar uma ideia de design para apresentar ao designer Llewxam).
Regras:
1. Responda em português do Brasil de forma criativa, organizada e prática.
2. Quando o usuário contar uma ideia (mesmo que vaga, ex: "quero um banner", "quero uma logo", "quero um personagem"), ajude a lapidar a ideia sugerindo:
   • **Conceito Visual & Estilo** (ex.: dark-glitch, anime/mangá, esportivo, minimalista, neon, fantasia)
   • **Paleta de Cores Sugerida** (cores que combinam com a ideia dele)
   • **Elementos & Tipografia** (o que colocar no centro, fundo, iluminação e textos)
   • **Resumo Pronto para o Designer (Briefing)**: um bloquinho curto que ele já pode enviar direto no orçamento para o Llewxam!
3. Faça 1 ou 2 perguntas curtas no final para continuar refinando a ideia caso ele queira ajustar algo.
4. Lembre que os preços do estúdio LWX Lab são super acessíveis (Barrinhas a partir de R$ 10, Banners R$ 20, Logos R$ 30, Ilustrações R$ 35, Packs R$ 55, Bots R$ 70, Sites R$ 90).`;

export function getGeminiModelCandidates(configuredModel = process.env.GEMINI_MODEL) {
  return [configuredModel, ...GEMINI_MODEL_FALLBACKS].filter(
    (model, index, models): model is string => Boolean(model) && models.indexOf(model) === index,
  );
}

export function isMissingGeminiModelError(error: unknown) {
  const maybeError = error as { status?: number; message?: string } | undefined;
  return maybeError?.status === 404 || /models\/.+ is not found/i.test(maybeError?.message || '');
}

function buildSmartSiliaFallback(userMessage: string, mode: SiliaMode, userName?: string): string {
  const name = userName ? `, **${userName}**` : '';
  const lower = userMessage.toLowerCase();

  if (mode === 'ideate') {
    const isBanner = /banner|header|capa|youtube|perfil|twitch/i.test(lower);
    const isLogo = /logo|marca|icone|ícone|mascote|servidor/i.test(lower);
    const isArt = /ilustra|personagem|oc|desenho|arte|anime|cavaleiro/i.test(lower);

    const pieceType = isBanner
      ? 'Banner / Header HD'
      : isLogo
        ? 'Logo & Identidade Visual'
        : isArt
          ? 'Ilustração Autoral / OC'
          : 'Projeto Visual Exclusivo';

    return [
      `Adorei o ponto de partida${name}! Vamos transformar sua mensagem em uma proposta visual forte para o **Llewxam**:`,
      '',
      `• **Peça Recomendada:** ${pieceType}`,
      `• **Direção de Estilo:** Composição com foco central bem iluminado, contraste profundo no fundo e acabamento limpo de alto impacto.`,
      `• **Sugestão de Cores:** Base escura elegante combinada com 2 cores vibrantes de destaque para guiar o olhar direto para o tema principal (*"${userMessage.slice(0, 80)}"*).`,
      `• **Briefing Pronto para o Designer:**`,
      `> *"Quero encomendar um ${pieceType} inspirado em: ${userMessage.slice(0, 140)}. Busco iluminação marcante, tipografia integrada e destaque para o elemento central."*`,
      '',
      `✨ **Quer ajustar as cores ou o estilo?** Me diga quais cores você mais gosta ou clique em **Abrir Orçamento com Esta Ideia** aqui embaixo!`,
    ].join('\n');
  }

  if (/oi|olá|ola|bom dia|boa tarde|boa noite|opa|eai|e aí/i.test(lower)) {
    return `Oi${name}! ✨ Tudo ótimo por aqui no estúdio **LWX Lab**! Eu sou a **Silia AI** *(piscadinha dourada)* — pode conversar comigo sobre o que quiser ou me contar qualquer ideia que esteja passando pela sua cabeça! Como está seu dia?`;
  }

  if (/preço|preco|valor|quanto custa|barato|orçamento|orcamento/i.test(lower)) {
    return `Os valores aqui no **LWX Lab** estão super acessíveis${name}! ✨ Olha só:\n• **Barrinha/Divisória:** a partir de **R$ 10**\n• **Banner & Header HD:** a partir de **R$ 20**\n• **Logo & Identidade:** a partir de **R$ 30**\n• **Ilustração & OC:** a partir de **R$ 35**\n• **Pack Visual do Servidor:** a partir de **R$ 55**\n\nSe quiser, clique em **Aprimorar Ideia com Silia AI** e eu te ajudo a montar seu briefing agora mesmo!`;
  }

  return `Que legal você comentar sobre isso${name}! ✨ Eu adoro trocar ideia aqui no **LWX Lab**. Me conta mais sobre o que você está pensando — seja pra bater um papo descontraído ou pra gente criar algo incrível juntos!`;
}

async function askGeminiWithPrompt(systemPrompt: string, fullPrompt: string) {
  let lastError: unknown;

  for (const modelName of getGeminiModelCandidates()) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
      });
      const result = await model.generateContent(fullPrompt);

      return result.response.text();
    } catch (error) {
      lastError = error;
      console.error(`Gemini falhou com o modelo ${modelName}.`);

      if (!isMissingGeminiModelError(error)) break;
    }
  }

  throw lastError;
}

async function askFreeRealtimeLLM(
  systemPrompt: string,
  userMessage: string,
  history: SiliaHistoryTurn[] = [],
  mode: SiliaMode = 'chat',
): Promise<string> {
  const modelsToTry = ['openai', 'mistral'];
  let lastErr: unknown;

  for (const model of modelsToTry) {
    try {
      const response = await fetch('https://text.pollinations.ai/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...history.slice(-6).map((h) => ({ role: h.role, content: h.content })),
            { role: 'user', content: userMessage },
          ],
          temperature: mode === 'ideate' ? 0.75 : 0.85,
        }),
      });

      if (!response.ok) {
        throw new Error(`Free LLM (${model}) HTTP ${response.status}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const rawContent = data.choices?.[0]?.message?.content?.trim();
      if (!rawContent) {
        throw new Error(`Empty response from Free LLM (${model})`);
      }

      const cleaned = rawContent
        .split(/\n---\s*\n|\n\*?Support Pollinations/i)[0]
        ?.trim();

      return cleaned || rawContent;
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr;
}

export async function askSiliaAI(
  userMessage: string,
  mode: SiliaMode = 'chat',
  userName?: string,
  history: SiliaHistoryTurn[] = [],
): Promise<string> {
  const systemPrompt = mode === 'ideate' ? SILIA_IDEATE_PROMPT : SILIA_CHAT_PROMPT;
  const userTag = userName ? `[Usuário: ${userName}] ${userMessage}` : userMessage;

  // 1. Try OpenAI if a real key is configured
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'missing-openai-key') {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...history.slice(-6).map((h) => ({ role: h.role, content: h.content })),
          { role: 'user', content: userTag },
        ],
        max_tokens: 450,
        temperature: mode === 'ideate' ? 0.75 : 0.85,
      });

      const text = response.choices[0]?.message.content?.trim();
      if (text) return text;
    } catch (err) {
      console.warn('OpenAI falhou, tentando próximo provedor:', err instanceof Error ? err.message : err);
    }
  }

  // 2. Try Gemini if a real key is configured
  if (process.env.GEMINI_API_KEY) {
    try {
      const transcript = [
        ...history.slice(-6).map((h) => `${h.role === 'user' ? 'Usuário' : 'Silia AI'}: ${h.content}`),
        `Usuário: ${userTag}`,
      ].join('\n\n');
      const text = (await askGeminiWithPrompt(systemPrompt, transcript)).trim();
      if (text) return text;
    } catch (err) {
      console.warn('Gemini falhou, tentando provedor gratuito em tempo real:', err instanceof Error ? err.message : err);
    }
  }

  // 3. Use real-time keyless OpenAI-compatible LLM so Silia AI works dynamically without requiring paid keys
  try {
    return await askFreeRealtimeLLM(systemPrompt, userTag, history, mode);
  } catch (freeErr) {
    console.error('Provedor gratuito falhou, usando fallback contextual:', freeErr instanceof Error ? freeErr.message : freeErr);
    return buildSmartSiliaFallback(userMessage, mode, userName);
  }
}

export async function askAI(userMessage: string): Promise<string> {
  return askSiliaAI(userMessage, 'chat');
}

export async function askStudioAssistant(question: string, userName?: string): Promise<string> {
  return askSiliaAI(question, 'chat', userName);
}
