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

const SCHEDULE_SYSTEM_PROMPT = `You are a construction scheduling expert creating EFFICIENT, REALISTIC schedules for residential renovations.

GOAL: Create a practical schedule with appropriate detail. More scope items = more tasks.

TASK COUNT GUIDELINES (based on input size):
- 10-30 line items → 8-15 tasks (small remodel)
- 30-60 line items → 15-25 tasks (medium project)
- 60-100 line items → 25-40 tasks (large renovation)
- 100+ line items → 40-60 tasks (major project)

CRITICAL RULES:

1. PRESERVE MEANINGFUL DETAIL - Keep distinct work items separate:
   - Separate tasks for different rooms/areas (Kitchen Demo vs Bathroom Demo)
   - Separate phases within trades (Rough-in vs Trim-out vs Finals)
   - If the contract lists it separately, keep it separate
   - ONLY combine truly redundant items (e.g., "install outlet" and "install outlets" → one task)

2. MAXIMIZE PARALLEL WORK - Multiple trades work simultaneously:
   - Plumbing, Electrical, HVAC rough-ins happen CONCURRENTLY (same time period)
   - Tile in bathrooms while paint in other rooms
   - Cabinet install while countertop fabrication (off-site)
   - Flooring in one area while trim in another

3. REALISTIC DURATIONS - Use actual crew productivity:
   - Demo per area: 1-3 days
   - Rough-in per trade: 3-8 days depending on scope
   - Drywall: 5-10 days (hang + tape + texture)
   - Paint per area: 2-5 days
   - Tile per bathroom: 3-5 days
   - Cabinet install: 2-4 days
   - Flooring per area: 2-4 days

4. OFF-SITE WORK PARALLEL - Fabrication doesn't extend timeline:
   - Countertop template → fabrication happens DURING other work → install
   - Custom cabinets fabricate BEFORE needed, deliver on time
   - Don't put fabrication on critical path

5. DEPENDENCIES - Only set TRUE blockers:
   - Rough-ins need framing complete
   - Drywall needs ALL rough-ins + insulation done
   - Paint needs drywall done
   - Cabinets need paint done (or paint after)
   - Countertops need cabinets
   - BUT: rough-ins don't depend on each other (parallel!)

NAMING FORMAT: "[Trade] - [Specific Work]" (e.g., "Plumbing - Kitchen Rough-in", "Paint - Master Bedroom")

EXCLUDE: General conditions, supervision, documentation, meetings, permit tracking.
ONLY include PHYSICAL CONSTRUCTION WORK.`;

/**
 * Generate schedule for a single batch of items
 */
async function generateScheduleBatch(
  lineItems: Array<{ text: string; trade: string }>,
  batchContext?: string
): Promise<Array<{
  name: string;
  trade: string;
  duration_days: number;
  depends_on_indices: number[];
  reasoning?: string;
}>> {
  const itemsList = lineItems
    .map((item, i) => `${i + 1}. [${item.trade}] ${item.text}`)
    .join('\n');

  const contextNote = batchContext ? `\n\nCONTEXT: ${batchContext}` : '';

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16384,
    temperature: 0,
    system: SCHEDULE_SYSTEM_PROMPT,
    tools: [GENERATE_SCHEDULE_TOOL],
    tool_choice: { type: 'tool', name: 'generate_schedule' },
    messages: [
      {
        role: 'user',
        content: `Generate a construction schedule for these ${lineItems.length} scope items. Create approximately ${Math.max(5, Math.ceil(lineItems.length / 4))} to ${Math.max(10, Math.ceil(lineItems.length / 2))} tasks - keep distinct work items separate.${contextNote}\n\nScope Items:\n${itemsList}`,
      },
    ],
  });

  console.log(`[Anthropic] Batch response stop_reason: ${response.stop_reason}, usage: ${JSON.stringify(response.usage)}`);

  const toolUse = response.content.find((block) => block.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Claude did not return structured schedule');
  }

  const result = toolUse.input as { tasks: Array<{
    name: string;
    trade: string;
    duration_days: number;
    depends_on_indices: number[];
    reasoning?: string;
  }>};

  return result.tasks;
}

