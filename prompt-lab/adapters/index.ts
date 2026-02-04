// Prompt Lab - Adapter Registry

import { MasterSchema, RenderedPrompt } from './types';
import { renderForGemini } from './gemini';
import { renderForClaude } from './claude';
import { renderForOpenAI } from './openai';

export type ModelType = 'gemini' | 'claude' | 'openai';

const adapters: Record<ModelType, (schema: MasterSchema, variables?: Record<string, string>) => RenderedPrompt> = {
  gemini: renderForGemini,
  claude: renderForClaude,
  openai: renderForOpenAI,
};

export function renderPrompt(
  schema: MasterSchema,
  model: ModelType,
  variables: Record<string, string> = {}
): RenderedPrompt {
  const adapter = adapters[model];
  if (!adapter) {
    throw new Error(`Unknown model: ${model}. Supported: ${Object.keys(adapters).join(', ')}`);
  }
  return adapter(schema, variables);
}

export function getSupportedModels(): ModelType[] {
  return Object.keys(adapters) as ModelType[];
}

export { renderForGemini, renderForClaude, renderForOpenAI };
export * from './types';
