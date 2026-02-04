// Prompt Lab - Gemini Adapter
// Behavioral quirks: Shorter prompts perform better, explicit multimodal instructions

import { MasterSchema, RenderedPrompt } from './types';

export function renderForGemini(schema: MasterSchema, variables: Record<string, string> = {}): RenderedPrompt {
  const config = schema.adapter_overrides?.gemini || {};

  // Gemini prefers concise, direct prompts
  let prompt = '';

  // Goal - direct and concise
  prompt += schema.goal.trim() + '\n\n';

  // Context - brief
  if (schema.context) {
    prompt += schema.context.trim() + '\n\n';
  }

  // Constraints as bullet list (Gemini responds well to clear rules)
  prompt += 'CRITICAL RULES:\n';
  for (const constraint of schema.constraints) {
    prompt += `- ${constraint}\n`;
  }
  prompt += '\n';

  // Anti-hallucination emphasis (Gemini-specific)
  if (config.emphasis) {
    prompt += `IMPORTANT: ${config.emphasis}\n\n`;
  }

  // Instructions - simplified for Gemini
  if (config.prompt_length !== 'concise' && schema.instructions) {
    prompt += 'STEPS:\n';
    for (let i = 0; i < schema.instructions.length; i++) {
      const inst = schema.instructions[i];
      prompt += `${i + 1}. ${inst.step}: ${inst.action}\n`;
    }
    prompt += '\n';
  }

  // Output format - explicit JSON schema
  prompt += 'OUTPUT FORMAT:\n';
  prompt += 'Return ONLY valid JSON matching this structure (no markdown, no code blocks):\n';
  prompt += JSON.stringify(simplifySchema(schema.output_schema), null, 2);
  prompt += '\n';

  // Replace variables
  for (const [key, value] of Object.entries(variables)) {
    prompt = prompt.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
  }

  return {
    model: 'gemini',
    user: prompt.trim(),
    outputFormat: 'json'
  };
}

// Simplify JSON schema to example format for Gemini
function simplifySchema(schema: any): any {
  if (schema.type === 'object' && schema.properties) {
    const result: any = {};
    for (const [key, value] of Object.entries(schema.properties) as [string, any][]) {
      result[key] = simplifySchema(value);
    }
    return result;
  }
  if (schema.type === 'array' && schema.items) {
    return [simplifySchema(schema.items)];
  }
  if (schema.type === 'string') return '<string>';
  if (schema.type === 'number') return '<number>';
  if (schema.type === 'integer') return '<integer>';
  if (schema.type === 'boolean') return '<boolean>';
  if (schema.enum) return schema.enum[0];
  return '<value>';
}

export default renderForGemini;
