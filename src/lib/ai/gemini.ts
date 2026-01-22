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
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0,
    },
  });

  const tradeList = TRADE_CATEGORIES.join(', ');

  const prompt = `You are a construction contract analyst. Extract ALL scope items, work items, and deliverables from this contract text.

IMPORTANT RULES:
1. Extract EVERY work item mentioned - be thorough
2. Categorize each by trade from this list: ${tradeList}
3. Include quantity and unit if specified
4. Ignore pricing, terms, conditions - focus only on WORK to be performed
5. Be exhaustive - include all items, even small ones

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
