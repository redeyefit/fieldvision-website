// Prompt Lab - Claude Adapter
// Behavioral quirks: Benefits from step-by-step reasoning, explicit system roles,
// needs strong anti-hallucination instructions, tends to over-explain

import { MasterSchema, RenderedPrompt } from './types';

export function renderForClaude(schema: MasterSchema, variables: Record<string, string> = {}): RenderedPrompt {
  const config = schema.adapter_overrides?.claude || {};

  // System prompt (Claude benefits from clear role definition)
  let system = config.system_role || 'You are a precise document analyst.';

  if (config.output_constraint === 'strict') {
    system += ' You return ONLY valid JSON with no additional text or explanation.';
  }

  // User prompt
  let user = '';

  // Goal with context
  user += '## GOAL\n';
  user += schema.goal.trim() + '\n\n';

  if (schema.context) {
    user += '## CONTEXT\n';
    user += schema.context.trim() + '\n\n';
  }

  // Constraints with strong anti-hallucination emphasis
  user += '## CRITICAL INSTRUCTIONS\n';
  for (const constraint of schema.constraints) {
    user += `- ${constraint}\n`;
  }

  // Add anti-hallucination if configured
  if (config.anti_hallucination_emphasis === 'strong') {
    user += `- Do NOT make up or invent information - only report what you can SEE\n`;
    user += `- If uncertain, mark as "UNCERTAIN" or omit rather than guessing\n`;
    user += `- Every piece of data must have visible evidence in the image\n`;
  }
  user += '\n';

  // Step-by-step instructions (Claude thinks better this way)
  if (config.add_step_by_step && schema.instructions) {
    user += '## APPROACH\n';
    user += 'Work through this systematically:\n';
    for (let i = 0; i < schema.instructions.length; i++) {
      const inst = schema.instructions[i];
      user += `${i + 1}. **${inst.step}**: ${inst.action}\n`;
    }
    user += '\n';
  }

  // Output format
  user += '## OUTPUT FORMAT\n';
  user += 'Return ONLY valid JSON matching this schema:\n';
  user += '```json\n';
  user += JSON.stringify(schemaToExample(schema.output_schema), null, 2);
  user += '\n```\n\n';

  // Final validation check (Claude benefits from this)
  user += '## BEFORE RESPONDING\n';
  user += 'Verify:\n';
  user += '1. Every room listed has a visible label on the plan\n';
  user += '2. Every number comes from dimension strings or labels, not estimation\n';
  user += '3. No invented or guessed information\n';

  // Replace variables
  for (const [key, value] of Object.entries(variables)) {
    user = user.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
    system = system.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
  }

  return {
    model: 'claude',
    system: system.trim(),
    user: user.trim(),
    outputFormat: 'json'
  };
}

// Convert JSON schema to example object for Claude
function schemaToExample(schema: any): any {
  if (schema.type === 'object' && schema.properties) {
    const result: any = {};
    for (const [key, value] of Object.entries(schema.properties) as [string, any][]) {
      if (!schema.required || schema.required.includes(key) || Math.random() > 0.5) {
        result[key] = schemaToExample(value);
      }
    }
    return result;
  }
  if (schema.type === 'array' && schema.items) {
    return [schemaToExample(schema.items)];
  }
  if (schema.type === 'string') {
    if (schema.description) return `<${schema.description}>`;
    return '<string>';
  }
  if (schema.type === 'number') return 0.0;
  if (schema.type === 'integer') return 0;
  if (schema.type === 'boolean') return false;
  if (schema.enum) return schema.enum[0];
  if (schema.nullable) return null;
  return '<value>';
}

export default renderForClaude;