/**
 * Generate schedule from confirmed line items
 * For large contracts (>30 items), processes in batches and merges results
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
  console.log(`[Anthropic] generateSchedule called with ${lineItems.length} items`);

  // For small contracts, process in one call
  if (lineItems.length <= 30) {
    const tasks = await generateScheduleBatch(lineItems);
    return { tasks };
  }

  // For large contracts, batch by trade to stay within token limits
  console.log(`[Anthropic] Large contract detected, processing in batches by trade`);

  // Group items by trade
  const itemsByTrade: Record<string, Array<{ text: string; trade: string }>> = {};
  for (const item of lineItems) {
    const trade = item.trade || 'General';
    if (!itemsByTrade[trade]) {
      itemsByTrade[trade] = [];
    }
    itemsByTrade[trade].push(item);
  }

  const trades = Object.keys(itemsByTrade);
  console.log(`[Anthropic] Found ${trades.length} trades: ${trades.join(', ')}`);

  // Process each trade batch
  const allTasks: Array<{
    name: string;
    trade: string;
    duration_days: number;
    depends_on_indices: number[];
    reasoning?: string;
  }> = [];

  for (const trade of trades) {
    const tradeItems = itemsByTrade[trade];
    console.log(`[Anthropic] Processing ${trade}: ${tradeItems.length} items`);

    try {
      const tradeTasks = await generateScheduleBatch(
        tradeItems,
        `This is the ${trade} portion of a larger project with ${lineItems.length} total items. Create ${Math.max(2, Math.ceil(tradeItems.length / 5))} to ${Math.max(4, Math.ceil(tradeItems.length / 3))} tasks for this trade. Keep distinct work items separate - only combine truly redundant items.`
      );

      // Reset dependency indices for this batch (will be recalculated later)
      const tasksWithResetDeps = tradeTasks.map(task => ({
        ...task,
        depends_on_indices: [], // Dependencies will be recalculated based on construction logic
      }));

      allTasks.push(...tasksWithResetDeps);
      console.log(`[Anthropic] ${trade}: generated ${tradeTasks.length} tasks`);
    } catch (err) {
      console.error(`[Anthropic] Failed to process ${trade}:`, err);
      // Continue with other trades
    }
  }

  // Now do a final pass to sequence all tasks properly
  if (allTasks.length > 0) {
    console.log(`[Anthropic] Final sequencing pass for ${allTasks.length} tasks`);
    const sequencedTasks = await sequenceAllTasks(allTasks);
    return { tasks: sequencedTasks };
  }

  return { tasks: allTasks };
}

/**
 * Final pass to sequence all tasks from batches and set cross-trade dependencies
 */
async function sequenceAllTasks(
  tasks: Array<{
    name: string;
    trade: string;
    duration_days: number;
    depends_on_indices: number[];
    reasoning?: string;
  }>
): Promise<Array<{
  name: string;
  trade: string;
  duration_days: number;
  depends_on_indices: number[];
  reasoning?: string;
}>> {
  const taskList = tasks.map((t, i) => `${i}. [${t.trade}] ${t.name} (${t.duration_days} days)`).join('\n');

  const sequencingPrompt = `You are a construction scheduling expert. Given a list of tasks from different trades, you need to:
1. REORDER them in proper construction sequence
2. SET DEPENDENCIES to MAXIMIZE PARALLEL WORK - only set TRUE blockers

GOAL: Create a TIGHT schedule. Trades work CONCURRENTLY whenever possible.

SEQUENCING ORDER:
1. Demo/Protection (first)
2. Framing
3. Rough-ins - Plumbing, Electrical, HVAC run IN PARALLEL (no deps between them)
4. Insulation (after ALL rough-ins)
5. Drywall (after insulation)
6. Paint (after drywall)
7. Cabinets (after paint OR overlap with paint)
8. Countertops (after cabinets - but fabrication is parallel earlier)
9. Tile (can overlap with paint in different areas)
10. Flooring (near end)
11. Finals/testing/punch (last)

CRITICAL - PARALLEL WORK:
- ALL rough-ins (MEP) depend only on framing, NOT on each other
- Tile in bathroom can run while paint in living areas
- Cabinet install while countertop fabricates off-site
- Multiple finish trades can work in different rooms simultaneously

DEPENDENCY RULES:
- depends_on_indices uses 0-based index of REORDERED list
- Only set dependencies for TRUE blockers (can't physically start without predecessor)
- Rough-ins should have ZERO dependencies between each other
- Trim phases depend on drywall/paint, not on rough-in completion`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16384,
    temperature: 0,
    system: sequencingPrompt,
    tools: [GENERATE_SCHEDULE_TOOL],
    tool_choice: { type: 'tool', name: 'generate_schedule' },
    messages: [
      {
        role: 'user',
        content: `Reorder and set dependencies for these ${tasks.length} tasks. MAXIMIZE PARALLEL WORK - rough-ins concurrent, trades overlap where possible. Target a TIGHT schedule:\n\n${taskList}`,
      },
    ],
  });

  console.log(`[Anthropic] Sequencing response stop_reason: ${response.stop_reason}`);

  const toolUse = response.content.find((block) => block.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    console.error('[Anthropic] Sequencing failed, returning unsequenced tasks');
    return tasks;
  }

  const result = toolUse.input as { tasks: Array<{
    name: string;
    trade: string;
    duration_days: number;
    depends_on_indices: number[];
    reasoning?: string;
  }>};

  return result.tasks;
}

