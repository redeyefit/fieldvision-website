import { GoogleGenerativeAI } from '@google/generative-ai';
import { TRADE_CATEGORIES } from '@/lib/schedule/trades';

// Initialize Gemini client
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('[Gemini] WARNING: GEMINI_API_KEY is not set!');
}

const genAI = new GoogleGenerativeAI(apiKey || '');

/**
 * Parse contract PDF text and extract line items using Gemini Flash
 * Much faster than Claude (~5-10s vs 60s+)
 */
export async function parseContractPDFWithGemini(
  pdfText: string
): Promise<{
  line_items: Array<{
    text: string;
    trade: string;
    quantity?: number;
    unit?: string;
  }>;
}> {
  console.log('[Gemini] parseContractPDF called, text length:', pdfText.length);
  console.log('[Gemini] Text preview:', pdfText.substring(0, 300));

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0,
    },
  });

  const tradeList = TRADE_CATEGORIES.join(', ');

  const prompt = `You are a construction contract analyst. Extract ALL scope items, work items, and deliverables from this contract text.

IMPORTANT RULES:
1. Extract EVERY physical work item mentioned - be thorough
2. Categorize each by trade from this list: ${tradeList}
3. Include quantity and unit if specified
4. Ignore pricing, terms, conditions - focus only on WORK to be performed
5. Be exhaustive - include all physical construction items
6. EXCLUDE General Conditions and administrative overhead:
   - Project management, supervision, job site management
   - Daily logs, photo documentation, schedule updates
   - Owner communication, meetings, RFIs, submittals
   - Permits, inspections, insurance, bonds, warranties
   - Safety meetings, cleanup schedules, temporary facilities
   ONLY extract actual PHYSICAL CONSTRUCTION WORK (demo, framing, plumbing, electrical, etc.)

Return a JSON object with this exact structure:
{
  "line_items": [
    {
      "text": "description of the work item",
      "trade": "one of the trade categories",
      "quantity": 10,
      "unit": "SF"
    }
  ]
}

CONTRACT TEXT:
${pdfText}`;

  try {
    console.log('[Gemini] Calling Gemini API...');
    const startTime = Date.now();

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    const elapsed = Date.now() - startTime;
    console.log('[Gemini] Response received in', elapsed, 'ms');
    console.log('[Gemini] Raw response:', text.substring(0, 500));

    // Parse the JSON response
    const parsed = JSON.parse(text);

    console.log('[Gemini] Extracted', parsed.line_items?.length || 0, 'line items');
    if (parsed.line_items?.length > 0) {
      console.log('[Gemini] First item:', JSON.stringify(parsed.line_items[0]));
    }

    return parsed;
  } catch (error) {
    console.error('[Gemini] API error:', error);
    throw error;
  }
}

/**
 * Generate schedule from line items using Gemini Flash
 * Compare against Claude Sonnet for quality
 */
export async function generateScheduleWithGemini(
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
  console.log('[Gemini] generateSchedule called with', lineItems.length, 'items');

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0,
      maxOutputTokens: 8192, // Increased for large schedules
    },
  });

  const itemsList = lineItems
    .map((item, i) => `${i + 1}. [${item.trade}] ${item.text}`)
    .join('\n');

  const prompt = `You are a construction scheduling expert. Generate a DETAILED construction schedule by breaking down each line item into realistic construction phases.

CRITICAL: Break down each scope item into multiple sub-tasks representing real construction phases. For example:
- "Stone countertops" becomes: Stone - Templates (1 day), Stone - Fabrication (5 days), Stone - Install (2 days), Stone - Seal (1 day)
- "Electrical" becomes: Electrical - Rough-in (5 days), Electrical - Trim (3 days), Electrical - Finals/Testing (1 day)
- "Tile work" becomes: Tile - Layout/Prep (1 day), Tile - Waterproofing (1 day), Tile - Install (5 days), Tile - Grout (2 days), Tile - Seal (1 day)
- "Cabinets" becomes: Cabinets - Delivery/Stage (1 day), Cabinets - Install Base (2 days), Cabinets - Install Upper (2 days), Cabinets - Hardware/Adjust (1 day)

NAMING FORMAT: "[Material/Trade] - [Phase]" (e.g., "Plumbing - Rough-in", "Paint - Prime", "Paint - Finish Coat")

RULES:
1. ALWAYS break down items into multiple realistic phases - never leave a single generic task
2. Order tasks logically (demo → rough-in → finishes → punch)
3. Set dependencies accurately using 0-based indices - a task depends on what must complete first
4. Duration estimates in WORKDAYS (not calendar days)
5. Be conservative - slightly over-estimate rather than under-estimate
6. EXCLUDE administrative/overhead items - these are NOT schedulable construction tasks:
   - General Conditions (job site management, supervision, safety meetings)
   - Documentation (daily logs, photo documentation, schedule updates)
   - Communication (owner meetings, RFIs, submittals tracking)
   - Permits/Inspections (permit applications, inspection scheduling)
   - Insurance, bonds, warranties, cleanup schedules
   - Project management overhead
   ONLY include actual PHYSICAL CONSTRUCTION WORK that crews perform on-site.

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
- Appliances: Receive, Set, Connect, Test

Return a JSON object with this exact structure:
{
  "tasks": [
    {
      "name": "Task name in format Trade - Phase",
      "trade": "Trade category",
      "duration_days": 2,
      "depends_on_indices": [0, 1]
    }
  ]
}

SCOPE ITEMS:
${itemsList}

Generate a DETAILED construction schedule. Break down EVERY item into multiple sub-tasks with realistic phases.`;

  try {
    console.log('[Gemini] Calling Gemini API for schedule...');
    const startTime = Date.now();

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    const elapsed = Date.now() - startTime;
    console.log('[Gemini] Schedule response received in', elapsed, 'ms');
    console.log('[Gemini] Raw response:', text.substring(0, 500));

    const parsed = JSON.parse(text);

    console.log('[Gemini] Generated', parsed.tasks?.length || 0, 'tasks');
    if (parsed.tasks?.length > 0) {
      console.log('[Gemini] First task:', JSON.stringify(parsed.tasks[0]));
    }

    return parsed;
  } catch (error) {
    console.error('[Gemini] Schedule generation error:', error);
    throw error;
  }
}
