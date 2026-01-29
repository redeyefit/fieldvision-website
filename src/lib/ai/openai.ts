import OpenAI from 'openai';

// Lazy-initialized OpenAI client (prevents build-time errors)
let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

// Types for enriched line items
export interface EnrichedPhase {
  name: string;
  typical_duration_days: number;
}

export interface EnrichedLineItem {
  original: string;
  trade: string;
  phases: EnrichedPhase[];
  common_dependencies: string[];
  notes: string;
}

export interface EnrichmentResult {
  enriched_items: EnrichedLineItem[];
  missing_items: string[];
  warnings: string[];
}

// Enrichment prompt for construction domain expertise
const ENRICHMENT_PROMPT = `You are a construction scheduling expert with deep knowledge of residential and commercial construction phases, trade sequencing, and realistic durations.

Your task is to analyze line items extracted from a construction contract and enrich them with:
1. **Phase breakdowns** - Break each item into realistic construction phases
2. **Typical durations** - Provide workday estimates for each phase
3. **Common dependencies** - What must typically complete before this work
4. **Notes** - Coordination requirements, code considerations, or warnings

PHASE BREAKDOWN GUIDELINES:
- "Electrical" → Rough-in (5 days), Trim (3 days), Finals/Testing (1 day)
- "Plumbing" → Rough-in (5 days), Top-out (2 days), Trim (3 days), Finals (1 day)
- "HVAC" → Rough-in (5 days), Equipment Set (2 days), Trim (2 days), Start-up/Balance (1 day)
- "Drywall" → Hang (3 days), Tape/Mud (4 days), Texture (2 days), Touch-up (1 day)
- "Paint" → Prep/Prime (2 days), Paint Walls (3 days), Paint Trim (2 days), Touch-up (1 day)
- "Tile" → Waterproofing (1 day), Layout (1 day), Install (5 days), Grout (2 days), Seal (1 day)
- "Cabinets" → Receive/Stage (1 day), Install Base (2 days), Install Upper (2 days), Hardware (1 day)
- "Countertops" → Template (1 day), Fabricate (5 days), Install (2 days), Seal (1 day)
- "Flooring" → Prep/Level (2 days), Install (4 days), Transitions/Trim (1 day)
- "Framing" → Layout (1 day), Walls (3 days), Headers/Beams (1 day), Blocking (1 day), Sheathing (2 days)
- "Demo" → Protection/Prep (1 day), Demo (3 days), Haul-off (1 day)

DEPENDENCY GUIDELINES:
- Rough-ins (plumbing, electrical, HVAC) need framing complete
- Drywall needs all rough-ins complete and inspected
- Paint needs drywall complete
- Tile needs waterproofing complete
- Cabinets need drywall and paint complete
- Countertops need cabinets installed
- Flooring typically near end, after paint, before final trim

ALSO IDENTIFY:
- **Missing items** - Common construction items that should be present but aren't listed
- **Warnings** - Potential scheduling issues (e.g., "No insulation listed - required before drywall")

Return ONLY valid JSON matching this schema:
{
  "enriched_items": [
    {
      "original": "original line item text",
      "trade": "Trade Category",
      "phases": [
        { "name": "Trade - Phase Name", "typical_duration_days": 5 }
      ],
      "common_dependencies": ["What must complete first"],
      "notes": "Coordination notes or code considerations"
    }
  ],
  "missing_items": ["Items that should be present but aren't listed"],
  "warnings": ["Potential scheduling issues or concerns"]
}`;

// Construction expert prompt for Q&A
const CONSTRUCTION_EXPERT_PROMPT = `You are a seasoned construction superintendent with 25+ years of experience in residential and commercial construction. You have deep knowledge of:

- Building codes (IBC, IRC, local amendments)
- Trade sequencing and dependencies
- Material specifications and lead times
- Labor productivity rates
- Safety requirements (OSHA)
- Inspection requirements and timing
- Common construction problems and solutions
- Cost estimation principles
- Subcontractor coordination
- Weather impacts on scheduling

Speak like an experienced field professional - direct, practical, and helpful. Avoid jargon unless necessary. Give concrete, actionable advice.

When answering questions:
1. Be specific with numbers when possible (e.g., "typically 3-5 days" not "a few days")
2. Mention relevant code requirements if applicable
3. Flag common mistakes or gotchas
4. Suggest best practices from the field
5. Keep responses concise but thorough`;

/**
 * Enrich line items with construction phases, durations, and dependencies
 * Uses GPT-4o for deep construction domain expertise
 */
export async function enrichLineItems(
  lineItems: Array<{ text: string; trade: string }>
): Promise<EnrichmentResult> {
  console.log('[OpenAI] enrichLineItems called with', lineItems.length, 'items');

  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      max_tokens: 16384, // Large contracts (132+ items) need more tokens to avoid truncation
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: ENRICHMENT_PROMPT },
        { role: 'user', content: JSON.stringify(lineItems) },
      ],
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('GPT-4o returned empty response');
    }

    console.log('[OpenAI] Enrichment response received');
    const result = JSON.parse(content) as EnrichmentResult;
    console.log('[OpenAI] Enriched', result.enriched_items?.length || 0, 'items');
    console.log('[OpenAI] Missing items:', result.missing_items?.length || 0);
    console.log('[OpenAI] Warnings:', result.warnings?.length || 0);

    return result;
  } catch (error) {
    console.error('[OpenAI] enrichLineItems error:', error);
    throw error;
  }
}

/**
 * Answer general construction questions (stateless, no project context)
 * Uses GPT-4o for construction domain expertise
 */
export async function askConstructionExpert(question: string): Promise<string> {
  console.log('[OpenAI] askConstructionExpert called:', question.substring(0, 100));

  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.3,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: CONSTRUCTION_EXPERT_PROMPT },
        { role: 'user', content: question },
      ],
    });

    const answer = response.choices[0].message.content;
    if (!answer) {
      throw new Error('GPT-4o returned empty response');
    }

    console.log('[OpenAI] Expert answer received, length:', answer.length);
    return answer;
  } catch (error) {
    console.error('[OpenAI] askConstructionExpert error:', error);
    throw error;
  }
}
