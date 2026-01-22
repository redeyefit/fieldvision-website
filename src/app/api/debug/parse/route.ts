import { NextRequest, NextResponse } from 'next/server';
import { extractText } from 'unpdf';
import { parseContractPDF } from '@/lib/ai/anthropic';

// Debug endpoint to test PDF parsing flow
// POST /api/debug/parse with PDF file
export const maxDuration = 60;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-anonymous-id, x-debug-key',
    'Access-Control-Max-Age': '86400',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const debugKey = request.headers.get('x-debug-key');

  // Simple protection for debug endpoint
  if (debugKey !== 'fv-debug-2026') {
    const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    Object.entries(corsHeaders()).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  }

  const debug: Record<string, unknown> = {
    startTime: new Date().toISOString(),
    steps: [],
  };

  try {
    // Step 1: Get form data
    const formData = await request.formData();
    const file = formData.get('pdf') as File | null;
    const clientText = formData.get('text') as string || '';

    (debug.steps as unknown[]).push({
      step: 'formData',
      fileName: file?.name,
      fileSize: file?.size,
      clientTextLength: clientText.length,
    });

    if (!file) {
      const response = NextResponse.json({ error: 'No PDF file provided', debug }, { status: 400 });
      Object.entries(corsHeaders()).forEach(([key, value]) => response.headers.set(key, value));
      return response;
    }

    // Step 2: Extract text with unpdf
    let serverText = '';
    let unpdfError = null;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const { text, totalPages } = await extractText(arrayBuffer);
      serverText = Array.isArray(text) ? text.join('\n') : (text || '');
      (debug.steps as unknown[]).push({
        step: 'unpdf',
        totalPages,
        extractedLength: serverText.length,
        preview: serverText.substring(0, 1000),
      });
    } catch (err) {
      unpdfError = (err as Error).message;
      (debug.steps as unknown[]).push({
        step: 'unpdf',
        error: unpdfError,
      });
    }

    // Step 3: Choose best text
    const finalText = serverText.length >= clientText.length ? serverText : clientText;
    (debug.steps as unknown[]).push({
      step: 'textSelection',
      serverTextLength: serverText.length,
      clientTextLength: clientText.length,
      selectedSource: serverText.length >= clientText.length ? 'server' : 'client',
      finalTextLength: finalText.length,
    });

    if (finalText.length < 50) {
      const response = NextResponse.json({
        error: 'Insufficient text extracted',
        debug,
      }, { status: 400 });
      Object.entries(corsHeaders()).forEach(([key, value]) => response.headers.set(key, value));
      return response;
    }

    // Step 4: Call Claude directly to get full response
    let claudeResult = null;
    let claudeError = null;
    let rawClaudeResponse = null;
    try {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      const TRADE_CATEGORIES = [
        'Demo', 'Framing', 'Plumbing', 'Electrical', 'HVAC', 'Insulation',
        'Drywall', 'Paint', 'Flooring', 'Tile', 'Cabinets', 'Countertops',
        'Appliances', 'Fixtures', 'Doors', 'Windows', 'Roofing', 'Siding',
        'Concrete', 'Landscaping', 'Permits', 'Cleanup', 'Other'
      ];

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192, // Increased - complex PDFs need more tokens
        temperature: 0,
        system: 'You are a construction contract analyst. Extract all scope items, work items, and deliverables from the contract text. Categorize each by trade. Be thorough - include all work mentioned. Ignore pricing, terms, and conditions - focus only on WORK to be performed.',
        tools: [{
          name: 'extract_line_items',
          description: 'Extract construction line items from contract text',
          input_schema: {
            type: 'object',
            properties: {
              line_items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    text: { type: 'string', description: 'The line item description from the contract' },
                    trade: { type: 'string', enum: TRADE_CATEGORIES, description: 'The trade category this item belongs to' },
                  },
                  required: ['text', 'trade']
                }
              }
            },
            required: ['line_items']
          }
        }],
        tool_choice: { type: 'tool', name: 'extract_line_items' },
        messages: [{
          role: 'user',
          content: `Extract all construction line items from this contract:\n\n${finalText}`,
        }],
      });

      rawClaudeResponse = {
        stop_reason: response.stop_reason,
        usage: response.usage,
        content_types: response.content.map(b => b.type),
      };

      const toolUse = response.content.find(b => b.type === 'tool_use');
      if (toolUse && toolUse.type === 'tool_use') {
        claudeResult = toolUse.input as { line_items: Array<{text: string; trade: string}> };
        (debug.steps as unknown[]).push({
          step: 'claude',
          rawResponse: rawClaudeResponse,
          toolName: toolUse.name,
          lineItemsCount: claudeResult.line_items?.length || 0,
          firstItems: claudeResult.line_items?.slice(0, 3),
        });
      } else {
        (debug.steps as unknown[]).push({
          step: 'claude',
          rawResponse: rawClaudeResponse,
          error: 'No tool_use block found',
          fullContent: JSON.stringify(response.content).substring(0, 2000),
        });
      }
    } catch (err) {
      claudeError = (err as Error).message;
      (debug.steps as unknown[]).push({
        step: 'claude',
        error: claudeError,
        errorStack: (err as Error).stack?.substring(0, 500),
      });
    }

    debug.totalTimeMs = Date.now() - startTime;
    debug.success = !claudeError && (claudeResult?.line_items?.length || 0) > 0;

    const response = NextResponse.json({
      debug,
      line_items: claudeResult?.line_items || [],
      extractedText: {
        length: finalText.length,
        preview: finalText.substring(0, 2000),
      },
    });
    Object.entries(corsHeaders()).forEach(([key, value]) => response.headers.set(key, value));
    return response;

  } catch (err) {
    debug.totalTimeMs = Date.now() - startTime;
    debug.error = (err as Error).message;
    const response = NextResponse.json({ error: (err as Error).message, debug }, { status: 500 });
    Object.entries(corsHeaders()).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  }
}
