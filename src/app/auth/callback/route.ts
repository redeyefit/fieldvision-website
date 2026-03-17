import { NextRequest, NextResponse } from 'next/server';
import { createServerAuthClient } from '@/lib/supabase/auth';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error_description') || requestUrl.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${requestUrl.origin}/auth?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${requestUrl.origin}/auth?error=Missing+auth+code`);
  }

  const supabase = createServerAuthClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(`${requestUrl.origin}/auth?error=${encodeURIComponent(exchangeError.message)}`);
  }

  return NextResponse.redirect(`${requestUrl.origin}/schedule`);
}
