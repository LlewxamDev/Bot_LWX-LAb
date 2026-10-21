import fs from 'node:fs';
import path from 'node:path';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type EmbedBuilder,
} from 'discord.js';
import { BOT_CONFIG } from '../config/botConfig.js';
import { collectBrandFiles, createStudioEmbed } from '../ui/embeds.js';
import { btnEmoji, em } from '../ui/emojis.js';

export interface ArtDirectionPalette {
  id: string;
  name: string;
  vibe: string;
  lighting: string;
  colors: { hex: string; label: string }[];
}

export const STUDIO_PALETTES: ArtDirectionPalette[] = [
  {
    id: 'knight_glitch',
    name: 'Llewxam Knight Glitch (Assinatura)',
    vibe: 'Estética pixel-glitch roxo/lavanda com chamas azuis cel-shaded e manto carmesim.',
    lighting: 'Contraste neon frio sob fundo obsidiana CRT com detalhes em pixel art.',
    colors: [
      { hex: '#0D0A14', label: 'Void CRT' },
      { hex: '#8B5CF6', label: 'Knight Violet' },
      { hex: '#B794FF', label: 'Pixel Lavender' },
      { hex: '#52B7FF', label: 'Soul Flame' },
      { hex: '#D6456B', label: 'Crimson Scarf' },
    ],
  },
  {
    id: 'soul_azure',
    name: 'Soul-Fire Azure & Abyss',
    vibe: 'Atmosfera mística com chamas etéreas em azul-ciano e sombras abissais.',
    lighting: 'Rim light azul elétrico intenso destacando silhuetas escuras.',
    colors: [
      { hex: '#070B14', label: 'Deep Abyss' },
      { hex: '#1E3A8A', label: 'Midnight Blue' },
      { hex: '#3898FF', label: 'Electric Azure' },
      { hex: '#52B7FF', label: 'Soul Cyan' },
      { hex: '#C4EBFF', label: 'Ice Core' },
    ],
  },
  {
    id: 'crimson_eclipse',
    name: 'Crimson Eclipse & Dark Ornamental',
    vibe: 'Direção dramática de alto impacto em vermelho sangue, grafite e luz cortante.',
    lighting: 'Contra-luz carmesim com vinheta profunda e texturas granulares.',
    colors: [
      { hex: '#0A0608', label: 'Obsidian' },
      { hex: '#3B0813', label: 'Dark Blood' },
      { hex: '#9E1B32', label: 'Ruby Shadow' },
      { hex: '#E11D48', label: 'Crimson Glow' },
      { hex: '#FFE4E6', label: 'Rose Highlight' },
    ],
  },
  {
    id: 'atelier_watercolor',
    name: 'Atelier Aquarela & Nankim',
    vibe: 'Contraste autoral entre azul-cerúleo, magenta vibrante e papel cartolina.',
    lighting: 'Luz quente pêssego/terracota contra céu turquesa aquarelado.',
    colors: [
      { hex: '#140D07', label: 'Nankim Ink' },
      { hex: '#1D889B', label: 'Cerulean Sky' },
      { hex: '#EF0574', label: 'Visor Magenta' },
      { hex: '#D57461', label: 'Terracotta' },
      { hex: '#F2E8D5', label: 'Cartolina' },
    ],
  },
  {
    id: 'royal_obsidian',
    name: 'Royal Gold & Obsidian Luxury',
    vibe: 'Identidade de prestígio para servidores VIP, campeonatos e marcas premium.',
    lighting: 'Reflexos metálicos dourados sobre base preta fosca.',
    colors: [
      { hex: '#09090B', label: 'Matte Black' },
      { hex: '#18181B', label: 'Carbon' },
      { hex: '#854D0E', label: 'Antique Bronze' },
      { hex: '#EAB308', label: 'Royal Gold' },
      { hex: '#FEF08A', label: 'Champagne' },
    ],
  },
  {
    id: 'cyber_amethyst',
    name: 'Cyber Amethyst & Vapor Drift',
    vibe: 'Futurismo digital com gradientes ultravioleta, magenta e ciano.',
    lighting: 'Duotone volumétrico (ciano à esquerda, magenta à direita).',
    colors: [
      { hex: '#0F0720', label: 'Night Grid' },
      { hex: '#4C1D95', label: 'Ultraviolet' },
      { hex: '#C026D3', label: 'Neon Fuchsia' },
      { hex: '#22D3EE', label: 'Cyber Cyan' },
      { hex: '#F8FAFC', label: 'Pure White' },
    ],
  },
];

