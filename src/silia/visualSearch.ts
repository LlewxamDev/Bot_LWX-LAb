import fs from 'node:fs';
import path from 'node:path';
import type {
  CreativeProposal,
  ProjectCategory,
  ReferenceCategory,
  VisualReferenceAsset,
} from './types.js';
import { renderCompositionDiagramPng, renderPaletteStripPng } from './visualRenderer.js';

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB max per reference image
const MIN_IMAGE_BYTES = 128;

/**
 * Validates that an external URL is safe to fetch (prevents SSRF against localhost,
 * loopback, link-local, private RFC1918 networks, and non-HTTP protocols).
 */
export function validateSafeExternalUrl(rawUrl: string): { safe: boolean; reason?: string; url?: URL } {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { safe: false, reason: `Protocolo não permitido: ${parsed.protocol}` };
    }

    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '[::1]' ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return { safe: false, reason: `Host loopback/interno bloqueado por proteção SSRF: ${host}` };
    }

    // Block private IPv4 ranges: 10.x.x.x, 127.x.x.x, 169.254.x.x, 172.16-31.x.x, 192.168.x.x
    const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const a = Number(ipv4Match[1]);
      const b = Number(ipv4Match[2]);
      if (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127)
      ) {
        return { safe: false, reason: `Faixa de IP privado bloqueada por proteção SSRF: ${host}` };
      }
    }

    // Block IPv6 private/link-local
    if (host.startsWith('[fc') || host.startsWith('[fd') || host.startsWith('[fe80')) {
      return { safe: false, reason: `IPv6 privado bloqueado por proteção SSRF: ${host}` };
    }

    return { safe: true, url: parsed };
  } catch {
    return { safe: false, reason: 'URL malformada' };
  }
}

/**
 * Inspects binary magic bytes to verify that a downloaded buffer is genuinely an image
 * and extracts its dimensions when possible (PNG / JPEG / GIF / WebP).
 */
export function inspectImageBuffer(buffer: Buffer): {
  valid: boolean;
  mimeType?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
  reason?: string | undefined;
} {
  if (!buffer || buffer.length < MIN_IMAGE_BYTES) {
    return { valid: false, reason: 'Buffer de imagem vazio ou menor que o tamanho mínimo válido' };
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    return { valid: false, reason: 'Imagem excede o limite de 8 MB' };
  }

  // PNG magic: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    const width = buffer.length >= 24 ? buffer.readUInt32BE(16) : undefined;
    const height = buffer.length >= 24 ? buffer.readUInt32BE(20) : undefined;
    return { valid: true, mimeType: 'image/png', width, height };
  }

  // JPEG magic: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, mimeType: 'image/jpeg' };
  }

  // GIF magic: 47 49 46 38
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    const width = buffer.length >= 10 ? buffer.readUInt16LE(6) : undefined;
    const height = buffer.length >= 10 ? buffer.readUInt16LE(8) : undefined;
    return { valid: true, mimeType: 'image/gif', width, height };
  }

  // WebP magic: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { valid: true, mimeType: 'image/webp' };
  }

  return { valid: false, reason: 'Assinatura binária (magic bytes) não corresponde a uma imagem válida' };
}

