import OpenAI from "openai";

let cached: OpenAI | undefined;

export class AudioIntegrationNotConfiguredError extends Error {
  constructor() {
    super(
      "Audio mode requires the OpenAI integration. Provision it (Replit AI Integrations → OpenAI) before generating audio.",
    );
    this.name = "AudioIntegrationNotConfiguredError";
  }
}

export function isOpenAIConfigured(): boolean {
  return Boolean(
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL &&
      process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  );
}

/**
 * Lazily construct the OpenAI client. We deliberately do NOT throw at module
 * load: audio mode is optional and tenant-gated, so the rest of the API must
 * boot even if the OpenAI integration isn't provisioned.
 */
export function getOpenAI(): OpenAI {
  if (!isOpenAIConfigured()) {
    throw new AudioIntegrationNotConfiguredError();
  }
  if (!cached) {
    cached = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return cached;
}
