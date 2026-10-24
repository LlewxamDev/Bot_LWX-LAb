import {
  getPromptForTask,
  loadFewShotExamples,
  retrieveRelevantKnowledge,
} from './knowledgeRag.js';
import { callSiliaModelRouter } from './modelRouter.js';
import {
  CREATIVE_PROPOSAL_JSON_SCHEMA,
  validateAndNormalizeProposal,
} from './schema.js';
import type {
  ColorSwatchSpec,
  CreativeProposal,
  DiscoveryState,
  ProjectCategory,
  RejectionDimension,
  SiliaCreativeSession,
} from './types.js';
import { gatherVerifiedVisualReferences } from './visualSearch.js';

export function detectProjectCategory(text: string): {
  category: ProjectCategory;
  label: string;
} | null {
  const lower = text.toLowerCase();
  if (/banner|header|capa|perfil|youtube|twitch/i.test(lower)) {
    return { category: 'banner', label: 'Banner / Header HD' };
  }
  if (/logo|marca|icone|ícone|brasao|brasão|emblema/i.test(lower)) {
    return { category: 'logo', label: 'Logo & Identidade Visual' };
  }
  if (/ilustra|personagem|\boc\b|desenho|anime|retrato|arte autoral/i.test(lower)) {
    return { category: 'illustration', label: 'Ilustração Autoral / OC' };
  }
  if (/pack|kit|servidor completo|identidade do servidor|barrinha/i.test(lower)) {
    return { category: 'pack', label: 'Pack Visual Completo para Servidor' };
  }
  if (/thumb|thumbnail|miniatura/i.test(lower)) {
    return { category: 'thumbnail', label: 'Thumbnail de Alto Impacto' };
  }
  if (/bot|site|interface|ui|dashboard|painel/i.test(lower)) {
    return { category: 'ui_bot_site', label: 'Design de Interface / Bot / Site' };
  }
  return null;
}

/**
 * Updates the session's DiscoveryState from the latest user message without losing previous answers,
 * and determines whether we have enough information to build a full CreativeProposal.
 */
export function updateDiscoveryFromMessage(
  session: SiliaCreativeSession,
  userMessage: string,
): DiscoveryState {
  const disc = session.discovery;
  const text = userMessage.trim();
  const lower = text.toLowerCase();

  // Extract URLs if the client provided reference links
  const urls = text.match(/https?:\/\/[^\s<>)]+/gi) ?? [];
  for (const u of urls) {
    if (!disc.clientProvidedReferences.includes(u)) {
      disc.clientProvidedReferences.push(u);
    }
  }

  // Detect project type
  const detectedType = detectProjectCategory(text);
  if (detectedType && !disc.projectType) {
    disc.projectType = detectedType.category;
    disc.projectTypeLabel = detectedType.label;
  }

  // Detect style / mood keywords
  if (
    /dark|sombri|neon|cyber|anime|minimal|luxo|medieval|cavaleiro|fogo|glitch|futurist|esport|clean|retro|fantasia|misteri|vibrante/i.test(
      lower,
    )
  ) {
    disc.visualStyleOrMood = disc.visualStyleOrMood
      ? `${disc.visualStyleOrMood}; ${text.slice(0, 140)}`
      : text.slice(0, 140);
  }

  // Detect color preferences
  if (
    /roxo|violeta|azul|ciano|vermelho|rosa|dourado|ouro|preto|branco|verde|laranja|prata|#[0-9a-f]{6}/i.test(
      lower,
    )
  ) {
    disc.colorPreferences = disc.colorPreferences
      ? `${disc.colorPreferences}; ${text.slice(0, 120)}`
      : text.slice(0, 120);
  }

  // Detect main text / name / title
  const nameMatch = text.match(
    /(?:chamado|nome|texto|título|titulo|escrito|servidor|marca)\s+["'“”]?([A-Za-z0-9À-ÿ\s_-]{2,36})["'“”]?/i,
  );
  if (nameMatch?.[1]) {
    disc.mainTextOrHeadline = nameMatch[1].trim();
  }

  // Detect central subject
  if (text.length >= 15) {
    disc.centralSubject = disc.centralSubject
      ? `${disc.centralSubject} | ${text.slice(0, 180)}`
      : text.slice(0, 180);
  }

  // Check if client explicitly wants Silia to decide ("escolhe você", "pode sugerir", "tanto faz", "surpreenda")
  const clientDelegated =
    /escolhe voc[eê]|pode escolher|tanto faz|voc[eê] decide|surpreend|pode criar|gera a proposta|pode montar|nao sei/i.test(
      lower,
    );

  // Determine if we have enough context or if we should ask 1 quick round of adaptive discovery
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const hasRichInitialPrompt =
    Boolean(disc.projectType) && (Boolean(disc.visualStyleOrMood) || Boolean(disc.colorPreferences) || wordCount >= 10);

  if (clientDelegated || hasRichInitialPrompt || disc.questionsAskedCount >= 1) {
    if (!disc.projectType) {
      disc.projectType = 'banner';
      disc.projectTypeLabel = 'Banner / Header HD';
    }
    disc.readyForProposal = true;
  } else {
    disc.readyForProposal = false;
  }

  return disc;
}