export async function fetchAndValidateImageBuffer(
  imageUrl: string,
  timeoutMs = 7000,
): Promise<{
  ok: boolean;
  buffer?: Buffer | undefined;
  mimeType?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
  reason?: string | undefined;
}> {
  const urlCheck = validateSafeExternalUrl(imageUrl);
  if (!urlCheck.safe || !urlCheck.url) {
    return { ok: false, reason: urlCheck.reason ?? 'URL insegura' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(urlCheck.url.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'LWX-Lab-SiliaCreativeIntelligence/2.0',
        Accept: 'image/png,image/jpeg,image/webp,image/gif,*/*;q=0.5',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, reason: `HTTP ${response.status}` };
    }

    // Re-check final URL after redirects for SSRF protection
    if (response.url) {
      const redirectCheck = validateSafeExternalUrl(response.url);
      if (!redirectCheck.safe) {
        return { ok: false, reason: redirectCheck.reason ?? 'Redirect inseguro bloqueado' };
      }
    }

    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
    if (contentType && !ALLOWED_IMAGE_MIME_TYPES.has(contentType)) {
      return { ok: false, reason: `MIME type inválido: ${contentType}` };
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const inspected = inspectImageBuffer(buffer);
    if (!inspected.valid) {
      return { ok: false, reason: inspected.reason ?? 'Imagem corrompida' };
    }

    return {
      ok: true,
      buffer,
      mimeType: inspected.mimeType || contentType || 'image/png',
      width: inspected.width,
      height: inspected.height,
    };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

export interface SearchQuerySpec {
  category: ReferenceCategory;
  query: string;
  whatItDemonstrates: string;
  whyItFits: string;
  whatNotToCopy: string;
}

/**
 * Decomposes a creative proposal into targeted visual queries across composition,
 * lighting/palette, and style/typography.
 */
export function buildVisualSearchQueries(proposal: CreativeProposal): SearchQuerySpec[] {
  const mood = proposal.creativeConcept.moodKeywords.slice(0, 2).join(' ') || 'dark neon';
  const typeKeyword =
    proposal.projectType === 'logo'
      ? 'emblem crest vector logo design'
      : proposal.projectType === 'illustration'
        ? 'character concept art dramatic rim lighting'
        : 'digital art header composition dramatic lighting';

  return [
    {
      category: 'composition',
      query: `${typeKeyword} ${mood}`,
      whatItDemonstrates: `Distribuição de peso visual, enquadramento (${proposal.composition.aspectRatio}) e separação entre protagonista e fundo.`,
      whyItFits: `Alinha-se diretamente ao fluxo de leitura planejado: ${proposal.composition.readingFlow}`,
      whatNotToCopy:
        'Não copiar personagens, marcas ou textos literais da imagem de referência; aproveitar apenas a estrutura de planos e enquadramento.',
    },
    {
      category: 'palette',
      query: `${proposal.palette[0]?.name || 'dark'} ${proposal.palette[1]?.name || 'violet'} lighting atmosphere art`,
      whatItDemonstrates: `Relação de contraste cromático entre base (${proposal.palette[0]?.hex || '#161024'}) e luzes de destaque (${proposal.palette[1]?.hex || '#8B5CF6'}).`,
      whyItFits: `Demonstra como aplicar ${proposal.visualTreatment.lighting} sem saturar a área da tipografia.`,
      whatNotToCopy:
        'Não replicar texturas sujas ou excesso de elementos secundários que reduzam a legibilidade do título.',
    },
  ];
}

async function searchOpenverseImages(query: string, limit = 2): Promise<
  Array<{
    title: string;
    sourceUrl: string;
    imageUrl: string;
    licenseNote: string;
  }>
> {
  if (process.env.SILIA_OFFLINE_MODE === 'true' || process.env.VITEST) {
    return [];
  }
  const endpoint = `https://api.openverse.engineering/v1/images/?q=${encodeURIComponent(query)}&page_size=${limit}`;
  const urlCheck = validateSafeExternalUrl(endpoint);
  if (!urlCheck.safe) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5500);
  try {
    const res = await fetch(endpoint, {
      headers: { 'User-Agent': 'LWX-Lab-SiliaCreativeIntelligence/2.0' },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{
        title?: string;
        foreign_landing_url?: string;
        thumbnail?: string;
        url?: string;
        license?: string;
      }>;
    };
    return (data.results ?? [])
      .map((item) => ({
        title: item.title?.trim() || 'Referência Visual Openverse',
        sourceUrl: item.foreign_landing_url || item.url || 'https://openverse.org',
        imageUrl: item.thumbnail || item.url || '',
        licenseNote: `Openverse CC (${(item.license || 'by').toUpperCase()})`,
      }))
      .filter((r) => Boolean(r.imageUrl));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolves local LWX Lab Studio portfolio pieces from assets/portfolio/ as verified
 * studio-grade reference benchmarks alongside external search results.
 */
function loadLocalStudioBenchmarkReference(
  projectType: ProjectCategory,
  attemptNumber: number,
): VisualReferenceAsset | null {
  const portfolioDir = path.resolve(process.cwd(), 'assets', 'portfolio');
  const candidateFiles =
    projectType === 'logo'
      ? ['design-09.jpg', 'design-05.jpg', 'design-11.jpg']
      : projectType === 'illustration'
        ? ['design-07.jpg', 'design-09.jpg', 'design-03.jpg']
        : ['design-01.jpg', 'design-05.jpg', 'design-11.jpg', 'design-09.jpg'];

  const chosenFile = candidateFiles[(attemptNumber - 1) % candidateFiles.length] || 'design-01.jpg';
  const fullPath = path.join(portfolioDir, chosenFile);

  try {
    if (fs.existsSync(fullPath)) {
      const buffer = fs.readFileSync(fullPath);
      const inspected = inspectImageBuffer(buffer);
      if (inspected.valid) {
        return {
          id: `ref-studio-${chosenFile.replace(/\W+/g, '-')}`,
          queryUsed: `Benchmark Oficial LWX Lab (${projectType})`,
          category: 'style',
          title: `Acervo Oficial LWX Lab • Peça de Referência (${chosenFile})`,
          sourceUrl: 'https://discord.gg/lwx-lab',
          imageUrl: `attachment://${chosenFile}`,
          provider: 'lwx-studio-portfolio',
          licenseNote: 'Acervo Autoral LWX Lab (Llewxam)',
          mimeType: inspected.mimeType || 'image/jpeg',
          width: inspected.width,
          height: inspected.height,
          byteSize: buffer.length,
          localCachePath: fullPath,
          buffer,
          whatItDemonstrates:
            'Padrão oficial de acabamento, nitidez de recorte (rim light), integração tipográfica e contraste profundo do estúdio LWX Lab.',
          whyItFits:
            'Garante alinhamento imediato com a linguagem visual e qualidade de entrega do designer Llewxam.',
          whatNotToCopy:
            'Adaptar o personagem, texto e paleta exclusivamente para os parâmetros aprovados nesta proposta.',
          validated: true,
        };
      }
    }
  } catch {
    // Ignore local portfolio read error
  }
  return null;
}

/**
 * Searches, downloads, and validates real visual references for a CreativeProposal,
 * combining verified external images (when reachable) with local LWX Lab studio benchmarks
 * and programmatic palette/composition boards so the user and .docx always receive rich, valid images.
 */
export async function gatherVerifiedVisualReferences(
  proposal: CreativeProposal,
): Promise<VisualReferenceAsset[]> {
  const results: VisualReferenceAsset[] = [];
  const queries = buildVisualSearchQueries(proposal);

  // 1. Try external Openverse search with SSRF + binary image verification
  for (const q of queries) {
    const candidates = await searchOpenverseImages(q.query, 2);
    for (const candidate of candidates) {
      const check = await fetchAndValidateImageBuffer(candidate.imageUrl, 5000);
      if (check.ok && check.buffer) {
        results.push({
          id: `ref-ext-${results.length + 1}`,
          queryUsed: q.query,
          category: q.category,
          title: candidate.title,
          sourceUrl: candidate.sourceUrl,
          imageUrl: candidate.imageUrl,
          provider: 'openverse',
          licenseNote: candidate.licenseNote,
          mimeType: check.mimeType || 'image/jpeg',
          width: check.width,
          height: check.height,
          byteSize: check.buffer.length,
          buffer: check.buffer,
          whatItDemonstrates: q.whatItDemonstrates,
          whyItFits: q.whyItFits,
          whatNotToCopy: q.whatNotToCopy,
          validated: true,
        });
        break;
      }
    }
  }

  // 2. Include verified LWX Lab Studio benchmark asset
  const studioRef = loadLocalStudioBenchmarkReference(proposal.projectType, proposal.attemptNumber);
  if (studioRef) {
    results.push(studioRef);
  }

  // 3. Always include programmatic Palette Board & Composition Diagram as verified visual assets
  const paletteBuffer = renderPaletteStripPng(proposal.palette);
  results.push({
    id: `ref-palette-${proposal.proposalId}`,
    queryUsed: 'Gerador Programático de Paleta Cromática HEX/RGB',
    category: 'palette',
    title: `Prancha Cromática Proporcional (${proposal.palette.map((p) => p.hex).join(' • ')})`,
    sourceUrl: 'https://lwx-lab.studio/silia/palette',
    imageUrl: 'attachment://silia-palette-strip.png',
    provider: 'silia-programmatic-renderer',
    licenseNote: 'Gerado pela Silia AI para este projeto',
    mimeType: 'image/png',
    width: 640,
    height: 96,
    byteSize: paletteBuffer.length,
    buffer: paletteBuffer,
    whatItDemonstrates: `Distribuição proporcional exata das ${proposal.palette.length} cores da proposta (${proposal.palette.map((c) => `${c.name} ${c.proportionPct}%`).join(', ')}).`,
    whyItFits: 'Serve como guia direto de conta-gotas (eyedropper) para o designer durante a produção.',
    whatNotToCopy: 'Aplicar as cores respeitando a iluminação volumétrica, evitando chapados sem textura.',
    validated: true,
  });

  const compBuffer = renderCompositionDiagramPng(proposal.composition, proposal.palette);
  results.push({
    id: `ref-comp-${proposal.proposalId}`,
    queryUsed: 'Diagrama Programático de Composição e Hierarquia',
    category: 'composition',
    title: `Mapa de Composição, Margem Segura e Ponto Focal (${proposal.composition.aspectRatio})`,
    sourceUrl: 'https://lwx-lab.studio/silia/composition',
    imageUrl: 'attachment://silia-composition-map.png',
    provider: 'silia-programmatic-renderer',
    licenseNote: 'Gerado pela Silia AI para este projeto',
    mimeType: 'image/png',
    width: 560,
    height: 315,
    byteSize: compBuffer.length,
    buffer: compBuffer,
    whatItDemonstrates: `Ponto focal em (${proposal.composition.focalPoint.xPct}%, ${proposal.composition.focalPoint.yPct}%), margem segura de ${proposal.composition.safeMarginPct}% e zonas de hierarquia.`,
    whyItFits: `Garante que o fluxo de leitura (${proposal.composition.readingFlow}) funcione tanto no PC quanto no celular.`,
    whatNotToCopy: 'As caixas e linhas tracejadas são guias invisíveis de construção; não devem aparecer na arte final.',
    validated: true,
  });

  return results;
}
