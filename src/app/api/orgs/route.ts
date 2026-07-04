import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/supabase/auth';
import { getUserOrgs } from '@/lib/supabase/org';

// GET /api/orgs — the orgs the signed-in user belongs to (with role + plan).
// Powers the /projects page (which org to create in, whether to show "New Project").
export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgs = await getUserOrgs(userId);
    return NextResponse.json({ orgs });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
