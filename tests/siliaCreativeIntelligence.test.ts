import fs from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { BOT_CONFIG } from '../src/config/botConfig.js';
import {
  buildAdaptiveDiscoveryQuestions,
  generateStructuredCreativeProposal,
  updateDiscoveryFromMessage,
} from '../src/silia/creativeEngine.js';
import { generateCreativeBriefingDocx } from '../src/silia/docxGenerator.js';
import {
  buildKnowledgeIndex,
  getPromptForTask,
  loadFewShotExamples,
  retrieveRelevantKnowledge,
} from '../src/silia/knowledgeRag.js';
import {
  buildVertexGenAiConfig,
  resolveThinkingLevelForTask,
  sanitizeGemini3History,
} from '../src/silia/modelRouter.js';
import {
  hexToRgb,
  isValidHexColor,
  normalizeHex,
  validateAndNormalizeProposal,
} from '../src/silia/schema.js';
import {
  clearAllStoredSessionsForTests,
  getStoredSession,
  loadSessionsFromDisk,
  upsertStoredSession,
} from '../src/silia/storage.js';
import {
  renderColorSwatchPng,
  renderCompositionDiagramPng,
  renderPaletteStripPng,
} from '../src/silia/visualRenderer.js';
import {
  inspectImageBuffer,
  validateSafeExternalUrl,
} from '../src/silia/visualSearch.js';
import {
  createBriefingDeliveredActionRow,
  createDiagnosticFocusRow,
  createProposalDecisionRow,
  getOrInitUserSiliaSession,
  resetSessionConversationState,
} from '../src/systems/silia.js';