export function buildPaletteGeneratorMessage(index?: number): {
  palette: ArtDirectionPalette;
  embed: EmbedBuilder;
  files: AttachmentBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const chosenIndex =
    typeof index === 'number'
      ? ((index % STUDIO_PALETTES.length) + STUDIO_PALETTES.length) % STUDIO_PALETTES.length
      : Math.floor(Math.random() * STUDIO_PALETTES.length);

  const palette = STUDIO_PALETTES[chosenIndex] ?? STUDIO_PALETTES[0]!;
  const gifName = `${palette.id}.gif`;
  const gifPath = path.resolve(process.cwd(), 'assets', 'palettes', gifName);
  const brandFiles = collectBrandFiles(['emblem']);

  const swatchesText = palette.colors
    .map((c) => `\`${c.hex}\` **${c.label}**`)
    .join('  •  ');

  const embed = createStudioEmbed('accent')
    .setTitle(`Direção de Arte • ${palette.name}`)
    .setDescription(
      [
        `> ${em('palette')} **Atmosfera:** ${palette.vibe}`,
        `> ${em('flame')} **Iluminação Sugerida:** ${palette.lighting}`,
        '',
        `### ${em('spark')} Harmonia de Cores`,
        swatchesText,
      ].join('\n'),
    );

  const files: AttachmentBuilder[] = [...brandFiles];
  if (fs.existsSync(gifPath)) {
    files.push(new AttachmentBuilder(gifPath, { name: gifName }));
    embed.setImage(`attachment://${gifName}`);
  }

  const nextIdx = (chosenIndex + 1) % STUDIO_PALETTES.length;
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${BOT_CONFIG.customIds.paletteReroll}:${nextIdx}`)
      .setLabel('Próxima Paleta Animada')
      .setEmoji(btnEmoji('glitch'))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${BOT_CONFIG.customIds.budgetOpenModal}`)
      .setLabel('Usar no Meu Orçamento')
      .setEmoji(btnEmoji('ticket'))
      .setStyle(ButtonStyle.Success),
  );

  return {
    palette,
    embed,
    files,
    components: [row],
  };
}

export async function handlePaletteGenInteraction(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
): Promise<void> {
  let requestedIndex: number | undefined;

  if (interaction.isChatInputCommand()) {
    const presetId = interaction.options.getString('estilo');
    if (presetId) {
      const idx = STUDIO_PALETTES.findIndex((p) => p.id === presetId);
      if (idx >= 0) requestedIndex = idx;
    }
  } else if (interaction.isButton() && interaction.customId.startsWith(`${BOT_CONFIG.customIds.paletteReroll}:`)) {
    const rawIdx = Number.parseInt(interaction.customId.split(':')[3] ?? '0', 10);
    if (!Number.isNaN(rawIdx)) requestedIndex = rawIdx;
  }

  const state = buildPaletteGeneratorMessage(requestedIndex);

  if (interaction.isButton() && interaction.customId.startsWith(`${BOT_CONFIG.customIds.paletteReroll}:`)) {
    await interaction.update({
      embeds: [state.embed],
      files: state.files,
      components: state.components,
    });
    return;
  }

  await interaction.reply({
    embeds: [state.embed],
    files: state.files,
    components: state.components,
    flags: MessageFlags.Ephemeral,
  });
}
