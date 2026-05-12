import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_MODEL_FALLBACKS = [DEFAULT_GEMINI_MODEL, 'gemini-flash-latest', 'gemini-2.0-flash'];

const SYSTEM_PROMPT = `Voce e a IA do LWX Lab: divertida, curiosa, direta e boa em pesquisar, explicar, brainstormar e conversar com usuarios no Discord.
Seu papel principal e entreter e ajudar, como uma IA geral de chat.
Regras:
1. Responda em portugues do Brasil por padrao, de forma clara e compacta.
2. Pode ser descontraida, mas sem exagerar e sem fingir informacoes.
3. Se perguntarem sobre comprar design, preco, portfolio ou contratar o Llew, direcione para os paineis fixos do servidor ou para abrir ticket.
4. Se nao souber algo, diga isso e ofereca um caminho de pesquisa.
5. Evite blocos gigantes; prefira respostas boas para leitura no Discord.`;

export function getGeminiModelCandidates(configuredModel = process.env.GEMINI_MODEL) {
  return [configuredModel, ...GEMINI_MODEL_FALLBACKS].filter(
    (model, index, models): model is string => Boolean(model) && models.indexOf(model) === index,
  );
}

export function isMissingGeminiModelError(error: unknown) {
  const maybeError = error as { status?: number; message?: string } | undefined;
  return maybeError?.status === 404 || /models\/.+ is not found/i.test(maybeError?.message || '');
}

async function askGemini(userMessage: string) {
  let lastError: unknown;

  for (const modelName of getGeminiModelCandidates()) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_PROMPT,
      });
      const result = await model.generateContent(userMessage);

      return result.response.text();
    } catch (error) {
      lastError = error;
      console.error(`Gemini falhou com o modelo ${modelName}.`);

      if (!isMissingGeminiModelError(error)) break;
    }
  }

  throw lastError;
}

export async function askAI(userMessage: string): Promise<string> {
  try {
    console.log('Tentando ChatGPT...');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 350,
      temperature: 0.8,
    });

    return response.choices[0]?.message.content || 'Nao consegui processar a resposta.';
  } catch (error) {
    console.error('ChatGPT falhou (possivel erro de cota ou conexao). Tentando Gemini...');

    try {
      return await askGemini(userMessage);
    } catch (geminiError) {
      console.error('Gemini tambem falhou:', geminiError);
      return 'Minha central ficou sem energia por um instante. Tenta de novo daqui a pouco.';
    }
  }
}