/**
 * Generates a short, warm, non-bureaucratic discovery reply asking only what is actually missing.
 */
export function buildAdaptiveDiscoveryQuestions(
  session: SiliaCreativeSession,
  displayName: string,
): string {
  const disc = session.discovery;
  disc.questionsAskedCount += 1;

  const missingQuestions: string[] = [];
  if (!disc.projectType) {
    missingQuestions.push(
      `1️⃣ **Qual peça você quer criar?** *(Ex.: Banner para servidor/perfil, Logo, Ilustração/OC ou Pack completo)*`,
    );
  }
  if (!disc.visualStyleOrMood && !disc.colorPreferences) {
    missingQuestions.push(
      `${missingQuestions.length + 1}️⃣ **Qual clima e cores você mais curte?** *(Ex.: Dark com fogo azul, Roxo neon futurista, Anime vibrante ou Minimalista elegante)*`,
    );
  }
  if (!disc.mainTextOrHeadline) {
    missingQuestions.push(
      `${missingQuestions.length + 1}️⃣ **Qual nome ou texto principal deve aparecer em destaque?** *(Ou prefere a arte sem texto?)*`,
    );
  }

  const questionsToAsk = missingQuestions.slice(0, 3);
  const typeIntro = disc.projectTypeLabel
    ? `Já anotei que vamos criar um **${disc.projectTypeLabel}** incrível para você, **${displayName}**!`
    : `Adorei começar esse projeto com você, **${displayName}**!`;

  return [
    `${typeIntro} *(piscadinha dourada ✨)*`,
    'Para eu já montar uma **Proposta de Direção Criativa completa** com paleta de cores HEX, tipografia, composição e referências visuais, me conta rapidinho:',
    '',
    ...questionsToAsk,
    '',
    '-# 💡 *Se ainda estiver em dúvida sobre algum detalhe, pode dizer "escolhe por mim" que eu crio uma direção completa para você avaliar!*',
  ].join('\n');
}

interface ArchetypePreset {
  styleName: string;
  moodKeywords: string[];
  styleDirection: string;
  narrativeJustification: string;
  palette: ColorSwatchSpec[];
  titleFont: string;
  subtitleFont: string;
  lighting: string;
  focalX: number;
  focalY: number;
  readingFlow: string;
  whyDistinct: string;
}

