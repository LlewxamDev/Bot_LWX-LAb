export type SiliaMode = 'chat' | 'ideate';

export type SiliaHistoryTurn = {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
};

export type GeminiThinkingLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type SiliaTaskType =
  | 'chat'
  | 'discovery'
  | 'proposal'
  | 'visual_queries'
  | 'revision'
  | 'diagnostic'
  | 'briefing'
  | 'quality_review';

export type SiliaCreativeStage =
  | 'idle'
  | 'discovery'
  | 'proposal_pending'
  | 'diagnostic'
  | 'approved'
  | 'briefing_delivered';

export type ProjectCategory =
  | 'banner'
  | 'logo'
  | 'illustration'
  | 'pack'
  | 'thumbnail'
  | 'ui_bot_site'
  | 'custom';

export type ColorRole =
  | 'dominante'
  | 'secundaria'
  | 'acento'
  | 'neutra_fundo'
  | 'neutra_texto';

export interface ColorSwatchSpec {
  name: string;
  hex: string;
  rgb: { r: number; g: number; b: number };
  role: ColorRole;
  proportionPct: number;
  psychology: string;
  usage: string;
}

export interface TypographySpec {
  titleFont: string;
  subtitleFont: string;
  bodyFont: string;
  hierarchyRule: string;
  weightAndTracking: string;
  contrastNote: string;
  justification: string;
}

export type ReferenceCategory =
  | 'composition'
  | 'palette'
  | 'typography'
  | 'lighting'
  | 'style';

export interface VisualReferenceAsset {
  id: string;
  queryUsed: string;
  category: ReferenceCategory;
  title: string;
  sourceUrl: string;
  imageUrl: string;
  provider: string;
  licenseNote: string;
  mimeType: string;
  width?: number | undefined;
  height?: number | undefined;
  byteSize?: number | undefined;
  localCachePath?: string | undefined;
  buffer?: Buffer | undefined;
  whatItDemonstrates: string;
  whyItFits: string;
  whatNotToCopy: string;
  validated: boolean;
}

export interface VisualScriptBeat {
  order: number;
  plane: 'primeiro_plano' | 'plano_medio' | 'plano_de_fundo' | 'efeitos_tipografia';
  element: string;
  placement: string;
  lightingAndFocus: string;
  purpose: string;
}

export interface CompositionZone {
  label: string;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  role: string;
}

export interface CompositionDiagramSpec {
  aspectRatio: string;
  focalPoint: { xPct: number; yPct: number; label: string };
  zones: CompositionZone[];
  readingFlow: string;
  safeMarginPct: number;
  contrastStrategy: string;
}

export interface ModelExecutionMetadata {
  provider: 'vertex-gemini' | 'gemini-api-key' | 'openai' | 'pollinations' | 'local-fallback';
  model: string;
  thinkingLevel?: GeminiThinkingLevel | undefined;
  latencyMs: number;
  fallbackOccurred: boolean;
  fallbackReason?: string | undefined;
}

export interface CreativeProposal {
  proposalId: string;
  sessionId: string;
  userId: string;
  attemptNumber: number;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'superseded';
  projectType: ProjectCategory;
  projectTypeLabel: string;
  title: string;
  objective: string;
  targetAudienceAndChannel: string;
  creativeConcept: {
    summary: string;
    moodKeywords: string[];
    styleDirection: string;
    narrativeJustification: string;
  };
  palette: ColorSwatchSpec[];
  typography: TypographySpec;
  composition: CompositionDiagramSpec;
  visualTreatment: {
    lighting: string;
    depthAndTexture: string;
    specialEffects: string;
    finishLevel: string;
  };
  visualScript: VisualScriptBeat[];
  references: VisualReferenceAsset[];
  confirmedRequirements: string[];
  assumptionsMade: string[];
  outOfScope: string[];
  verifiableApprovalCriteria: string[];
  whyDistinctFromPrevious?: string | undefined;
  modelMetadata?: ModelExecutionMetadata | undefined;
}

export type RejectionDimension =
  | 'composition'
  | 'colors'
  | 'typography'
  | 'style'
  | 'concept'
  | 'unspecified';

export interface RejectionRecord {
  proposalId: string;
  attemptNumber: number;
  rejectedAt: string;
  reasonCategory: RejectionDimension;
  clientFeedback?: string | undefined;
}

export interface DiscoveryState {
  projectType?: ProjectCategory | undefined;
  projectTypeLabel?: string | undefined;
  objectiveAndChannel?: string | undefined;
  visualStyleOrMood?: string | undefined;
  mainTextOrHeadline?: string | undefined;
  centralSubject?: string | undefined;
  colorPreferences?: string | undefined;
  restrictionsOrDislikes?: string | undefined;
  clientProvidedReferences: string[];
  questionsAskedCount: number;
  readyForProposal: boolean;
}

export interface ApprovedBriefingRecord {
  briefingId: string;
  proposalId: string;
  sessionId: string;
  userId: string;
  approvedAt: string;
  fileName: string;
  localFilePath: string;
  driveFileId?: string | undefined;
  driveWebViewLink?: string | undefined;
  discordMessageId?: string | undefined;
  executiveSummary: string;
}

export interface SiliaCreativeSession {
  sessionId: string;
  userId: string;
  username: string;
  mode: SiliaMode;
  stage: SiliaCreativeStage;
  history: SiliaHistoryTurn[];
  discovery: DiscoveryState;
  proposals: CreativeProposal[];
  activeProposalId?: string | undefined;
  approvedProposalId?: string | undefined;
  rejections: RejectionRecord[];
  processedInteractionKeys: string[];
  approvedBriefing?: ApprovedBriefingRecord | undefined;
  lastIdeaSummary?: string | undefined;
  threadId?: string | undefined;
  trackedMessageIds: string[];
  driveSessionFileId?: string | undefined;
  createdAt: number;
  updatedAt: number;
}
