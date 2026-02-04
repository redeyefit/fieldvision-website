// Prompt Lab - Model Runner
// Calls AI model APIs with rendered prompts

import * as fs from 'fs';
import * as path from 'path';
import { RenderedPrompt, ModelType } from '../adapters/types';

// Load environment variables
const GEMINI_API_KEY = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export interface RunResult {
  success: boolean;
  output?: any;
  error?: string;
  latencyMs: number;
}

export async function runPrompt(
  prompt: RenderedPrompt,
  imagePath?: string
): Promise<RunResult> {
  const startTime = Date.now();

  try {
    let result: any;

    switch (prompt.model) {
      case 'gemini':
        result = await runGemini(prompt, imagePath);
        break;
      case 'claude':
        result = await runClaude(prompt, imagePath);
        break;
      case 'openai':
        result = await runOpenAI(prompt, imagePath);
        break;
      default:
        throw new Error(`Unknown model: ${prompt.model}`);
    }

    return {
      success: true,
      output: result,
      latencyMs: Date.now() - startTime
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      latencyMs: Date.now() - startTime
    };
  }
}

async function runGemini(prompt: RenderedPrompt, imagePath?: string): Promise<any> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not set');
  }

  const model = 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const parts: any[] = [{ text: prompt.user }];

  // Add image if provided
  if (imagePath) {
    const imageData = fs.readFileSync(imagePath);
    const base64 = imageData.toString('base64');
    const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

    parts.unshift({
      inline_data: {
        mime_type: mimeType,
        data: base64
      }
    });
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data: any = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('No response from Gemini');
  }

  return parseJsonResponse(text);
}

async function runClaude(prompt: RenderedPrompt, imagePath?: string): Promise<any> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not set');
  }

  const url = 'https://api.anthropic.com/v1/messages';

  const content: any[] = [];

  // Add image if provided
  if (imagePath) {
    const imageData = fs.readFileSync(imagePath);
    const base64 = imageData.toString('base64');
    const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: mimeType,
        data: base64
      }
    });
  }

  content.push({ type: 'text', text: prompt.user });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: prompt.system,
      messages: [{ role: 'user', content }]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const data: any = await response.json();
  const text = data.content?.[0]?.text;

  if (!text) {
    throw new Error('No response from Claude');
  }

  return parseJsonResponse(text);
}

async function runOpenAI(prompt: RenderedPrompt, imagePath?: string): Promise<any> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set');
  }

  const url = 'https://api.openai.com/v1/chat/completions';

  const content: any[] = [];

  // Add image if provided
  if (imagePath) {
    const imageData = fs.readFileSync(imagePath);
    const base64 = imageData.toString('base64');
    const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${mimeType};base64,${base64}`
      }
    });
  }

  content.push({ type: 'text', text: prompt.user });

  const messages: any[] = [];
  if (prompt.system) {
    messages.push({ role: 'system', content: prompt.system });
  }
  messages.push({ role: 'user', content });

  const body: any = {
    model: 'gpt-4o',
    max_tokens: 4096,
    messages
  };

  if (prompt.outputFormat === 'json') {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data: any = await response.json();
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error('No response from OpenAI');
  }

  return parseJsonResponse(text);
}

function parseJsonResponse(text: string): any {
  // Clean markdown code blocks
  let cleaned = text.trim();

  if (cleaned.startsWith('```')) {
    const firstNewline = cleaned.indexOf('\n');
    if (firstNewline > 0) {
      cleaned = cleaned.substring(firstNewline + 1);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();
  }

  // Extract JSON object
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Failed to parse JSON response: ${e}. Raw: ${text.substring(0, 200)}...`);
  }
}