const ARCHETYPE_PRESETS: ArchetypePreset[] = [
  {
    styleName: 'Dark-Glitch & Soul-Fire Heroico',
    moodKeywords: ['Sombrio', 'Heroico', 'Soul-Fire', 'Alto Contraste', 'Imersivo'],
    styleDirection:
      'Estética Dark-Fantasy moderna com base obsidiana profunda, iluminação volumétrica violeta e recorte de chamas ciano nas bordas do elemento central.',
    narrativeJustification:
      'Cria autoridade visual imediata no Discord com contraste 12:1 entre o protagonista iluminado e o fundo escuro atmosférico.',
    palette: [
      {
        name: 'Obsidian Void',
        hex: '#161024',
        rgb: { r: 22, g: 16, b: 36 },
        role: 'neutra_fundo',
        proportionPct: 45,
        psychology: 'Profundidade misteriosa e base de contraste absoluto',
        usage: 'Fundo principal, vinheta periférica e atmosfera de 3º plano',
      },
      {
        name: 'Royal Violet',
        hex: '#8B5CF6',
        rgb: { r: 139, g: 92, b: 246 },
        role: 'dominante',
        proportionPct: 25,
        psychology: 'Nobreza criativa, magia arcana e identidade marcante',
        usage: 'Luz principal (key light), armadura/formas centrais e molduras',
      },
      {
        name: 'Soul-Fire Cyan',
        hex: '#52B7FF',
        rgb: { r: 82, g: 183, b: 255 },
        role: 'secundaria',
        proportionPct: 15,
        psychology: 'Energia dinâmica, nitidez tecnológica e foco',
        usage: 'Rim light (luz de recorte lateral), chamas etéreas e partículas',
      },
      {
        name: 'Crimson Rose',
        hex: '#D6456B',
        rgb: { r: 214, g: 69, b: 107 },
        role: 'acento',
        proportionPct: 10,
        psychology: 'Tensão dramática e ponto focal magnético',
        usage: 'Olhos, insígnias, detalhes de energia e selos de destaque',
      },
      {
        name: 'Ice Core White',
        hex: '#F4F8FF',
        rgb: { r: 244, g: 248, b: 255 },
        role: 'neutra_texto',
        proportionPct: 5,
        psychology: 'Clareza máxima e leitura instantânea',
        usage: 'Headline principal e brilhos especulares intensos',
      },
    ],
    titleFont: 'Cinzel Decorative Bold / Montserrat ExtraBold',
    subtitleFont: 'Plus Jakarta Sans SemiBold',
    lighting:
      'Key light violeta a 45° no topo, rim light ciano intensa recortando a silhueta e vinheta obsidiana nas bordas.',
    focalX: 50,
    focalY: 42,
    readingFlow:
      'Centro-Radial Simétrico: o olhar captura o protagonista iluminado no centro e desce para o título em destaque.',
    whyDistinct: 'Direção inaugural focada em simetria heroica e contraste violeta/ciano.',
  },
  {
    styleName: 'Cyber-Gold & Neo-Editorial Assimétrico',
    moodKeywords: ['Luxo Imperial', 'Cyber-Gold', 'Assimétrico', 'Agressivo', 'Premium'],
    styleDirection:
      'Composição editorial assimétrica (Regra dos Terços) combinando preto carbono fosco, ouro solar metálico e luzes de recorte âmbar/branco quente.',
    narrativeJustification:
      'Abandona o tom frio anterior para entregar uma presença de prestígio, calor cromático e dinamismo diagonal.',
    palette: [
      {
        name: 'Carbon Matte',
        hex: '#0F1115',
        rgb: { r: 15, g: 17, b: 21 },
        role: 'neutra_fundo',
        proportionPct: 50,
        psychology: 'Sofisticação, peso industrial e sobriedade',
        usage: 'Fundo geométrico fosco com grid técnico sutil',
      },
      {
        name: 'Imperial Solar Gold',
        hex: '#F59E0B',
        rgb: { r: 245, g: 158, b: 11 },
        role: 'dominante',
        proportionPct: 25,
        psychology: 'Prestígio, vitória, exclusividade e poder',
        usage: 'Elementos principais de destaque, reflexos metálicos e barras de hierarquia',
      },
      {
        name: 'Amber Blaze',
        hex: '#EA580C',
        rgb: { r: 234, g: 88, b: 12 },
        role: 'secundaria',
        proportionPct: 12,
        psychology: 'Calor intenso, ação e movimento',
        usage: 'Gradientes de luz secundária e profundidade atmosférica',
      },
      {
        name: 'Platinum Ice',
        hex: '#E2E8F0',
        rgb: { r: 226, g: 232, b: 240 },
        role: 'acento',
        proportionPct: 8,
        psychology: 'Equilíbrio metálico e acabamento cirúrgico',
        usage: 'Contornos finos, divisórias e detalhes técnicos',
      },
      {
        name: 'Pure Titanium',
        hex: '#FFFFFF',
        rgb: { r: 255, g: 255, b: 255 },
        role: 'neutra_texto',
        proportionPct: 5,
        psychology: 'Nitidez absoluta',
        usage: 'Tipografia principal em alto relevo luminoso',
      },
    ],
    titleFont: 'Montserrat Black Italic / Bebas Neue Pro',
    subtitleFont: 'Inter Bold (Tracking +10%)',
    lighting:
      'Iluminação lateral dramática (split lighting) em ouro quente com reflexos metálicos especulares e fundo carbono limpo.',
    focalX: 66,
    focalY: 45,
    readingFlow:
      'Padrão Z Assimétrico: título forte ancorado à esquerda (X:28%) equilibrado pelo sujeito principal à direita (X:66%).',
    whyDistinct:
      'Substitui completamente a composição centralizada e a paleta fria por um layout assimétrico em Regra dos Terços com harmonia Carbono & Ouro Imperial.',
  },
  {
    styleName: 'Crimson Eclipse & Minimalismo Brutalista',
    moodKeywords: ['Impacto Brutal', 'Carmesim', 'Minimalista', 'Alto Contraste', 'Autoral'],
    styleDirection:
      'Direção de arte inspirada em pôsteres neo-brutalistas e estética dark-anime: silhueta gráfica ultra-limpa sobre atmosfera vermelho-eclipse e marfim.',
    narrativeJustification:
      'Elimina excesso de partículas para focar 100% em silhueta icônica, tipografia monumental em plano médio e tensão cromática vermelho/preto/marfim.',
    palette: [
      {
        name: 'Abyssal Onyx',
        hex: '#09090B',
        rgb: { r: 9, g: 9, b: 11 },
        role: 'neutra_fundo',
        proportionPct: 48,
        psychology: 'Silêncio visual e contraste dramático extremo',
        usage: 'Espaço negativo amplo e sombras sólidas',
      },
      {
        name: 'Crimson Eclipse',
        hex: '#E11D48',
        rgb: { r: 225, g: 29, b: 72 },
        role: 'dominante',
        proportionPct: 27,
        psychology: 'Adrenalina, paixão, urgência e presença inesquecível',
        usage: 'Halo circular/geométrico de fundo e luz de recorte principal',
      },
      {
        name: 'Blood Garnet',
        hex: '#881337',
        rgb: { r: 136, g: 19, b: 55 },
        role: 'secundaria',
        proportionPct: 12,
        psychology: 'Densidade dramática e transição tonal',
        usage: 'Sombras coloridas no plano médio e texturas sutis',
      },
      {
        name: 'Electric Cyan Spark',
        hex: '#22D3EE',
        rgb: { r: 34, g: 211, b: 238 },
        role: 'acento',
        proportionPct: 5,
        psychology: 'Contraste complementar cirúrgico',
        usage: 'Micro-acento focal nos olhos ou insígnia central',
      },
      {
        name: 'Warm Ivory',
        hex: '#FAF8F5',
        rgb: { r: 250, g: 248, b: 245 },
        role: 'neutra_texto',
        proportionPct: 8,
        psychology: 'Leitura editorial clássica sem fadiga ocular',
        usage: 'Tipografia monumental e assinaturas secundárias',
      },
    ],
    titleFont: 'Playfair Display Black / Anton Regular',
    subtitleFont: 'Space Grotesk Medium',
    lighting:
      'Backlight (contra-luz) carmesim intenso formando silhueta recortada de alto impacto com sombras marcadas.',
    focalX: 38,
    focalY: 48,
    readingFlow:
      'Diagonal Ascendente: olhar entra pelo bloco tipográfico monumental e sobe pela linha de ação do elemento central.',
    whyDistinct:
      'Muda radicalmente para uma estética de pôster gráfico com contra-luz Carmesim Eclipse, espaço negativo amplo e tipografia monumental.',
  },
  {
    styleName: 'Emerald Arcane & Atmosfera Cinematográfica',
    moodKeywords: ['Místico', 'Esmeralda', 'Cinematográfico', 'Profundidade', 'Elegante'],
    styleDirection:
      'Composição cinematográfica widescreen em camadas profundas combinando verde-esmeralda arcano, turquesa bioluminescente e detalhes em ouro pálido.',
    narrativeJustification:
      'Oferece uma atmosfera mística e refrescante, com separação de 3 planos de profundidade de campo (bokeh suave) e tipografia elegante.',
    palette: [
      {
        name: 'Deep Forest Night',
        hex: '#061612',
        rgb: { r: 6, g: 22, b: 18 },
        role: 'neutra_fundo',
        proportionPct: 45,
        psychology: 'Mistério orgânico e imersão profunda',
        usage: 'Fundo cinematográfico desfocado',
      },
      {
        name: 'Arcane Emerald',
        hex: '#10B981',
        rgb: { r: 16, g: 185, b: 129 },
        role: 'dominante',
        proportionPct: 26,
        psychology: 'Vitalidade mágica, originalidade e harmonia',
        usage: 'Iluminação principal e energia ao redor do sujeito',
      },
      {
        name: 'Bioluminescent Teal',
        hex: '#14B8A6',
        rgb: { r: 20, g: 184, b: 166 },
        role: 'secundaria',
        proportionPct: 14,
        psychology: 'Serenidade tecnológica e brilho etéreo',
        usage: 'Luzes de preenchimento e atmosfera no plano médio',
      },
      {
        name: 'Pale Alchemy Gold',
        hex: '#FDE68A',
        rgb: { r: 253, g: 230, b: 138 },
        role: 'acento',
        proportionPct: 8,
        psychology: 'Toque de realeza e raridade',
        usage: 'Detalhes de ornamento e partículas douradas em 1º plano',
      },
      {
        name: 'Mint Alabaster',
        hex: '#ECFDF5',
        rgb: { r: 236, g: 253, b: 245 },
        role: 'neutra_texto',
        proportionPct: 7,
        psychology: 'Nitidez suave e sofisticada',
        usage: 'Título principal e subtítulos',
      },
    ],
    titleFont: 'Cinzel Bold / Plus Jakarta Sans ExtraBold',
    subtitleFont: 'Inter SemiBold',
    lighting:
      'Iluminação volumétrica bioluminescente vinda de baixo/frente com partículas douradas em bokeh no primeiro plano.',
    focalX: 50,
    focalY: 40,
    readingFlow:
      'Camadas de Profundidade (1º, 2º e 3º planos): moldura de bokeh guia o olhar para o centro iluminado e título inferior.',
    whyDistinct:
      'Apresenta uma quarta rota estética totalmente nova baseada em atmosfera cinematográfica Esmeralda & Ouro Pálido com profundidade de campo em três planos.',
  },
];

