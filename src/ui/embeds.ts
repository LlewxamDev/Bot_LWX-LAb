import fs from 'node:fs';
import path from 'node:path';
import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { BOT_CONFIG } from '../config/botConfig.js';
import { em } from './emojis.js';

type PaletteKey = keyof typeof BOT_CONFIG.brand.palette;

export const BRAND_BANNERS = {
  emblem: 'knight-avatar.png',
  animatedEmblem: 'knight-emblem.gif',
  siliaAvatar: 'silia-avatar.png',
  siliaEmblem: 'silia-emblem.gif',
  divider: 'divider-glitch.gif',
  register: 'banner-register.gif',
  portfolio: 'banner-portfolio.gif',
  pricing: 'banner-pricing.gif',
  reviews: 'banner-reviews.gif',
  budget: 'banner-budget.gif',
  welcome: 'banner-welcome.gif',
  rules: 'banner-rules.gif',
  silia: 'banner-silia.gif',
} as const;

export type BrandBannerKey = keyof typeof BRAND_BANNERS;

export function resolveBrandAssetPath(fileName: string): string {
  return path.resolve(process.cwd(), 'assets', 'brand', fileName);
}

export function getBrandAttachment(key: BrandBannerKey): AttachmentBuilder | null {
  const fileName = BRAND_BANNERS[key];
  const fullPath = resolveBrandAssetPath(fileName);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return new AttachmentBuilder(fullPath, { name: fileName });
}

export function getBrandAttachmentUrl(key: BrandBannerKey): string {
  return `attachment://${BRAND_BANNERS[key]}`;
}

export function collectBrandFiles(keys: BrandBannerKey[]): AttachmentBuilder[] {
  const unique = Array.from(new Set(keys));
  const list: AttachmentBuilder[] = [];
  for (const key of unique) {
    const att = getBrandAttachment(key);
    if (att) {
      list.push(att);
    }
  }
  return list;
}

/**
 * Creates a sleek, modern Discord embed using the Knight Logo palette,
 * crisp author header, and branded footer (without any terminal codeblocks).
 */
export function createStudioEmbed(variant: PaletteKey = 'primary'): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(BOT_CONFIG.brand.palette[variant])
    .setAuthor({
      name: `${BOT_CONFIG.brand.name} • Design Studio`,
      iconURL: getBrandAttachmentUrl('emblem'),
    })
    .setFooter({
      text: BOT_CONFIG.brand.footer,
      iconURL: getBrandAttachmentUrl('emblem'),
    })
    .setTimestamp();

  return embed;
}

/**
 * Creates a dedicated embed for Silia AI featuring her custom winking robot + golden star logo.
 */
export function createSiliaEmbed(variant: PaletteKey = 'primary'): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BOT_CONFIG.brand.palette[variant])
    .setAuthor({
      name: 'Silia AI • Assistente Criativa LWX Lab',
      iconURL: getBrandAttachmentUrl('siliaAvatar'),
    })
    .setThumbnail(getBrandAttachmentUrl('siliaEmblem'))
    .setImage(getBrandAttachmentUrl('divider'))
    .setFooter({
      text: 'Silia AI • Inteligência Criativa do Estúdio LWX Lab',
      iconURL: getBrandAttachmentUrl('siliaAvatar'),
    })
    .setTimestamp();
}

/**
 * Creates the signature "Double-Embed" Luxury Layout:
 * - Embed 1: Edge-to-edge Animated GIF Banner in the Knight Logo style
 * - Embed 2: Main content card with animated Knight emblem thumbnail and animated glitch divider bar at the bottom
 */
export function createDoubleBannerEmbeds(
  bannerKey: Exclude<BrandBannerKey, 'emblem' | 'animatedEmblem' | 'siliaAvatar' | 'siliaEmblem' | 'divider'>,
  variant: PaletteKey = 'primary',
): { headerEmbed: EmbedBuilder; bodyEmbed: EmbedBuilder; files: AttachmentBuilder[] } {
  const color = BOT_CONFIG.brand.palette[variant];

  const headerEmbed = new EmbedBuilder()
    .setColor(color)
    .setImage(getBrandAttachmentUrl(bannerKey));

  const isSilia = bannerKey === 'silia';

  const bodyEmbed = isSilia
    ? createSiliaEmbed(variant)
    : createStudioEmbed(variant)
        .setThumbnail(getBrandAttachmentUrl('animatedEmblem'))
        .setImage(getBrandAttachmentUrl('divider'));

  const files = isSilia
    ? collectBrandFiles(['siliaAvatar', 'siliaEmblem', 'divider', bannerKey])
    : collectBrandFiles(['emblem', 'animatedEmblem', 'divider', bannerKey]);

  return { headerEmbed, bodyEmbed, files };
}

/**
 * Builds a clean visual progress bar for Order Tracking & Ratings.
 */
export function buildProgressBar(current: number, total: number, length = 8): string {
  const ratio = Math.max(0, Math.min(1, current / Math.max(1, total)));
  const filled = Math.round(ratio * length);
  const empty = Math.max(0, length - filled);
  const pct = Math.round(ratio * 100);
  return `${'▰'.repeat(filled)}${'▱'.repeat(empty)} **${pct}%**`;
}

/**
 * Formats a clean luxury callout block using Discord's native blockquotes and custom animated emojis.
 */
export function formatLuxuryCallout(title: string, description: string): string {
  return [
    `> ${em('spark')} **${title}**`,
    `> ${description}`,
  ].join('\n');
}
