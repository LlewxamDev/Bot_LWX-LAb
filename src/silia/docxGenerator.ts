import fs from 'node:fs';
import path from 'node:path';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { inspectImageBuffer } from './visualSearch.js';
import {
  renderColorSwatchPng,
  renderCompositionDiagramPng,
  renderPaletteStripPng,
} from './visualRenderer.js';
import type { CreativeProposal, RejectionRecord } from './types.js';

function h1(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 340, after: 140 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 32,
        color: '5B21B6',
        font: 'Segoe UI',
      }),
    ],
  });
}

function h2(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 100 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 26,
        color: '1E1B4B',
        font: 'Segoe UI',
      }),
    ],
  });
}

function bodyParagraph(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { after: 100 },
    children: [
      new TextRun({
        text: `${label}: `,
        bold: true,
        size: 22,
        color: '1F2937',
        font: 'Segoe UI',
      }),
      new TextRun({
        text: value,
        size: 22,
        color: '374151',
        font: 'Segoe UI',
      }),
    ],
  });
}

function bulletItem(text: string, prefix = '• '): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    indent: { left: 360 },
    children: [
      new TextRun({
        text: `${prefix}${text}`,
        size: 21,
        color: '374151',
        font: 'Segoe UI',
      }),
    ],
  });
}

function resolveDocxImageType(mimeType?: string): 'png' | 'jpg' | 'gif' {
  if (!mimeType) return 'png';
  const lower = mimeType.toLowerCase();
  if (lower.includes('jpeg') || lower.includes('jpg')) return 'jpg';
  if (lower.includes('gif')) return 'gif';
  return 'png';
}

export interface GeneratedDocxBriefing {
  fileName: string;
  localFilePath: string;
  buffer: Buffer;
  executiveSummary: string;
}

/**
 * Generates an editable, rich Microsoft Word (.docx) Creative Briefing containing
 * Cover Page + all 14 required sections, embedded color swatch PNGs, embedded composition
 * diagram PNG, and verified reference images.
 */