describe('Silia Creative Intelligence — Complete Architecture Suite', () => {
  beforeEach(() => {
    clearAllStoredSessionsForTests();
  });

  it('1. Enforces Gemini 3.8 Flash parameter rules (LOW/MEDIUM/HIGH thinkingLevel, no MINIMAL or temperature/top_p/top_k)', () => {
    expect(resolveThinkingLevelForTask('chat')).toBe('LOW');
    expect(resolveThinkingLevelForTask('discovery')).toBe('LOW');
    expect(resolveThinkingLevelForTask('proposal')).toBe('MEDIUM');
    expect(resolveThinkingLevelForTask('revision')).toBe('MEDIUM');
    expect(resolveThinkingLevelForTask('briefing')).toBe('MEDIUM');
    expect(resolveThinkingLevelForTask('diagnostic')).toBe('HIGH');

    const config = buildVertexGenAiConfig(
      'gemini-3.8-flash',
      'Prompt de teste',
      'MEDIUM',
      { type: 'OBJECT' },
    );

    expect(config).toHaveProperty('thinkingConfig');
    expect(config).not.toHaveProperty('temperature');
    expect(config).not.toHaveProperty('topP');
    expect(config).not.toHaveProperty('topK');
    expect(config).not.toHaveProperty('candidateCount');
    expect(config).not.toHaveProperty('frequencyPenalty');
    expect(config).not.toHaveProperty('presencePenalty');
    expect(config.responseMimeType).toBe('application/json');
  });

  it('2. Sanitizes conversation history for Gemini 3.8 Flash so it never ends with a model turn or empty turn', () => {
    const sanitized = sanitizeGemini3History(
      [
        { role: 'user', content: 'Oi Silia' },
        { role: 'assistant', content: '   ' }, // empty turn
        { role: 'assistant', content: 'Olá! Como posso ajudar?' },
      ],
      'Quero um banner dark',
    );

    expect(sanitized.length).toBeGreaterThanOrEqual(2);
    expect(sanitized[sanitized.length - 1]?.role).toBe('user');
    expect(sanitized.every((t) => t.parts[0]!.text.trim().length > 0)).toBe(true);
  });

  it('3. Validates and normalizes CreativeProposal schema, HEX colors, and RGB conversions', () => {
    expect(normalizeHex('8b5cf6')).toBe('#8B5CF6');
    expect(normalizeHex('invalid-hex', '#52B7FF')).toBe('#52B7FF');
    expect(isValidHexColor('#8B5CF6')).toBe(true);
    expect(hexToRgb('#8B5CF6')).toEqual({ r: 139, g: 92, b: 246 });

    const validation = validateAndNormalizeProposal(
      {
        projectType: 'banner',
        title: 'Banner Noctis',
      },
      {
        proposalId: 'PROP-TEST-1',
        sessionId: 'SES-1',
        userId: '123456',
        attemptNumber: 1,
      },
    );

    expect(validation.proposal.palette.length).toBeGreaterThanOrEqual(3);
    for (const swatch of validation.proposal.palette) {
      expect(isValidHexColor(swatch.hex)).toBe(true);
      expect(swatch.rgb).toHaveProperty('r');
      expect(swatch.proportionPct).toBeGreaterThan(0);
    }
    expect(validation.proposal.typography.titleFont.length).toBeGreaterThan(2);
    expect(validation.proposal.visualScript.length).toBeGreaterThanOrEqual(2);
    expect(validation.proposal.confirmedRequirements.length).toBeGreaterThan(0);
    expect(validation.proposal.assumptionsMade.length).toBeGreaterThan(0);
  });

  it('4. Loads Playbook knowledge RAG chunks, versioned prompts, and few-shot examples', () => {
    const index = buildKnowledgeIndex(true);
    expect(index.length).toBeGreaterThan(2);

    const retrieved = retrieveRelevantKnowledge('banner discord cores hex tipografia', 'banner', 2);
    expect(retrieved.length).toBe(2);

    const directorPrompt = getPromptForTask('proposal');
    expect(directorPrompt).toContain('Diretora Criativa');

    const fewShots = loadFewShotExamples('banner');
    expect(fewShots).toContain('Exemplos Positivos');
    expect(fewShots).toContain('Exemplos Negativos');
  });

  it('5. Protects visual search against SSRF and validates image magic bytes', () => {
    expect(validateSafeExternalUrl('http://localhost:8080/secret').safe).toBe(false);
    expect(validateSafeExternalUrl('http://127.0.0.1/admin').safe).toBe(false);
    expect(validateSafeExternalUrl('http://169.254.169.254/latest/meta-data').safe).toBe(false);
    expect(validateSafeExternalUrl('http://192.168.1.10/image.png').safe).toBe(false);
    expect(validateSafeExternalUrl('http://10.0.0.5/image.png').safe).toBe(false);
    expect(validateSafeExternalUrl('file:///etc/passwd').safe).toBe(false);
    expect(validateSafeExternalUrl('https://api.openverse.engineering/v1/images/').safe).toBe(true);

    // Programmatically rendered PNGs must pass binary magic byte & dimension inspection
    const swatchBuf = renderColorSwatchPng('#8B5CF6', 72, 36);
    const inspectedSwatch = inspectImageBuffer(swatchBuf);
    expect(inspectedSwatch.valid).toBe(true);
    expect(inspectedSwatch.mimeType).toBe('image/png');
    expect(inspectedSwatch.width).toBe(72);
    expect(inspectedSwatch.height).toBe(36);
  });

  it('6. Performs adaptive discovery: asks short questions on vague input, skips when context is rich', () => {
    const session = getOrInitUserSiliaSession('user-disc-1', 'ideate', 'Evandro');

    // Vague first input
    const disc1 = updateDiscoveryFromMessage(session, 'Oi, quero uma arte');
    expect(disc1.readyForProposal).toBe(false);

    const questionsText = buildAdaptiveDiscoveryQuestions(session, 'Evandro');
    expect(questionsText).toContain('Qual peça você quer criar?');
    expect(session.discovery.questionsAskedCount).toBe(1);

    // Client answers with details -> immediately ready for proposal!
    const disc2 = updateDiscoveryFromMessage(
      session,
      'Quero um banner pro servidor chamado LWX Kingdom, estilo cavaleiro sombrio com fogo azul e roxo',
    );
    expect(disc2.readyForProposal).toBe(true);
    expect(disc2.projectType).toBe('banner');
    expect(disc2.mainTextOrHeadline).toContain('LWX Kingdom');
  });

  it('7. Generates distinct proposals across 1st, 2nd, 3rd rejections, enters diagnostic mode, and supports 4+ attempts', async () => {
    // Ensure offline deterministic speed during unit tests
    const prevProject = process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GOOGLE_CLOUD_PROJECT;

    try {
      const session = getOrInitUserSiliaSession('user-reject-loop', 'ideate', 'Evandro');
      updateDiscoveryFromMessage(
        session,
        'Quero um banner para Discord chamado Noctis, tema dark cavaleiro com chamas azuis',
      );

      // Attempt #1
      const prop1 = await generateStructuredCreativeProposal(session);
      expect(prop1.attemptNumber).toBe(1);
      expect(session.activeProposalId).toBe(prop1.proposalId);

      // Simulate 1st rejection -> Attempt #2 must be substantially different
      prop1.status = 'rejected';
      session.rejections.push({
        proposalId: prop1.proposalId,
        attemptNumber: 1,
        rejectedAt: new Date().toISOString(),
        reasonCategory: 'unspecified',
      });
      const prop2 = await generateStructuredCreativeProposal(session);
      expect(prop2.attemptNumber).toBe(2);
      expect(prop2.title).not.toBe(prop1.title);
      expect(prop2.palette[1]?.hex).not.toBe(prop1.palette[1]?.hex);
      expect(prop2.whyDistinctFromPrevious).toBeTruthy();

      // Simulate 2nd rejection -> Attempt #3 must be substantially different from #1 and #2
      prop2.status = 'rejected';
      session.rejections.push({
        proposalId: prop2.proposalId,
        attemptNumber: 2,
        rejectedAt: new Date().toISOString(),
        reasonCategory: 'unspecified',
      });
      const prop3 = await generateStructuredCreativeProposal(session);
      expect(prop3.attemptNumber).toBe(3);
      expect(prop3.title).not.toBe(prop2.title);
      expect(prop3.palette[1]?.hex).not.toBe(prop2.palette[1]?.hex);

      // Simulate 3rd rejection -> Triggers diagnostic stage, then generates Attempt #4 tailored to diagnostic!
      prop3.status = 'rejected';
      session.rejections.push({
        proposalId: prop3.proposalId,
        attemptNumber: 3,
        rejectedAt: new Date().toISOString(),
        reasonCategory: 'colors',
        clientFeedback: 'Prefiro esmeralda e dourado cinematográfico',
      });
      session.stage = 'diagnostic';

      const prop4 = await generateStructuredCreativeProposal(
        session,
        'colors',
        'Prefiro esmeralda e dourado cinematográfico',
      );
      expect(prop4.attemptNumber).toBe(4);
      expect(prop4.whyDistinctFromPrevious).toContain('COLORS');
      expect(session.proposals.length).toBe(4);
    } finally {
      if (prevProject) process.env.GOOGLE_CLOUD_PROJECT = prevProject;
    }
  });

  it('8. Builds the exact Proposal Decision buttons, Diagnostic buttons, and Final Delivery buttons (Continuar Chat + Finalizar)', () => {
    const decisionRow = createProposalDecisionRow('PROP-123').toJSON();
    expect(decisionRow.components).toHaveLength(2);
    expect(decisionRow.components[0]).toMatchObject({
      label: 'Gostei dessa ideia',
      custom_id: `${BOT_CONFIG.customIds.siliaProposalApprove}:PROP-123`,
    });
    expect(decisionRow.components[1]).toMatchObject({
      label: 'Prefiro outra ideia',
      custom_id: `${BOT_CONFIG.customIds.siliaProposalReject}:PROP-123`,
    });

    const diagRow = createDiagnosticFocusRow().toJSON();
    expect(diagRow.components.length).toBeGreaterThanOrEqual(3);

    const finalRow = createBriefingDeliveredActionRow().toJSON();
    expect(finalRow.components).toHaveLength(3);
    expect(finalRow.components[0]).toMatchObject({
      label: 'Continuar Chat',
      custom_id: BOT_CONFIG.customIds.siliaContinueChat,
    });
    expect(finalRow.components[1]).toMatchObject({
      label: 'Abrir Orçamento com Esta Ideia',
      custom_id: BOT_CONFIG.customIds.siliaToBriefing,
    });
    expect(finalRow.components[2]).toMatchObject({
      label: 'Finalizar Atendimento',
      custom_id: BOT_CONFIG.customIds.siliaFinalizeClose,
    });
  });

  it('9. Generates a valid, editable Microsoft Word (.docx) briefing with embedded PNG swatches, composition diagram, and references', async () => {
    const session = getOrInitUserSiliaSession('user-docx-test', 'ideate', 'Evandro');
    updateDiscoveryFromMessage(
      session,
      'Quero um banner chamado LWX Lab Oficial com cavaleiro roxo e chamas azuis',
    );

    const proposal = await generateStructuredCreativeProposal(session);
    const compPng = renderCompositionDiagramPng(proposal.composition, proposal.palette);
    const stripPng = renderPaletteStripPng(proposal.palette);
    expect(inspectImageBuffer(compPng).valid).toBe(true);
    expect(inspectImageBuffer(stripPng).valid).toBe(true);

    const docxResult = await generateCreativeBriefingDocx(
      proposal,
      'Evandro',
      session.rejections,
    );

    expect(docxResult.fileName).toMatch(/\.docx$/);
    expect(fs.existsSync(docxResult.localFilePath)).toBe(true);
    expect(docxResult.buffer.length).toBeGreaterThan(8000);
    // Verify PK ZIP magic header of OpenXML .docx file
    expect(docxResult.buffer[0]).toBe(0x50); // 'P'
    expect(docxResult.buffer[1]).toBe(0x4b); // 'K'
    expect(docxResult.executiveSummary).toContain(proposal.proposalId);
    expect(docxResult.executiveSummary.length).toBeLessThanOrEqual(1400);
  });

  it('10. Persists session state, idempotency keys, and resets cleanly on Clear Conversation', () => {
    const session = getOrInitUserSiliaSession('user-persist-99', 'ideate', 'Tester');
    session.processedInteractionKeys.push('approve:PROP-99');
    session.trackedMessageIds.push('msg-1', 'msg-2');
    upsertStoredSession(session);

    const loaded = loadSessionsFromDisk().get('user-persist-99');
    expect(loaded).toBeDefined();
    expect(loaded?.processedInteractionKeys).toContain('approve:PROP-99');

    resetSessionConversationState(session);
    const afterReset = getStoredSession('user-persist-99');
    expect(afterReset?.history).toHaveLength(0);
    expect(afterReset?.proposals).toHaveLength(0);
    expect(afterReset?.processedInteractionKeys).toHaveLength(0);
    expect(afterReset?.trackedMessageIds).toHaveLength(0);
  });
});
