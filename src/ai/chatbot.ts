import dotenv from 'dotenv';
import { getPromptForTask } from '../silia/knowledgeRag.js';
import { callSiliaModelRouter } from '../silia/modelRouter.js';
import type { SiliaHistoryTurn, SiliaMode } from '../silia/types.js';

dotenv.config();

export type { SiliaHistoryTurn, SiliaMode };

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_MODEL_FALLBACKS = [
  DEFAULT_GEMINI_MODEL,
  'gemini-flash-latest',
  'gemini-2.0-flash',
];

export function getGeminiModelCandidates(configuredModel = process.env.GEMINI_MODEL) {
  return [configuredModel, ...GEMINI_MODEL_FALLBACKS].filter(
    (model, index, models): model is string => Boolean(model) && models.indexOf(model) === index,
  );
}

export function isMissingGeminiModelError(error: unknown) {
  const maybeError = error as { status?: number; message?: string } | undefined;
  return maybeError?.status === 404 || /models\/.+ is not found/i.test(maybeError?.message || '');
}

export function buildSmartSiliaFallback(
  userMessage: string,
  mode: SiliaMode,
  userName?: string,
): string {
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
      `• **Sugestão de Cores:** Base escura elegante (\`#161024\`) combinada com Royal Violet (\`#8B5CF6\`) e Soul-Fire Cyan (\`#52B7FF\`) para guiar o olhar direto para o tema principal (*"${userMessage.slice(0, 80)}"*).`,
      `• **Briefing Pronto para o Designer:**`,
      `> *"Quero encomendar um ${pieceType} inspirado em: ${userMessage.slice(0, 140)}. Busco iluminação marcante, tipografia integrada e destaque para o elemento central."*`,
      '',
      `✨ **Quer ajustar as cores ou o estilo?** Use os botões de decisão abaixo ou clique em **Abrir Orçamento com Esta Ideia**!`,
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

export async function askSiliaAI(
  userMessage: string,
  mode: SiliaMode = 'chat',
  userName?: string,
  history: SiliaHistoryTurn[] = [],
): Promise<string> {
  const systemPrompt = getPromptForTask(mode === 'ideate' ? 'discovery' : 'chat');
  const userTag = userName ? `[Usuário: ${userName}] ${userMessage}` : userMessage;

  try {
    const result = await callSiliaModelRouter({
      task: mode === 'ideate' ? 'discovery' : 'chat',
      systemPrompt,
      userPrompt: userTag,
      history,
    });
    return result.text;
  } catch (err) {
    console.warn(
      '[SiliaAI] Router usou fallback local:',
      err instanceof Error ? err.message : String(err),
    );
    return buildSmartSiliaFallback(userMessage, mode, userName);
  }
}

export async function askAI(userMessage: string): Promise<string> {
  return askSiliaAI(userMessage, 'chat');
}

export async function askStudioAssistant(question: string, userName?: string): Promise<string> {
  return askSiliaAI(question, 'chat', userName);
}
