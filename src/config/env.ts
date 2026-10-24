import dotenv from 'dotenv';

dotenv.config();

export interface BotEnv {
  DISCORD_TOKEN: string;
  DISCORD_CLIENT_ID: string;
  DISCORD_GUILD_ID: string;
  GEMINI_API_KEY: string | undefined;
  OPENAI_API_KEY: string | undefined;
  GOOGLE_CLOUD_PROJECT: string | undefined;
  GOOGLE_CLOUD_LOCATION: string;
  GOOGLE_GENAI_USE_VERTEXAI: boolean;
  SILIA_PRIMARY_MODEL: string;
  SILIA_FALLBACK_MODEL_1: string;
  SILIA_FALLBACK_MODEL_2: string;
  GOOGLE_DRIVE_CLIENT_ID: string | undefined;
  GOOGLE_DRIVE_CLIENT_SECRET: string | undefined;
  GOOGLE_DRIVE_REFRESH_TOKEN: string | undefined;
  GOOGLE_DRIVE_ROOT_FOLDER_NAME: string;
}

export function getEnv(): BotEnv {
  const token = process.env.DISCORD_TOKEN?.trim() ?? '';
  const clientId = process.env.DISCORD_CLIENT_ID?.trim() ?? '1493045988888285185';
  const guildId = process.env.DISCORD_GUILD_ID?.trim() ?? '1441608284061569209';

  return {
    DISCORD_TOKEN: token,
    DISCORD_CLIENT_ID: clientId,
    DISCORD_GUILD_ID: guildId,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT?.trim() || undefined,
    GOOGLE_CLOUD_LOCATION: process.env.GOOGLE_CLOUD_LOCATION?.trim() || 'global',
    GOOGLE_GENAI_USE_VERTEXAI:
      (process.env.GOOGLE_GENAI_USE_VERTEXAI?.trim().toLowerCase() ?? 'true') !== 'false',
    SILIA_PRIMARY_MODEL: process.env.SILIA_PRIMARY_MODEL?.trim() || 'gemini-3.8-flash',
    SILIA_FALLBACK_MODEL_1: process.env.SILIA_FALLBACK_MODEL_1?.trim() || 'gemini-3.6-flash',
    SILIA_FALLBACK_MODEL_2: process.env.SILIA_FALLBACK_MODEL_2?.trim() || 'gemini-3.5-flash-lite',
    GOOGLE_DRIVE_CLIENT_ID: process.env.GOOGLE_DRIVE_CLIENT_ID?.trim() || undefined,
    GOOGLE_DRIVE_CLIENT_SECRET: process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim() || undefined,
    GOOGLE_DRIVE_REFRESH_TOKEN: process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim() || undefined,
    GOOGLE_DRIVE_ROOT_FOLDER_NAME:
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME?.trim() || 'Silia AI',
  };
}
