import Anthropic from '@anthropic-ai/sdk';
import { TRADE_CATEGORIES, TradeCategory } from '@/lib/schedule/trades';

// Re-export for backwards compatibility with server-side code
export { TRADE_CATEGORIES };
export type { TradeCategory };

// Initialize Anthropic client (server-side only)
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('[Anthropic] WARNING: ANTHROPIC_API_KEY is not set!');
}
const anthropic = new Anthropic({
  apiKey: apiKey,
});

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
  console.log('[Anthropic] parseContractPDF called, text length:', pdfText.length);
  console.log('[Anthropic] Text preview:', pdfText.substring(0, 500));

  const systemPrompt = `You are a construction contract analyst. Extract all scope items, work items, and deliverables from the contract text. Categorize each by trade. Be thorough - include all work mentioned. Ignore pricing, terms, and conditions - focus only on WORK to be performed.`;

  console.log('[Anthropic] Calling Claude API with model claude-sonnet-4-20250514');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514', // Sonnet 4 - reliable and thorough for contract parsing
      max_tokens: 8192, // Increased from 4096 - complex PDFs need more tokens for full JSON output
      temperature: 0, // Deterministic output - same PDF should extract same items
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

    console.log('[Anthropic] Response received, stop_reason:', response.stop_reason);
    console.log('[Anthropic] Response content types:', response.content.map(b => b.type));
    console.log('[Anthropic] Full response:', JSON.stringify(response, null, 2).substring(0, 2000));

    // Extract tool use result
    const toolUse = response.content.find((block) => block.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      console.error('[Anthropic] No tool_use block found in response');
      throw new Error('Claude did not return structured line items');
    }

    console.log('[Anthropic] Tool use found:', toolUse.name);
    console.log('[Anthropic] Tool input:', JSON.stringify(toolUse.input).substring(0, 1000));

    const result = toolUse.input as {
      line_items: Array<{
        text: string;
        trade: string;
        quantity?: number;
        unit?: string;
      }>;
    };

    console.log('[Anthropic] Extracted', result.line_items?.length || 0, 'line items');
    if (result.line_items?.length > 0) {
      console.log('[Anthropic] First item:', JSON.stringify(result.line_items[0]));
    }

    return result;
  } catch (error) {
    console.error('[Anthropic] API error:', error);
    throw error;
  }
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
  const systemPrompt = `You are a construction scheduling expert. Generate a DETAILED construction schedule by breaking down each line item into realistic construction phases.

CRITICAL: Break down each scope item into multiple sub-tasks representing real construction phases. For example:
- "Stone countertops" becomes: Stone - Templates (1 day), Stone - Fabrication (5 days), Stone - Install (2 days), Stone - Seal (1 day)
- "Electrical" becomes: Electrical - Rough-in (5 days), Electrical - Trim (3 days), Electrical - Finals/Testing (1 day)
- "Tile work" becomes: Tile - Layout/Prep (1 day), Tile - Waterproofing (1 day), Tile - Install (5 days), Tile - Grout (2 days), Tile - Seal (1 day)
- "Cabinets" becomes: Cabinets - Delivery/Stage (1 day), Cabinets - Install Base (2 days), Cabinets - Install Upper (2 days), Cabinets - Hardware/Adjust (1 day)

NAMING FORMAT: "[Material/Trade] - [Phase]" (e.g., "Plumbing - Rough-in", "Paint - Prime", "Paint - Finish Coat")

RULES:
1. ALWAYS break down items into multiple realistic phases - never leave a single generic task
2. Order tasks logically (demo → rough-in → finishes → punch)
3. Set dependencies accurately - a task depends on what must complete first
4. Duration estimates in WORKDAYS (not calendar days)
5. Be conservative - slightly over-estimate rather than under-estimate
6. EXCLUDE administrative/overhead items - these are NOT schedulable tasks:
   - General Conditions (supervision, safety meetings, job site management)
   - Documentation (daily logs, photo documentation, schedule updates)
   - Communication (owner meetings, RFIs, submittals)
   - Permits/Inspections scheduling (just schedule the actual inspection, not tracking)
   ONLY include actual PHYSICAL CONSTRUCTION WORK that crews perform.

COMMON PHASE BREAKDOWNS:
- Demo: Protection/Prep, Demo, Haul-off
- Framing: Layout, Walls, Headers/Beams, Blocking, Sheathing
- Plumbing: Rough-in, Top-out, Trim, Finals
- Electrical: Rough-in, Low Voltage, Trim, Finals/Testing
- HVAC: Rough-in, Equipment Set, Trim, Start-up/Balance
- Drywall: Hang, Tape/Mud, Texture, Touch-up
- Paint: Prep/Prime, Paint Walls, Paint Trim, Touch-up
- Flooring: Prep/Level, Install, Transitions/Trim
- Tile: Waterproofing, Layout, Install, Grout, Seal
- Cabinets: Receive/Stage, Install Base, Install Upper, Hardware
- Countertops: Template, Fabricate, Install, Seal
- Appliances: Receive, Set, Connect, Test`;

  const itemsList = lineItems
    .map((item, i) => `${i + 1}. [${item.trade}] ${item.text}`)
    .join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514', // Sonnet for better reasoning on dependencies & durations
    max_tokens: 8192,
    temperature: 0, // Deterministic output - same contract should produce same schedule
    system: systemPrompt,
    tools: [GENERATE_SCHEDULE_TOOL],
    tool_choice: { type: 'tool', name: 'generate_schedule' },
    messages: [
      {
        role: 'user',
        content: `Generate a DETAILED construction schedule for these scope items. Break down EVERY item into multiple sub-tasks with realistic phases (e.g., Stone becomes: Templates, Fabricate, Install, Seal).\n\nScope Items:\n${itemsList}`,
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
    model: 'claude-sonnet-4-20250514', // Sonnet for expert construction reasoning
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