function buildArchetypeFallbackProposal(
  session: SiliaCreativeSession,
  attemptNumber: number,
  diagnosticFocus?: RejectionDimension,
): Partial<CreativeProposal> {
  const preset = ARCHETYPE_PRESETS[(attemptNumber - 1) % ARCHETYPE_PRESETS.length]!;
  const disc = session.discovery;
  const projectType = disc.projectType || 'banner';
  const projectTypeLabel = disc.projectTypeLabel || 'Banner / Header HD';
  const headline = disc.mainTextOrHeadline || session.username || 'LWX Lab Project';
  const subject = disc.centralSubject || 'Elemento principal personalizado conforme pedido do cliente';

  const confirmed: string[] = [`Tipo de peça solicitada: ${projectTypeLabel}`];
  if (disc.mainTextOrHeadline) {
    confirmed.push(`Texto / Nome em destaque confirmado: "${disc.mainTextOrHeadline}"`);
  }
  if (disc.visualStyleOrMood) {
    confirmed.push(`Preferência de estilo/clima informada: ${disc.visualStyleOrMood}`);
  }
  if (disc.colorPreferences) {
    confirmed.push(`Preferência cromática informada: ${disc.colorPreferences}`);
  }
  if (disc.centralSubject) {
    confirmed.push(`Contexto/tema central descrito: ${disc.centralSubject}`);
  }

  let whyDistinct = attemptNumber > 1 ? preset.whyDistinct : undefined;
  if (diagnosticFocus && diagnosticFocus !== 'unspecified') {
    whyDistinct = `Rota recalibrada após diagnóstico criativo com foco específico em transformar **${diagnosticFocus.toUpperCase()}**: ${preset.whyDistinct}`;
  }

  return {
    projectType,
    projectTypeLabel,
    title: `${headline} • Direção ${preset.styleName}`,
    objective: `Desenvolver um ${projectTypeLabel} de alto impacto para ${session.username}, unindo identidade autoral, hierarquia de leitura imediata e acabamento de estúdio.`,
    targetAudienceAndChannel:
      disc.objectiveAndChannel || 'Discord / Comunidade Digital (otimizado para visualização em Desktop e Mobile)',
    creativeConcept: {
      summary: `${preset.styleDirection} Aplicado ao tema: ${subject}.`,
      moodKeywords: preset.moodKeywords,
      styleDirection: preset.styleName,
      narrativeJustification: preset.narrativeJustification,
    },
    palette: preset.palette,
    typography: {
      titleFont: preset.titleFont,
      subtitleFont: preset.subtitleFont,
      bodyFont: 'Inter Medium',
      hierarchyRule:
        'Headline principal com escala dominante (25% da área útil) e contraste mínimo de 10:1 contra o fundo; subtítulo em 45% da escala do título.',
      weightAndTracking:
        'Título em peso ExtraBold/Black com tracking +4%; subtítulo em SemiBold com tracking +8% em caixa alta.',
      contrastNote:
        'Base escura controlada atrás do texto com drop-shadow suave (0px 8px 24px) e rim-glow sutil nas letras.',
      justification: `A combinação entre ${preset.titleFont} e ${preset.subtitleFont} reforça a estética ${preset.styleName} mantendo leitura perfeita até em miniaturas de celular.`,
    },
    composition: {
      aspectRatio: projectType === 'logo' ? '1:1 (1024x1024px)' : '16:9 (1920x1080px)',
      focalPoint: {
        xPct: preset.focalX,
        yPct: preset.focalY,
        label: `Protagonista (${headline}) + Iluminação Principal`,
      },
      zones: [
        {
          label: 'Plano de Fundo Atmosférico (3º Plano)',
          xPct: 5,
          yPct: 5,
          wPct: 90,
          hPct: 90,
          role: 'Ambiente temático com desfoque suave para não competir com a leitura',
        },
        {
          label: 'Zona Focal do Protagonista (2º Plano)',
          xPct: Math.max(12, preset.focalX - 20),
          yPct: 12,
          wPct: 42,
          hPct: 74,
          role: 'Elemento principal com nitidez máxima e rim light de recorte',
        },
        {
          label: 'Bloco Tipográfico & Assinatura',
          xPct: preset.focalX > 55 ? 10 : 22,
          yPct: preset.focalX > 55 ? 32 : 66,
          wPct: preset.focalX > 55 ? 42 : 56,
          hPct: 24,
          role: `Exibição cristalina do título "${headline}" com respiro ao redor`,
        },
      ],
      readingFlow: preset.readingFlow,
      safeMarginPct: 8,
      contrastStrategy:
        'Separação tonal clara entre planos usando vinheta periférica de 30% e luz de recorte nas bordas do sujeito principal.',
    },
    visualTreatment: {
      lighting: preset.lighting,
      depthAndTexture:
        'Três planos distintos (foreground com partículas sutis em bokeh, midground 100% nítido, background com desfoque atmosférico f/2.8).',
      specialEffects:
        'Iluminação volumétrica controlada, brilhos especulares nos pontos de acento e correção de cor final.',
      finishLevel: 'Acabamento premium LWX Lab em alta definição, bordas limpas e nitidez otimizada.',
    },
    visualScript: [
      {
        order: 1,
        plane: 'plano_de_fundo',
        element: `Cenário temático em estética ${preset.styleName} com profundidade suave`,
        placement: 'Extensão total do canvas respeitando vinheta periférica',
        lightingAndFocus: 'Foco suavizado (gaussian blur 6px) e iluminação indireta na cor dominante',
        purpose: 'Contextualizar o universo visual sem criar ruído atrás do texto',
      },
      {
        order: 2,
        plane: 'plano_medio',
        element: `Elemento central inspirado em: ${subject}`,
        placement: `Posicionado no ponto focal (X:${preset.focalX}%, Y:${preset.focalY}%)`,
        lightingAndFocus: `Nitidez máxima + ${preset.lighting}`,
        purpose: 'Atrair o olhar nos primeiros 0,5 segundos de visualização',
      },
      {
        order: 3,
        plane: 'efeitos_tipografia',
        element: `Tipografia principal "${headline}" em ${preset.titleFont}`,
        placement: preset.focalX > 55 ? 'Terço esquerdo equilibrando o sujeito' : 'Terço inferior centralizado',
        lightingAndFocus: 'Alto contraste sobre sombra projetada suave e brilho especular controlado',
        purpose: 'Garantir leitura instantânea da marca/nome em desktop e mobile',
      },
      {
        order: 4,
        plane: 'primeiro_plano',
        element: 'Partículas sutis de profundidade e acabamento de luz atmosférica',
        placement: 'Bordas extremas fora da zona de leitura tipográfica',
        lightingAndFocus: 'Desfoque de primeiro plano (foreground bokeh) com opacidade 35%',
        purpose: 'Criar sensação tridimensional de câmera profissional',
      },
    ],
    confirmedRequirements: confirmed,
    assumptionsMade: [
      'Margem segura interna de 8% aplicada para evitar cortes da interface do Discord',
      `Proporção padrão ${projectType === 'logo' ? '1:1 (1024x1024px)' : '16:9 (1920x1080px)'} adotada para máxima compatibilidade`,
      'Contraste ajustado para leitura limpa tanto no tema escuro quanto claro',
    ],
    outOfScope: [
      'Animação frame-a-frame complexa caso não seja contratada à parte',
      'Peças avulsas adicionais não listadas no tipo de projeto principal',
    ],
    verifiableApprovalCriteria: [
      `O título "${headline}" deve permanecer 100% legível mesmo com zoom reduzido a 25%`,
      `A paleta deve seguir os códigos HEX aprovados (${preset.palette.map((p) => p.hex).join(', ')})`,
      'O elemento central deve apresentar separação clara do fundo através de rim light',
    ],
    whyDistinctFromPrevious: whyDistinct,
  };
}