// Types for ChatGPT enrichment (imported from openai.ts)
interface EnrichedPhase {
  name: string;
  typical_duration_days: number;
}

interface EnrichedLineItem {
  original: string;
  trade: string;
  phases: EnrichedPhase[];
  common_dependencies: string[];
  notes: string;
}

interface EnrichmentResult {
  enriched_items: EnrichedLineItem[];
  missing_items: string[];
  warnings: string[];
}

/**
 * Generate schedule from ChatGPT-enriched line items
 * Claude focuses on sequencing and dependencies, trusting ChatGPT's phase breakdowns
 */
export async function generateScheduleFromEnriched(
  enrichment: EnrichmentResult
): Promise<{
  tasks: Array<{
    name: string;
    trade: string;
    duration_days: number;
    depends_on_indices: number[];
    reasoning?: string;
  }>;
}> {
  const systemPrompt = `You are a construction scheduling expert. You will receive PRE-ENRICHED line items with phase breakdowns and duration estimates from a construction domain expert (ChatGPT).

YOUR FOCUS: Sequencing and dependencies. The phase breakdowns and durations are already provided - your job is to:
1. Use the provided phases and durations as your starting point
2. Sequence all phases logically across ALL trades (not just within each trade)
3. Set accurate dependencies - which phases must complete before others can start
4. Adjust durations ONLY if the enrichment data seems clearly wrong

SEQUENCING RULES:
1. Demo and protection always first
2. Rough-ins (plumbing, electrical, HVAC) after framing, can often run in parallel
3. Inspections after rough-ins before drywall
4. Drywall after ALL rough-ins and insulation
5. Paint after drywall
6. Cabinets after paint
7. Countertops after cabinets
8. Tile can happen alongside drywall/paint depending on location
9. Flooring near end, after paint
10. Final connections and testing last

DEPENDENCY LOGIC:
- If a phase from Trade A must wait for Trade B to complete something, set that dependency
- Multiple phases can depend on the same predecessor
- Don't create circular dependencies
- Phases within the same trade usually depend on each other sequentially

EXCLUDE administrative/overhead items - ONLY physical construction work.

If the enrichment includes warnings about missing items, consider adding them if critical to the schedule.`;

  // Format enriched items for Claude
  const enrichedDescription = enrichment.enriched_items.map((item, idx) => {
    const phases = item.phases
      .map((p) => `  - ${p.name}: ${p.typical_duration_days} days`)
      .join('\n');
    const deps = item.common_dependencies.length > 0
      ? `  Dependencies: ${item.common_dependencies.join(', ')}`
      : '';
    const notes = item.notes ? `  Notes: ${item.notes}` : '';
    return `${idx + 1}. [${item.trade}] ${item.original}\n${phases}${deps ? '\n' + deps : ''}${notes ? '\n' + notes : ''}`;
  }).join('\n\n');

  const missingWarning = enrichment.missing_items.length > 0
    ? `\n\nMISSING ITEMS IDENTIFIED:\n${enrichment.missing_items.map((m) => `- ${m}`).join('\n')}`
    : '';

  const warnings = enrichment.warnings.length > 0
    ? `\n\nWARNINGS:\n${enrichment.warnings.map((w) => `- ${w}`).join('\n')}`
    : '';

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    temperature: 0,
    system: systemPrompt,
    tools: [GENERATE_SCHEDULE_TOOL],
    tool_choice: { type: 'tool', name: 'generate_schedule' },
    messages: [
      {
        role: 'user',
        content: `Generate a construction schedule from these PRE-ENRICHED scope items. Use the provided phase breakdowns and durations. Your job is to SEQUENCE all phases across all trades and SET DEPENDENCIES accurately.\n\nENRICHED SCOPE ITEMS:\n${enrichedDescription}${missingWarning}${warnings}`,
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
