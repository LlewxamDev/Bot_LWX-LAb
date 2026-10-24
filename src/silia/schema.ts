import type {
  ColorRole,
  ColorSwatchSpec,
  CompositionDiagramSpec,
  CreativeProposal,
  ProjectCategory,
  TypographySpec,
  VisualReferenceAsset,
  VisualScriptBeat,
} from './types.js';

const HEX_COLOR_REGEX = /^#?[0-9A-Fa-f]{6}$/;

export function normalizeHex(hex: string, fallback = '#8B5CF6'): string {
  const cleaned = hex.trim();
  if (!HEX_COLOR_REGEX.test(cleaned)) {
    return fallback.toUpperCase();
  }
  return (cleaned.startsWith('#') ? cleaned : `#${cleaned}`).toUpperCase();
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHex(hex);
  const num = Number.parseInt(normalized.slice(1), 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function isValidHexColor(hex: string): boolean {
  return /^#[0-9A-F]{6}$/i.test(hex.trim());
}

export const CREATIVE_PROPOSAL_JSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    projectType: {
      type: 'STRING',
      enum: ['banner', 'logo', 'illustration', 'pack', 'thumbnail', 'ui_bot_site', 'custom'],
    },
    projectTypeLabel: { type: 'STRING' },
    title: { type: 'STRING' },
    objective: { type: 'STRING' },
    targetAudienceAndChannel: { type: 'STRING' },
    creativeConcept: {
      type: 'OBJECT',
      properties: {
        summary: { type: 'STRING' },
        moodKeywords: { type: 'ARRAY', items: { type: 'STRING' } },
        styleDirection: { type: 'STRING' },
        narrativeJustification: { type: 'STRING' },
      },
      required: ['summary', 'moodKeywords', 'styleDirection', 'narrativeJustification'],
    },
    palette: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          hex: { type: 'STRING' },
          role: {
            type: 'STRING',
            enum: ['dominante', 'secundaria', 'acento', 'neutra_fundo', 'neutra_texto'],
          },
          proportionPct: { type: 'NUMBER' },
          psychology: { type: 'STRING' },
          usage: { type: 'STRING' },
        },
        required: ['name', 'hex', 'role', 'proportionPct', 'psychology', 'usage'],
      },
    },
    typography: {
      type: 'OBJECT',
      properties: {
        titleFont: { type: 'STRING' },
        subtitleFont: { type: 'STRING' },
        bodyFont: { type: 'STRING' },
        hierarchyRule: { type: 'STRING' },
        weightAndTracking: { type: 'STRING' },
        contrastNote: { type: 'STRING' },
        justification: { type: 'STRING' },
      },
      required: [
        'titleFont',
        'subtitleFont',
        'bodyFont',
        'hierarchyRule',
        'weightAndTracking',
        'contrastNote',
        'justification',
      ],
    },
    composition: {
      type: 'OBJECT',
      properties: {
        aspectRatio: { type: 'STRING' },
        focalPoint: {
          type: 'OBJECT',
          properties: {
            xPct: { type: 'NUMBER' },
            yPct: { type: 'NUMBER' },
            label: { type: 'STRING' },
          },
          required: ['xPct', 'yPct', 'label'],
        },
        zones: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              label: { type: 'STRING' },
              xPct: { type: 'NUMBER' },
              yPct: { type: 'NUMBER' },
              wPct: { type: 'NUMBER' },
              hPct: { type: 'NUMBER' },
              role: { type: 'STRING' },
            },
            required: ['label', 'xPct', 'yPct', 'wPct', 'hPct', 'role'],
          },
        },
        readingFlow: { type: 'STRING' },
        safeMarginPct: { type: 'NUMBER' },
        contrastStrategy: { type: 'STRING' },
      },
      required: ['aspectRatio', 'focalPoint', 'zones', 'readingFlow', 'safeMarginPct', 'contrastStrategy'],
    },
    visualTreatment: {
      type: 'OBJECT',
      properties: {
        lighting: { type: 'STRING' },
        depthAndTexture: { type: 'STRING' },
        specialEffects: { type: 'STRING' },
        finishLevel: { type: 'STRING' },
      },
      required: ['lighting', 'depthAndTexture', 'specialEffects', 'finishLevel'],
    },
    visualScript: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          order: { type: 'NUMBER' },
          plane: {
            type: 'STRING',
            enum: ['primeiro_plano', 'plano_medio', 'plano_de_fundo', 'efeitos_tipografia'],
          },
          element: { type: 'STRING' },
          placement: { type: 'STRING' },
          lightingAndFocus: { type: 'STRING' },
          purpose: { type: 'STRING' },
        },
        required: ['order', 'plane', 'element', 'placement', 'lightingAndFocus', 'purpose'],
      },
    },
    confirmedRequirements: { type: 'ARRAY', items: { type: 'STRING' } },
    assumptionsMade: { type: 'ARRAY', items: { type: 'STRING' } },
    outOfScope: { type: 'ARRAY', items: { type: 'STRING' } },
    verifiableApprovalCriteria: { type: 'ARRAY', items: { type: 'STRING' } },
    whyDistinctFromPrevious: { type: 'STRING' },
  },
  required: [
    'projectType',
    'projectTypeLabel',
    'title',
    'objective',
    'targetAudienceAndChannel',
    'creativeConcept',
    'palette',
    'typography',
    'composition',
    'visualTreatment',
    'visualScript',
    'confirmedRequirements',
    'assumptionsMade',
    'outOfScope',
    'verifiableApprovalCriteria',
  ],
} as const;

