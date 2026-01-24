import { NextRequest, NextResponse } from 'next/server';
import { askConstructionExpert } from '@/lib/ai/openai';

// POST /api/schedule/ask-general - Ask general construction questions (stateless, no auth required)
export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json();

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    // Rate limit could be added here in the future
    // For now, rely on OpenAI's built-in rate limiting

    const answer = await askConstructionExpert(question.trim());

    return NextResponse.json({
      answer,
      source: 'chatgpt',
    });
  } catch (error) {
    console.error('[Ask General] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get answer. Please try again.' },
      { status: 500 }
    );
  }
}
