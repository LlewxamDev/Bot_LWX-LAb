import fs from 'node:fs';
import path from 'node:path';
import type { ComponentEmojiResolvable, Guild } from 'discord.js';

export type LwxEmojiKey =
  | 'flame'
  | 'knight'
  | 'glitch'
  | 'crown'
  | 'spark'
  | 'palette'
  | 'ticket'
  | 'verify'
  | 'silia';

interface StoredEmojiEntry {
  id: string;
  name: string;
  animated: boolean;
}

type EmojiStoreMap = Partial<Record<LwxEmojiKey, StoredEmojiEntry>>;

const EMOJI_DATA_PATH = path.resolve(process.cwd(), 'data', 'emojis.json');

const EMOJI_DEFS: Record<LwxEmojiKey, { name: string; file: string; fallback: string }> = {
  flame: { name: 'lwx_flame', file: 'lwx_flame.gif', fallback: '🔥' },
  knight: { name: 'lwx_knight', file: 'lwx_knight.gif', fallback: '🛡️' },
  glitch: { name: 'lwx_glitch', file: 'lwx_glitch.gif', fallback: '👾' },
  crown: { name: 'lwx_crown', file: 'lwx_crown.gif', fallback: '👑' },
  spark: { name: 'lwx_spark', file: 'lwx_spark.gif', fallback: '✨' },
  palette: { name: 'lwx_palette', file: 'lwx_palette.gif', fallback: '🎨' },
  ticket: { name: 'lwx_ticket', file: 'lwx_ticket.gif', fallback: '🎫' },
  verify: { name: 'lwx_verify', file: 'lwx_verify.gif', fallback: '✅' },
  silia: { name: 'lwx_silia', file: 'lwx_silia.gif', fallback: '🤖' },
};

let cachedStore: EmojiStoreMap | null = null;

function loadEmojiStore(): EmojiStoreMap {
  if (cachedStore) {
    return cachedStore;
  }

  try {
    if (fs.existsSync(EMOJI_DATA_PATH)) {
      const raw = fs.readFileSync(EMOJI_DATA_PATH, 'utf8');
      cachedStore = JSON.parse(raw) as EmojiStoreMap;
      return cachedStore;
    }
  } catch {
    // Fallback to empty map
  }

  cachedStore = {};
  return cachedStore;
}

function saveEmojiStore(store: EmojiStoreMap): void {
  cachedStore = store;
  const dir = path.dirname(EMOJI_DATA_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(EMOJI_DATA_PATH, JSON.stringify(store, null, 2), 'utf8');
}

/**
 * Returns the Discord markdown string `<a:lwx_flame:ID>` for use inside Embed titles, descriptions, and fields.
 */
export function em(key: LwxEmojiKey): string {
  const store = loadEmojiStore();
  const entry = store[key];
  if (entry?.id) {
    return `<${entry.animated ? 'a' : ''}:${entry.name}:${entry.id}>`;
  }
  return EMOJI_DEFS[key].fallback;
}

/**
 * Returns the ComponentEmojiResolvable object `{ id, name, animated: true }` for Buttons and StringSelectMenus.
 */
export function btnEmoji(key: LwxEmojiKey): ComponentEmojiResolvable {
  const store = loadEmojiStore();
  const entry = store[key];
  if (entry?.id) {
    return {
      id: entry.id,
      name: entry.name,
      animated: entry.animated,
    };
  }
  return EMOJI_DEFS[key].fallback;
}

/**
 * Ensures all 8 custom animated LWX Lab emojis exist in the Discord server and saves their IDs to data/emojis.json.
 */
export async function syncGuildCustomEmojis(guild: Guild): Promise<EmojiStoreMap> {
  const store = loadEmojiStore();
  const existingEmojis = await guild.emojis.fetch().catch(() => null);
  if (!existingEmojis) {
    return store;
  }

  let updated = false;

  for (const key of Object.keys(EMOJI_DEFS) as LwxEmojiKey[]) {
    const def = EMOJI_DEFS[key];
    const found = existingEmojis.find((e) => e.name === def.name);

    if (found) {
      if (!store[key] || store[key]?.id !== found.id) {
        store[key] = {
          id: found.id,
          name: found.name ?? def.name,
          animated: Boolean(found.animated),
        };
        updated = true;
      }
      continue;
    }

    const filePath = path.resolve(process.cwd(), 'assets', 'emojis', def.file);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    try {
      const created = await guild.emojis.create({
        attachment: filePath,
        name: def.name,
        reason: 'LWX Lab — Emojis animados oficiais da identidade visual Llewxam',
      });
      store[key] = {
        id: created.id,
        name: created.name ?? def.name,
        animated: Boolean(created.animated),
      };
      updated = true;
      console.log(`✨ Emoji animado criado no servidor: <a:${created.name}:${created.id}>`);
    } catch (error) {
      console.warn(`Aviso ao criar emoji ${def.name}:`, error instanceof Error ? error.message : error);
    }
  }

  if (updated) {
    saveEmojiStore(store);
  }

  return store;
}
