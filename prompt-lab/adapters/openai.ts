// Prompt Lab - OpenAI (GPT-4) Adapter
// Behavioral quirks: Strong JSON mode support, explicit schema enforcement,
// directive system prompts work well

import { MasterSchema, RenderedPrompt } from './types';

export function renderForOpenAI(schema: MasterSchema, variables: Record<string, string> = {}): RenderedPrompt {
  const config = schema.adapter_overrides?.openai || {};

  // System prompt - directive style works best for GPT
  let system = '';

  if (config.system_prompt_style === 'directive') {
    system = 'You are a precise document analysis system. ';
    system += 'You analyze images and return structured JSON data. ';
    system += 'You NEVER invent or guess information - only report what is visible. ';
    system += 'Your output is ALWAYS valid JSON with no additional text.';
  } else {
    system = 'You are a helpful assistant that analyzes construction documents.';
  }

  // User prompt
  let user = '';

  // Goal
  user += 'TASK:\n';
  user += schema.goal.trim() + '\n\n';

  // Context
  if (schema.context) {
    user += 'CONTEXT:\n';
    user += schema.context.trim() + '\n\n';
  }

  // Constraints
  user += 'RULES:\n';
  for (const constraint of schema.constraints) {
    user += `• ${constraint}\n`;
  }
  user += '\n';

  // Instructions (GPT handles numbered lists well)
  if (schema.instructions) {
    user += 'STEPS:\n';
    for (let i = 0; i < schema.instructions.length; i++) {
      const inst = schema.instructions[i];
      user += `${i + 1}. ${inst.step} - ${inst.action}\n`;
    }
    user += '\n';
  }

  // JSON Schema (GPT-4 loves explicit schemas)
  user += 'OUTPUT SCHEMA:\n';
  user += 'Return a JSON object conforming to this schema:\n';
  user += JSON.stringify(schema.output_schema, null, 2);
  user += '\n\n';

  // Enforcement
  if (config.output_format_enforcement === 'json_mode' || config.output_format_enforcement === 'json_strict') {
    user += 'IMPORTANT: Return ONLY the JSON object. No explanations, no markdown code blocks.';
  }

  // Replace variables
  for (const [key, value] of Object.entries(variables)) {
    user = user.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
    system = system.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
  }

  return {
    model: 'openai',
    system: system.trim(),
    user: user.trim(),
    outputFormat: config.output_format_enforcement === 'json_mode' ? 'json' : 'text'
  };
}

export default renderForOpenAI;