function tryParseJsonObject(rawText: string): Partial<CreativeProposal> | null {
  try {
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as Partial<CreativeProposal>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generates a complete, validated CreativeProposal with verified visual references,
 * palette swatches, typography, composition diagram, and visual script.
 */
export async function generateStructuredCreativeProposal(
  session: SiliaCreativeSession,
  diagnosticFocus?: RejectionDimension,
  clientFeedback?: string,
): Promise<CreativeProposal> {
  const attemptNumber = session.proposals.length + 1;
  const proposalId = `PROP-${session.userId.slice(-4)}-${attemptNumber}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

  // Mark any previous pending proposals as superseded
  for (const prev of session.proposals) {
    if (prev.status === 'pending') {
      prev.status = 'superseded';
    }
  }

  const ragChunks = retrieveRelevantKnowledge(
    `${session.discovery.centralSubject || ''} ${session.discovery.visualStyleOrMood || ''}`,
    session.discovery.projectType,
    3,
  );
  const fewShotText = loadFewShotExamples(session.discovery.projectType);
  const taskType =
    attemptNumber >= 3 && diagnosticFocus
      ? 'diagnostic'
      : attemptNumber > 1
        ? 'revision'
        : 'proposal';

  const baseSystemPrompt = getPromptForTask(taskType);
  const systemPrompt = [
    baseSystemPrompt,
    '',
    '## Conhecimento Recuperado do Playbook Oficial (RAG):',
    ...ragChunks.map((c) => `### ${c.heading}\n${c.content}`),
    '',
    fewShotText,
    '',
    'IMPORTANTE: Retorne EXCLUSIVAMENTE um objeto JSON válido seguindo o schema solicitado.',
  ].join('\n');

  const previousSummaries = session.proposals.map(
    (p) =>
      `Tentativa #${p.attemptNumber} ("${p.title}"): Estilo=${p.creativeConcept.styleDirection} | Cores=${p.palette.map((c) => c.hex).join(', ')}`,
  );

  const userPrompt = [
    `Cliente: ${session.username}`,
    `Tentativa Atual: #${attemptNumber}`,
    `Tipo de Projeto: ${session.discovery.projectTypeLabel || 'Banner / Header HD'}`,
    `Resumo do Pedido: ${session.discovery.centralSubject || 'Peça personalizada LWX Lab'}`,
    `Estilo/Clima Desejado: ${session.discovery.visualStyleOrMood || 'Aberto à direção criativa da Silia AI'}`,
    `Preferências de Cor: ${session.discovery.colorPreferences || 'Sugerir paleta harmônica com códigos HEX'}`,
    `Texto Principal / Nome: ${session.discovery.mainTextOrHeadline || session.username}`,
    ...(previousSummaries.length > 0
      ? [
          '',
          'PROPOSTAS ANTERIORES RECUSADAS (PROIBIDO REPETIR ESTAS DIREÇÕES):',
          ...previousSummaries,
        ]
      : []),
    ...(diagnosticFocus
      ? [`Foco do Diagnóstico de Mudança: ${diagnosticFocus} | Feedback: ${clientFeedback || 'Mudar direção'}`]
      : []),
  ].join('\n');

  let rawCandidate: Partial<CreativeProposal> | null = null;
  let modelMetadata: CreativeProposal['modelMetadata'];

  try {
    const routerRes = await callSiliaModelRouter({
      task: taskType,
      systemPrompt,
      userPrompt,
      history: session.history.slice(-6),
      responseJsonSchema: CREATIVE_PROPOSAL_JSON_SCHEMA as unknown as Record<string, unknown>,
    });

    modelMetadata = routerRes.metadata;
    rawCandidate = tryParseJsonObject(routerRes.text);
  } catch (err) {
    const fallbackReason = err instanceof Error ? err.message : String(err);
    modelMetadata = {
      provider: 'local-fallback',
      model: 'silia-archetype-director-v2',
      latencyMs: 5,
      fallbackOccurred: true,
      fallbackReason,
    };
  }

  // Merge LLM candidate (if any) with the deterministic Archetype Director fallback so every single field is rich & valid
  const archetypeFallback = buildArchetypeFallbackProposal(session, attemptNumber, diagnosticFocus);
  const mergedRaw: Partial<CreativeProposal> = rawCandidate
    ? {
        ...archetypeFallback,
        ...rawCandidate,
        modelMetadata,
      }
    : {
        ...archetypeFallback,
        modelMetadata,
      };

  const validated = validateAndNormalizeProposal(mergedRaw, {
    proposalId,
    sessionId: session.sessionId,
    userId: session.userId,
    attemptNumber,
  });

  // Gather and attach verified visual references + programmatic palette & composition diagrams
  const verifiedReferences = await gatherVerifiedVisualReferences(validated.proposal);
  validated.proposal.references = verifiedReferences;

  session.proposals.push(validated.proposal);
  session.activeProposalId = validated.proposal.proposalId;
  session.stage = 'proposal_pending';

  return validated.proposal;
}