export async function generateCreativeBriefingDocx(
  proposal: CreativeProposal,
  clientDisplayName: string,
  rejections: RejectionRecord[] = [],
): Promise<GeneratedDocxBriefing> {
  const dateStr = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const paletteStripPng = renderPaletteStripPng(proposal.palette, 600, 84);
  const compositionDiagramPng = renderCompositionDiagramPng(
    proposal.composition,
    proposal.palette,
    560,
    315,
  );

  // Build Color Swatch Table Rows (Section 4)
  const paletteHeaderRow = new TableRow({
    tableHeader: true,
    children: ['Amostra', 'Cor & Códigos (HEX / RGB)', 'Papel & Proporção', 'Psicologia & Aplicação na Peça'].map(
      (headerText) =>
        new TableCell({
          shading: { fill: '1E1B4B', type: ShadingType.CLEAR, color: 'auto' },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: headerText,
                  bold: true,
                  color: 'FFFFFF',
                  size: 20,
                  font: 'Segoe UI',
                }),
              ],
            }),
          ],
        }),
    ),
  });

  const paletteDataRows = proposal.palette.map((swatch) => {
    const swatchPng = renderColorSwatchPng(swatch.hex, 72, 36);
    const rgbStr = `RGB(${swatch.rgb.r}, ${swatch.rgb.g}, ${swatch.rgb.b})`;
    return new TableRow({
      children: [
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  type: 'png',
                  data: swatchPng,
                  transformation: { width: 64, height: 32 },
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: swatch.name, bold: true, size: 20, font: 'Segoe UI' }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `${swatch.hex} | ${rgbStr}`,
                  size: 18,
                  color: '4B5563',
                  font: 'Consolas',
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: `${swatch.role.toUpperCase()} (${swatch.proportionPct}%)`,
                  bold: true,
                  size: 19,
                  color: '5B21B6',
                  font: 'Segoe UI',
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 40, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'Sensação: ', bold: true, size: 19, font: 'Segoe UI' }),
                new TextRun({ text: swatch.psychology, size: 19, font: 'Segoe UI' }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Onde usar: ', bold: true, size: 19, font: 'Segoe UI' }),
                new TextRun({ text: swatch.usage, size: 19, font: 'Segoe UI' }),
              ],
            }),
          ],
        }),
      ],
    });
  });

  // Build Moodboard & Embedded Reference Elements (Section 6)
  const referenceParagraphs: Paragraph[] = [];
  for (let i = 0; i < proposal.references.length; i++) {
    const ref = proposal.references[i]!;
    referenceParagraphs.push(
      h2(`6.${i + 1}. ${ref.title} [${ref.category.toUpperCase()}]`),
    );

    if (ref.buffer) {
      const inspected = inspectImageBuffer(ref.buffer);
      if (inspected.valid && inspected.mimeType !== 'image/webp') {
        const docImgType = resolveDocxImageType(inspected.mimeType);
        const targetW = ref.category === 'palette' ? 480 : 420;
        const targetH = ref.category === 'palette' ? 72 : 236;
        referenceParagraphs.push(
          new Paragraph({
            spacing: { before: 80, after: 80 },
            children: [
              new ImageRun({
                type: docImgType,
                data: ref.buffer,
                transformation: { width: targetW, height: targetH },
              }),
            ],
          }),
        );
      }
    }

    referenceParagraphs.push(
      bodyParagraph('Fonte / Provedor', `${ref.provider} (${ref.sourceUrl})`),
      bodyParagraph('O que observar nesta referência', ref.whatItDemonstrates),
      bodyParagraph('Como adaptar para o projeto do cliente', ref.whyItFits),
      bodyParagraph('O que evitar copiar literalmente', ref.whatNotToCopy),
    );
  }

  // Build Visual Script Table (Section 7)
  const scriptRows = [
    new TableRow({
      tableHeader: true,
      children: ['Ordem & Plano', 'Elemento Visual', 'Posicionamento & Foco', 'Função na Peça'].map(
        (txt) =>
          new TableCell({
            shading: { fill: '312E81', type: ShadingType.CLEAR, color: 'auto' },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: txt, bold: true, color: 'FFFFFF', size: 20, font: 'Segoe UI' }),
                ],
              }),
            ],
          }),
      ),
    }),
    ...proposal.visualScript.map(
      (beat) =>
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `#${beat.order} • ${beat.plane.toUpperCase()}`,
                      bold: true,
                      size: 19,
                      font: 'Segoe UI',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: beat.element, size: 19, font: 'Segoe UI' })],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${beat.placement} | ${beat.lightingAndFocus}`,
                      size: 19,
                      font: 'Segoe UI',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: beat.purpose, size: 19, font: 'Segoe UI' })],
                }),
              ],
            }),
          ],
        }),
    ),
  ];

  const doc = new Document({
    creator: 'Silia AI • LWX Lab Creative Intelligence',
    title: `Briefing Criativo Executável — ${proposal.title}`,
    description: `Briefing oficial aprovado pelo cliente ${clientDisplayName} no estúdio LWX Lab`,
    sections: [
      {
        children: [
          // CAPA (COVER PAGE)
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 600, after: 160 },
            children: [
              new TextRun({
                text: 'LWX LAB DESIGN STUDIO • SILIA CREATIVE INTELLIGENCE',
                bold: true,
                size: 24,
                color: '8B5CF6',
                font: 'Segoe UI',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: proposal.title,
                bold: true,
                size: 44,
                color: '161024',
                font: 'Segoe UI',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 320 },
            children: [
              new TextRun({
                text: `Dossiê Técnico de Direção de Arte • ${proposal.projectTypeLabel}`,
                italics: true,
                size: 26,
                color: '4B5563',
                font: 'Segoe UI',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 280 },
            children: [
              new ImageRun({
                type: 'png',
                data: paletteStripPng,
                transformation: { width: 500, height: 70 },
              }),
            ],
          }),
          bodyParagraph('Status do Documento', 'Proposta Criativa Aprovada pelo Cliente ✅'),
          bodyParagraph('Cliente / Solicitante', `${clientDisplayName} (Discord ID: ${proposal.userId})`),
          bodyParagraph('Data e Hora de Aprovação', dateStr),
          bodyParagraph('ID da Sessão Criativa', proposal.sessionId),
          bodyParagraph('ID e Versão da Proposta Aprovada', `${proposal.proposalId} (Tentativa #${proposal.attemptNumber})`),
          bodyParagraph('Diretor de Arte Responsável (Execução)', 'Llewxam • LWX Lab Oficial'),
          new Paragraph({ children: [new PageBreak()] }),

          // SEÇÃO 1 — RESUMO EXECUTIVO
          h1('1. Resumo Executivo'),
          bodyParagraph('Tipo de Peça / Projeto', proposal.projectTypeLabel),
          bodyParagraph('Título da Direção Aprovada', proposal.title),
          bodyParagraph('Objetivo Principal', proposal.objective),
          bodyParagraph('Canal / Plataforma de Uso', proposal.targetAudienceAndChannel),
          bodyParagraph('Resumo da Direção Criativa', proposal.creativeConcept.summary),
          bodyParagraph('Resultado Esperado', proposal.creativeConcept.narrativeJustification),

          // SEÇÃO 2 — REQUISITOS DO CLIENTE (CONFIRMADOS VS ASSUMIDOS VS FORA DE ESCOPO)
          h1('2. Requisitos do Cliente (Confirmados vs. Assumidos)'),
          h2('2.1. Confirmado Explicitamente pelo Cliente'),
          ...proposal.confirmedRequirements.map((req) => bulletItem(req, '✔ ')),
          h2('2.2. Assumido pela Silia AI com Base no Contexto Técnico'),
          ...proposal.assumptionsMade.map((assump) => bulletItem(assump, '◆ ')),
          h2('2.3. Fora de Escopo Desta Entrega'),
          ...proposal.outOfScope.map((out) => bulletItem(out, '✖ ')),

          // SEÇÃO 3 — CONCEITO CRIATIVO E DIREÇÃO DE ARTE
          h1('3. Conceito Criativo e Direção de Arte'),
          bodyParagraph('Ideia Central', proposal.creativeConcept.summary),
          bodyParagraph('Direção Estética e Atmosfera', proposal.creativeConcept.styleDirection),
          bodyParagraph('Palavras-Chave Visuais (Mood)', proposal.creativeConcept.moodKeywords.join(' • ')),
          bodyParagraph('Justificativa Conceitual e Narrativa', proposal.creativeConcept.narrativeJustification),
          ...(proposal.whyDistinctFromPrevious
            ? [bodyParagraph('Evolução em Relação às Tentativas Anteriores', proposal.whyDistinctFromPrevious)]
            : []),

          // SEÇÃO 4 — PALETA DE CORES (COM AMOSTRAS PNG EMBUTIDAS)
          h1('4. Paleta de Cores Oficial (HEX / RGB e Amostras Visuais)'),
          new Paragraph({
            spacing: { after: 140 },
            children: [
              new ImageRun({
                type: 'png',
                data: paletteStripPng,
                transformation: { width: 520, height: 72 },
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
              left: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
              right: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
            },
            rows: [paletteHeaderRow, ...paletteDataRows],
          }),

          // SEÇÃO 5 — TIPOGRAFIA E HIERARQUIA DE TEXTO
          h1('5. Tipografia e Hierarquia de Texto'),
          bodyParagraph('Fonte Recomendada para Título (Headline)', proposal.typography.titleFont),
          bodyParagraph('Fonte Recomendada para Subtítulo', proposal.typography.subtitleFont),
          bodyParagraph('Fonte de Apoio / Corpo', proposal.typography.bodyFont),
          bodyParagraph('Regra de Escala e Hierarquia', proposal.typography.hierarchyRule),
          bodyParagraph('Pesos, Caixa e Tracking', proposal.typography.weightAndTracking),
          bodyParagraph('Estratégia de Contraste sobre o Fundo', proposal.typography.contrastNote),
          bodyParagraph('Justificativa da Escolha Tipográfica', proposal.typography.justification),

          // SEÇÃO 6 — MOODBOARD E REFERÊNCIAS VISUAIS
          h1('6. Moodboard e Referências Visuais Verificadas'),
          ...referenceParagraphs,

          // SEÇÃO 7 — ROTEIRO VISUAL DETALHADO
          h1('7. Roteiro Visual Detalhado em Planos'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: scriptRows,
          }),

          // SEÇÃO 8 — COMPOSIÇÃO, LAYOUT E HIERARQUIA (COM DIAGRAMA PNG EMBUTIDO)
          h1('8. Composição, Layout e Hierarquia Ocular'),
          bodyParagraph('Proporção e Formato Base', proposal.composition.aspectRatio),
          bodyParagraph(
            'Ponto Focal Primário',
            `${proposal.composition.focalPoint.label} (Eixo X: ${proposal.composition.focalPoint.xPct}%, Eixo Y: ${proposal.composition.focalPoint.yPct}%)`,
          ),
          bodyParagraph('Fluxo de Leitura Planejado', proposal.composition.readingFlow),
          bodyParagraph('Margem de Segurança Obrigatória', `${proposal.composition.safeMarginPct}% da área total`),
          bodyParagraph('Estratégia de Contraste e Espaço Negativo', proposal.composition.contrastStrategy),
          new Paragraph({
            spacing: { before: 120, after: 120 },
            children: [
              new ImageRun({
                type: 'png',
                data: compositionDiagramPng,
                transformation: { width: 480, height: 270 },
              }),
            ],
          }),
          ...proposal.composition.zones.map((z) =>
            bulletItem(
              `${z.label} [X:${z.xPct}% Y:${z.yPct}% | L:${z.wPct}% A:${z.hPct}%] — Função: ${z.role}`,
            ),
          ),

          // SEÇÃO 9 — TRATAMENTO VISUAL, LUZ, TEXTURA E EFEITOS
          h1('9. Tratamento Visual, Luz, Textura e Efeitos'),
          bodyParagraph('Iluminação Principal e Secundária (Rim Light)', proposal.visualTreatment.lighting),
          bodyParagraph('Profundidade de Campo e Texturas', proposal.visualTreatment.depthAndTexture),
          bodyParagraph('Efeitos Especiais Controlados', proposal.visualTreatment.specialEffects),
          bodyParagraph('Nível de Acabamento e Polimento', proposal.visualTreatment.finishLevel),

          // SEÇÃO 10 — ROTEIRO DE EXECUÇÃO PARA O DESIGNER
          h1('10. Roteiro de Execução Passo a Passo para o Designer'),
          bulletItem(
            `Etapa 1 (Preparação do Canvas): Configurar documento em ${proposal.composition.aspectRatio} (300 DPI / RGB) e traçar guias de margem segura em ${proposal.composition.safeMarginPct}%.`,
            '1. ',
          ),
          bulletItem(
            `Etapa 2 (Blocagem e Fundo): Aplicar base cromática (${proposal.palette[0]?.hex || '#161024'}) e posicionar atmosfera de 3º plano com leve desfoque para preservar leitura central.`,
            '2. ',
          ),
          bulletItem(
            `Etapa 3 (Elemento Focal): Posicionar o sujeito principal em (${proposal.composition.focalPoint.xPct}%, ${proposal.composition.focalPoint.yPct}%) com recorte nítido.`,
            '3. ',
          ),
          bulletItem(
            `Etapa 4 (Iluminação em Camadas): Aplicar ${proposal.visualTreatment.lighting} usando as cores dominante (${proposal.palette[1]?.hex || '#8B5CF6'}) e secundária (${proposal.palette[2]?.hex || '#52B7FF'}).`,
            '4. ',
          ),
          bulletItem(
            `Etapa 5 (Tipografia e Hierarquia): Inserir headline em ${proposal.typography.titleFont} seguindo a regra: ${proposal.typography.contrastNote}`,
            '5. ',
          ),
          bulletItem(
            'Etapa 6 (Pós-Processamento e QA): Aplicar correção tonal final, verificar leitura em zoom de 25% (miniatura mobile) e exportar nos formatos finais.',
            '6. ',
          ),

          // SEÇÃO 11 — ESPECIFICAÇÕES TÉCNICAS DE ENTREGA
          h1('11. Especificações Técnicas de Entrega'),
          bodyParagraph('Proporção / Dimensões Sugeridas', proposal.composition.aspectRatio),
          bodyParagraph('Formatos de Exportação', 'PNG 24-bit sem compressão agressiva (ou GIF otimizado se houver motion contratado)'),
          bodyParagraph('Margem de Segurança contra Cortes de UI', `${proposal.composition.safeMarginPct}% em todas as bordas`),
          bodyParagraph('Teste de Legibilidade Mobile', 'Aprovado para visualização reduzida em smartphones e janelas compactas do Discord'),

          // SEÇÃO 12 — RESTRIÇÕES, RISCOS E PRIORIDADES
          h1('12. Restrições, Riscos e Prioridades'),
          bulletItem('Prioridade Máxima: Preservar o contraste imediato entre o elemento central, o título principal e o fundo.'),
          bulletItem('Risco a Evitar: Excesso de partículas ou texturas nítidas atrás do texto que prejudiquem a leitura rápida.'),
          bulletItem('Fidelidade Cromática: Respeitar rigorosamente os códigos HEX aprovados nesta proposta.'),

          // SEÇÃO 13 — CRITÉRIOS VERIFICÁVEIS DE APROVAÇÃO
          h1('13. Critérios Verificáveis de Aprovação Final'),
          ...proposal.verifiableApprovalCriteria.map((crit) => bulletItem(crit, '☑ ')),

          // SEÇÃO 14 — REFERÊNCIAS, FONTES E OBSERVAÇÕES FINAIS
          h1('14. Referências, Histórico de Revisão e Observações Finais'),
          bodyParagraph('Total de Tentativas até a Aprovação', `${proposal.attemptNumber} proposta(s) gerada(s)`),
          ...(rejections.length > 0
            ? rejections.map((r) =>
                bulletItem(
                  `Proposta Anterior (${r.proposalId} - Tentativa #${r.attemptNumber}) recusada em ${r.rejectedAt} | Foco de ajuste: ${r.reasonCategory}${r.clientFeedback ? ` ("${r.clientFeedback}")` : ''}`,
                ),
              )
            : [bulletItem('Aprovada diretamente pelo cliente sem necessidade de descartes anteriores.')]),
          bodyParagraph(
            'Nota de Encerramento Silia AI',
            'Este documento é 100% editável no Microsoft Word, Google Docs ou LibreOffice e pode ser anexado diretamente ao ticket de orçamento no LWX Lab.',
          ),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const briefingsDir = path.resolve(process.cwd(), 'data', 'briefings');
  fs.mkdirSync(briefingsDir, { recursive: true });

  const safeSlug = proposal.title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

  const fileName = `Briefing-LWX-${safeSlug || 'projeto'}-${proposal.proposalId}.docx`;
  const localFilePath = path.join(briefingsDir, fileName);
  fs.writeFileSync(localFilePath, buffer);

  const executiveSummary = [
    `✅ [BRIEFING APROVADO • ${proposal.proposalId}]`,
    `• Peça: ${proposal.projectTypeLabel} — "${proposal.title}"`,
    `• Conceito: ${proposal.creativeConcept.summary}`,
    `• Paleta HEX: ${proposal.palette.map((c) => `${c.name} (${c.hex})`).join(', ')}`,
    `• Tipografia: ${proposal.typography.titleFont} + ${proposal.typography.subtitleFont}`,
    `• Composição: ${proposal.composition.aspectRatio} | Foco: ${proposal.composition.focalPoint.label}`,
    `• Arquivo .docx gerado: ${fileName}`,
  ]
    .join('\n')
    .slice(0, 1400);

  return {
    fileName,
    localFilePath,
    buffer,
    executiveSummary,
  };
}
