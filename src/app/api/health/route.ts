import { NextRequest, NextResponse } from 'next/server';

// Health check endpoint for diagnosing issues
export const maxDuration = 60; // Request this limit to test Fluid Compute

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    vercel: !!process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV,
  };

  // Check environment variables (without exposing values)
  const envVars = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    ANONYMOUS_ID_SECRET: !!process.env.ANONYMOUS_ID_SECRET,
    BLOB_READ_WRITE_TOKEN: !!process.env.BLOB_READ_WRITE_TOKEN,
  };

  checks.envVars = envVars;
  checks.allEnvVarsSet = Object.values(envVars).every(Boolean);

  // Test Supabase connection
  try {
    const { createServerClient } = await import('@/lib/supabase/client');
    const supabase = createServerClient();
    const { error } = await supabase.from('projects').select('count').limit(1);
    checks.supabase = error ? { error: error.message } : { connected: true };
  } catch (err) {
    checks.supabase = { error: (err as Error).message };
  }

  // Test Anthropic API key format (don't make actual request to save credits)
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    checks.anthropic = {
      keyFormat: anthropicKey.startsWith('sk-ant-') ? 'valid' : 'invalid',
      keyLength: anthropicKey.length,
    };
  } else {
    checks.anthropic = { error: 'API key not set' };
  }

  // Calculate response time
  checks.responseTimeMs = Date.now() - startTime;
  checks.maxDurationRequested = 60;

  // Test if function can run for extended time (optional delay test)
  const delayParam = request.nextUrl.searchParams.get('delay');
  if (delayParam) {
    const delay = Math.min(parseInt(delayParam, 10) || 0, 55); // Max 55 seconds
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay * 1000));
      checks.delayTest = {
        requested: delay,
        actual: Math.round((Date.now() - startTime) / 1000),
        completed: true,
      };
    }
  }

  checks.totalTimeMs = Date.now() - startTime;

  // Add CORS headers explicitly
  const response = NextResponse.json(checks, { status: 200 });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, x-anonymous-id');

  return response;
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-anonymous-id',
      'Access-Control-Max-Age': '86400',
    },
  });
}
