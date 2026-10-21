import dotenv from 'dotenv';

dotenv.config();

export interface BotEnv {
  DISCORD_TOKEN: string;
  DISCORD_CLIENT_ID: string;
  DISCORD_GUILD_ID: string;
  GEMINI_API_KEY: string | undefined;
  OPENAI_API_KEY: string | undefined;
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
  };
}