const VALID_ROLES: ColorRole[] = [
  'dominante',
  'secundaria',
  'acento',
  'neutra_fundo',
  'neutra_texto',
];

const VALID_CATEGORIES: ProjectCategory[] = [
  'banner',
  'logo',
  'illustration',
  'pack',
  'thumbnail',
  'ui_bot_site',
  'custom',
];

export interface ProposalValidationResult {
  valid: boolean;
  errors: string[];
  proposal: CreativeProposal;
}

export function validateAndNormalizeProposal(
  raw: Partial<CreativeProposal>,
  context: {
    proposalId: string;
    sessionId: string;
    userId: string;
    attemptNumber: number;
    references?: VisualReferenceAsset[];
  },
): ProposalValidationResult {
  const errors: string[] = [];

  const projectType: ProjectCategory = VALID_CATEGORIES.includes(raw.projectType as ProjectCategory)
    ? (raw.projectType as ProjectCategory)
    : 'banner';

  const projectTypeLabel =
    typeof raw.projectTypeLabel === 'string' && raw.projectTypeLabel.trim().length > 0
      ? raw.projectTypeLabel.trim()
      : projectType === 'logo'
        ? 'Logo & Identidade Visual'
        : projectType === 'illustration'
          ? 'Ilustração Autoral / OC'
          : projectType === 'pack'
            ? 'Pack Visual Completo'
            : 'Banner / Header HD';

  const title =
    typeof raw.title === 'string' && raw.title.trim().length >= 3
      ? raw.title.trim()
      : `Direção Criativa #${context.attemptNumber} • ${projectTypeLabel}`;

  if (!raw.title || raw.title.trim().length < 3) {
    errors.push('Título da proposta ausente ou muito curto.');
  }

  const rawPalette = Array.isArray(raw.palette) ? raw.palette : [];
  if (rawPalette.length < 3) {
    errors.push('Paleta deve conter ao menos 3 cores com códigos HEX válidos.');
  }

  const defaultPalette: Array<{ name: string; hex: string; role: ColorRole; proportionPct: number; psychology: string; usage: string }> = [
    {
      name: 'Obsidian Void',
      hex: '#161024',
      role: 'neutra_fundo',
      proportionPct: 45,
      psychology: 'Profundidade, mistério e alto contraste para elementos luminosos',
      usage: 'Fundo principal, vinheta periférica e sombra atmosférica',
    },
    {
      name: 'Royal Violet',
      hex: '#8B5CF6',
      role: 'dominante',
      proportionPct: 25,
      psychology: 'Criatividade, nobreza digital e assinatura estética moderna',
      usage: 'Iluminação volumétrica principal, armadura/formas centrais e molduras',
    },
    {
      name: 'Soul-Fire Cyan',
      hex: '#52B7FF',
      role: 'secundaria',
      proportionPct: 15,
      psychology: 'Energia tecnológica, dinamismo e clareza focal',
      usage: 'Rim light (luz de recorte), partículas e elementos secundários de apoio',
    },
    {
      name: 'Crimson Rose',
      hex: '#D6456B',
      role: 'acento',
      proportionPct: 10,
      psychology: 'Impacto imediato, tensão visual e ponto de atenção',
      usage: 'Detalhes de contraste, selos de destaque e pontos focais estratégicos',
    },
    {
      name: 'Ice Core White',
      hex: '#F4F8FF',
      role: 'neutra_texto',
      proportionPct: 5,
      psychology: 'Nitidez máxima e leitura instantânea',
      usage: 'Tipografia principal (headline) e brilhos especulares',
    },
  ];

  const palette: ColorSwatchSpec[] = (rawPalette.length >= 3 ? rawPalette : defaultPalette).map(
    (swatch, idx) => {
      const fallback = defaultPalette[idx % defaultPalette.length]!;
      const hex = normalizeHex(swatch.hex || fallback.hex, fallback.hex);
      const role: ColorRole = VALID_ROLES.includes(swatch.role as ColorRole)
        ? (swatch.role as ColorRole)
        : fallback.role;
      return {
        name: swatch.name?.trim() || fallback.name,
        hex,
        rgb: hexToRgb(hex),
        role,
        proportionPct:
          typeof swatch.proportionPct === 'number' && swatch.proportionPct > 0
            ? Math.min(100, Math.round(swatch.proportionPct))
            : fallback.proportionPct,
        psychology: swatch.psychology?.trim() || fallback.psychology,
        usage: swatch.usage?.trim() || fallback.usage,
      };
    },
  );

  const typography: TypographySpec = {
    titleFont: raw.typography?.titleFont?.trim() || 'Montserrat ExtraBold / Cinzel Bold (Display)',
    subtitleFont: raw.typography?.subtitleFont?.trim() || 'Plus Jakarta Sans SemiBold',
    bodyFont: raw.typography?.bodyFont?.trim() || 'Inter Medium',
    hierarchyRule:
      raw.typography?.hierarchyRule?.trim() ||
      'Título principal ocupando 22–28% da largura útil com contraste 12:1 sobre fundo escuro; subtítulo com 45% da escala do título.',
    weightAndTracking:
      raw.typography?.weightAndTracking?.trim() ||
      'Título em peso 800 (ExtraBold) com tracking +4% em caixa alta; subtítulo em peso 600 com tracking +8%.',
    contrastNote:
      raw.typography?.contrastNote?.trim() ||
      'Sombra projetada suave (drop shadow 0px 8px 24px #090612) e rim-glow sutil para garantir leitura em telas mobile e desktop.',
    justification:
      raw.typography?.justification?.trim() ||
      'Combina impacto imediato em tamanhos reduzidos do Discord com legibilidade cristalina sem competir com o personagem/elemento central.',
  };

  const composition: CompositionDiagramSpec = {
    aspectRatio: raw.composition?.aspectRatio?.trim() || (projectType === 'logo' ? '1:1 (1024x1024)' : '16:9 (1920x1080)'),
    focalPoint: {
      xPct: raw.composition?.focalPoint?.xPct ?? 50,
      yPct: raw.composition?.focalPoint?.yPct ?? 45,
      label: raw.composition?.focalPoint?.label?.trim() || 'Sujeito Central + Headline Integrada',
    },
    zones:
      Array.isArray(raw.composition?.zones) && raw.composition.zones.length >= 2
        ? raw.composition.zones.map((z) => ({
            label: z.label?.trim() || 'Zona de Composição',
            xPct: Math.max(0, Math.min(95, Number(z.xPct) || 10)),
            yPct: Math.max(0, Math.min(95, Number(z.yPct) || 10)),
            wPct: Math.max(10, Math.min(100, Number(z.wPct) || 35)),
            hPct: Math.max(10, Math.min(100, Number(z.hPct) || 35)),
            role: z.role?.trim() || 'Elemento estrutural',
          }))
        : [
            {
              label: 'Plano de Fundo Atmosférico',
              xPct: 5,
              yPct: 5,
              wPct: 90,
              hPct: 90,
              role: 'Ambiente, profundidade e iluminação de atmosfera',
            },
            {
              label: 'Ponto Focal / Personagem',
              xPct: 28,
              yPct: 12,
              wPct: 44,
              hPct: 76,
              role: 'Protagonista da peça com rim light de alto contraste',
            },
            {
              label: 'Zona Tipográfica Principal',
              xPct: 20,
              yPct: 64,
              wPct: 60,
              hPct: 24,
              role: 'Título em destaque com área de respiro segura',
            },
          ],
    readingFlow:
      raw.composition?.readingFlow?.trim() ||
      'Fluxo centro-radial: o olhar captura primeiro o rosto/símbolo iluminado no centro superior e desce naturalmente para a tipografia principal.',
    safeMarginPct: raw.composition?.safeMarginPct ?? 8,
    contrastStrategy:
      raw.composition?.contrastStrategy?.trim() ||
      'Fundo escuro desaturado em 30% nas bordas (vinheta) com recorte luminoso (rim light) separando o primeiro plano do fundo.',
  };

  const visualScript: VisualScriptBeat[] =
    Array.isArray(raw.visualScript) && raw.visualScript.length >= 2
      ? raw.visualScript.map((b, i) => ({
          order: i + 1,
          plane:
            b.plane === 'primeiro_plano' ||
            b.plane === 'plano_medio' ||
            b.plane === 'plano_de_fundo' ||
            b.plane === 'efeitos_tipografia'
              ? b.plane
              : 'primeiro_plano',
          element: b.element?.trim() || `Elemento #${i + 1}`,
          placement: b.placement?.trim() || 'Centro da composição',
          lightingAndFocus: b.lightingAndFocus?.trim() || 'Foco nítido e iluminação direcional',
          purpose: b.purpose?.trim() || 'Sustentar a narrativa visual da peça',
        }))
      : [
          {
            order: 1,
            plane: 'plano_de_fundo',
            element: 'Cenário atmosférico em camadas com profundidade suave (depth of field)',
            placement: 'Extensão total do canvas com vinheta escura nas bordas',
            lightingAndFocus: 'Desfoque gaussiano leve (f/2.8) e iluminação volumétrica indireta',
            purpose: 'Criar atmosfera sem poluir a leitura do elemento principal',
          },
          {
            order: 2,
            plane: 'plano_medio',
            element: 'Protagonista / Símbolo central em pose ou enquadramento heroico',
            placement: 'Centro óptico (eixo X 50%, Y 42%) respeitando margem segura',
            lightingAndFocus: 'Nitidez máxima com luz principal a 45° e rim light vibrante nas bordas',
            purpose: 'Capturar a atenção em menos de 1 segundo',
          },
          {
            order: 3,
            plane: 'efeitos_tipografia',
            element: 'Tipografia principal integrada com partículas sutis de profundidade',
            placement: 'Terço inferior central ou lateral equilibrada com espaço negativo',
            lightingAndFocus: 'Contraste elevado sobre base escura translúcida e brilho especular controlado',
            purpose: 'Garantir leitura imediata do nome/marca em qualquer resolução',
          },
        ];

  const proposal: CreativeProposal = {
    proposalId: context.proposalId,
    sessionId: context.sessionId,
    userId: context.userId,
    attemptNumber: context.attemptNumber,
    createdAt: raw.createdAt || new Date().toISOString(),
    status: raw.status || 'pending',
    projectType,
    projectTypeLabel,
    title,
    objective:
      raw.objective?.trim() ||
      `Criar um ${projectTypeLabel} memorável, com hierarquia clara e acabamento profissional pronto para produção no LWX Lab.`,
    targetAudienceAndChannel:
      raw.targetAudienceAndChannel?.trim() ||
      'Comunidade Discord / Redes Sociais (visualização em desktop e dispositivos móveis)',
    creativeConcept: {
      summary:
        raw.creativeConcept?.summary?.trim() ||
        'Direção de arte focada em alto contraste, ponto focal magnético e equilíbrio entre atmosfera temática e legibilidade tipográfica.',
      moodKeywords:
        Array.isArray(raw.creativeConcept?.moodKeywords) && raw.creativeConcept.moodKeywords.length > 0
          ? raw.creativeConcept.moodKeywords.map((k) => String(k).trim()).filter(Boolean)
          : ['Impactante', 'Profissional', 'Alto Contraste', 'Identidade Forte'],
      styleDirection:
        raw.creativeConcept?.styleDirection?.trim() ||
        'Composição em camadas com iluminação dramática controlada e tipografia integrada ao plano médio.',
      narrativeJustification:
        raw.creativeConcept?.narrativeJustification?.trim() ||
        'Esta direção garante que a peça se destaque imediatamente no feed/servidor mantendo leitura limpa do texto principal.',
    },
    palette,
    typography,
    composition,
    visualTreatment: {
      lighting:
        raw.visualTreatment?.lighting?.trim() ||
        'Iluminação de três pontos: key light suave no elemento principal, rim light intensa para recorte de silhueta e ambient glow no fundo.',
      depthAndTexture:
        raw.visualTreatment?.depthAndTexture?.trim() ||
        'Separação nítida entre 1º, 2º e 3º planos com leve granulação cinematográfica (2–3%) e texturas limpas.',
      specialEffects:
        raw.visualTreatment?.specialEffects?.trim() ||
        'Brilho direcional controlado, partículas de profundidade sutis e vinheta óptica nas extremidades.',
      finishLevel:
        raw.visualTreatment?.finishLevel?.trim() ||
        'Acabamento polido em alta definição (HD/4K), bordas refinadas e correção de cor final.',
    },
    visualScript,
    references: context.references ?? raw.references ?? [],
    confirmedRequirements:
      Array.isArray(raw.confirmedRequirements) && raw.confirmedRequirements.length > 0
        ? raw.confirmedRequirements.map((r) => String(r).trim()).filter(Boolean)
        : ['Peça solicitada pelo cliente durante o atendimento com a Silia AI'],
    assumptionsMade:
      Array.isArray(raw.assumptionsMade) && raw.assumptionsMade.length > 0
        ? raw.assumptionsMade.map((a) => String(a).trim()).filter(Boolean)
        : [
            'Margem segura de 8% aplicada para evitar cortes em diferentes proporções de tela',
            'Acabamento de contraste otimizado para tema escuro e claro do Discord',
          ],
    outOfScope:
      Array.isArray(raw.outOfScope) && raw.outOfScope.length > 0
        ? raw.outOfScope.map((o) => String(o).trim()).filter(Boolean)
        : [
            'Animação complexa quadro a quadro não solicitada explicitamente',
            'Peças adicionais fora do formato principal especificado nesta proposta',
          ],
    verifiableApprovalCriteria:
      Array.isArray(raw.verifiableApprovalCriteria) && raw.verifiableApprovalCriteria.length > 0
        ? raw.verifiableApprovalCriteria.map((c) => String(c).trim()).filter(Boolean)
        : [
            'O título principal deve ser legível instantaneamente mesmo em miniatura (25% do tamanho)',
            'A paleta de cores deve respeitar a proporção definida (dominante, secundária e acento)',
            'O elemento focal deve estar livre de obstruções nas zonas de corte da plataforma',
          ],
    whyDistinctFromPrevious: raw.whyDistinctFromPrevious?.trim(),
    modelMetadata: raw.modelMetadata,
  };

  return {
    valid: errors.length === 0,
    errors,
    proposal,
  };
}
