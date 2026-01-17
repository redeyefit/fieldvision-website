import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Trade categories for construction schedules
export const TRADE_CATEGORIES = [
  'General Conditions',
  'Site Work',
  'Concrete',
  'Masonry',
  'Metals',
  'Wood & Plastics',
  'Thermal & Moisture',
  'Doors & Windows',
  'Finishes',
  'Specialties',
  'Equipment',
  'Furnishings',
  'Special Construction',
  'Conveying Systems',
  'Mechanical',
  'Electrical',
  'Plumbing',
  'HVAC',
  'Fire Protection',
  'Demolition',
  'Cleanup',
] as const;

export type TradeCategory = (typeof TRADE_CATEGORIES)[number];

// Tool definitions for Claude to use structured output
const PARSE_PDF_TOOL = {
  name: 'extract_line_items',
  description: 'Extract construction line items from contract text',
  input_schema: {
    type: 'object' as const,
    properties: {
      line_items: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            text: {
              type: 'string' as const,
              description: 'The line item description from the contract',
            },
            trade: {
              type: 'string' as const,
              enum: TRADE_CATEGORIES,
              description: 'The trade category this item belongs to',
            },
            quantity: {
              type: 'number' as const,
              description: 'Quantity if specified (optional)',
            },
            unit: {
              type: 'string' as const,
              description: 'Unit of measurement if specified (optional)',
            },
          },
          required: ['text', 'trade'],
        },
      },
    },
    required: ['line_items'],
  },
};

const GENERATE_SCHEDULE_TOOL = {
  name: 'generate_schedule',
  description: 'Generate a construction schedule from line items',
  input_schema: {
    type: 'object' as const,
    properties: {
      tasks: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            name: {
              type: 'string' as const,
              description: 'Clear task name for the schedule',
            },
            trade: {
              type: 'string' as const,
              enum: TRADE_CATEGORIES,
              description: 'The trade category',
            },
            duration_days: {
              type: 'number' as const,
              minimum: 1,
              description: 'Estimated duration in workdays',
            },
            depends_on_indices: {
              type: 'array' as const,
              items: { type: 'number' as const },
              description: 'Indices of tasks this depends on (0-based)',
            },
            reasoning: {
              type: 'string' as const,
              description: 'Brief explanation of duration estimate',
            },
          },
          required: ['name', 'trade', 'duration_days', 'depends_on_indices'],
        },
      },
    },
    required: ['tasks'],
  },
};

/**
 * Parse contract PDF text and extract line items
 * Uses Claude tool_use for structured output (prevents prompt injection)
 */
export async function parseContractPDF(
  pdfText: string
): Promise<{
  line_items: Array<{
    text: string;
    trade: string;
    quantity?: number;
    unit?: string;
  }>;
}> {
  const systemPrompt = `You are a construction contract analyst. Extract all scope items, work items, and deliverables from the contract text. Categorize each by trade. Be thorough - include all work mentioned. Ignore pricing, terms, and conditions - focus only on WORK to be performed.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    tools: [PARSE_PDF_TOOL],
    tool_choice: { type: 'tool', name: 'extract_line_items' },
    messages: [
      {
        role: 'user',
        content: `Extract all construction line items from this contract:\n\n${pdfText}`,
      },
    ],
  });

  // Extract tool use result
  const toolUse = response.content.find((block) => block.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Claude did not return structured line items');
  }

  return toolUse.input as {
    line_items: Array<{
      text: string;
      trade: string;
      quantity?: number;
      unit?: string;
    }>;
  };
}

/**
 * Generate schedule from confirmed line items
 * Uses Claude tool_use for structured output
 */
export async function generateSchedule(
  lineItems: Array<{ text: string; trade: string }>
): Promise<{
  tasks: Array<{
    name: string;
    trade: string;
    duration_days: number;
    depends_on_indices: number[];
    reasoning?: string;
  }>;
}> {
  const systemPrompt = `You are a construction scheduling expert. Generate a realistic construction schedule from these line items.

RULES:
1. Order tasks logically (site work before foundation, rough-in before finishes, etc.)
2. Estimate durations based on typical residential/commercial construction
3. Set dependencies - a task should depend on tasks that must complete first
4. Combine related small items into single tasks when logical
5. Duration estimates should be in WORKDAYS (not calendar days)
6. Be conservative - slightly over-estimate rather than under-estimate

TYPICAL DURATIONS (adjust based on scope):
- Demo: 2-5 days
- Site prep: 3-7 days
- Foundation: 5-10 days
- Framing: 10-20 days
- Rough plumbing/electrical: 5-10 days each
- Insulation: 2-5 days
- Drywall: 5-10 days
- Paint: 5-10 days
- Tile: 5-10 days
- Finish work: 5-15 days
- Final cleanup: 2-3 days`;

  const itemsList = lineItems
    .map((item, i) => `${i + 1}. [${item.trade}] ${item.text}`)
    .join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    tools: [GENERATE_SCHEDULE_TOOL],
    tool_choice: { type: 'tool', name: 'generate_schedule' },
    messages: [
      {
        role: 'user',
        content: `Generate a construction schedule for these confirmed line items:\n\n${itemsList}`,
      },
    ],
  });

  // Extract tool use result
  const toolUse = response.content.find((block) => block.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Claude did not return structured schedule');
  }

  return toolUse.input as {
    tasks: Array<{
      name: string;
      trade: string;
      duration_days: number;
      depends_on_indices: number[];
      reasoning?: string;
    }>;
  };
}

/**
 * Ask the Field - answer questions about the schedule (read-only)
 */
export async function askTheField(
  question: string,
  context: {
    tasks: Array<{ name: string; trade: string; duration_days: number; start_date: string; end_date: string }>;
    projectName: string;
  }
): Promise<string> {
  const systemPrompt = `You are "Ask the Field" - a construction scheduling assistant. You can EXPLAIN and SUGGEST but NEVER directly modify the schedule. The user has full control.

You can help with:
- Explaining why tasks are ordered a certain way
- Typical durations for construction tasks
- What might be missing from the schedule
- Best practices for construction sequencing
- Answering questions about the current schedule

Current project: ${context.projectName}
Current schedule:
${context.tasks.map((t, i) => `${i + 1}. ${t.name} (${t.trade}) - ${t.duration_days} days, ${t.start_date} to ${t.end_date}`).join('\n')}

Be concise and practical. Speak like an experienced superintendent.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: question,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  return textBlock && textBlock.type === 'text' ? textBlock.text : 'Unable to process question.';
}
