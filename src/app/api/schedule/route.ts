import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient, generateAnonymousId, verifyAnonymousId } from '@/lib/supabase/client';
import { Project, CreateProjectRequest } from '@/lib/supabase/types';

// GET /api/schedule - List user's projects
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    const anonymousId = request.headers.get('x-anonymous-id');

    if (!userId && !anonymousId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    let query = supabase.from('projects').select('*').order('updated_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    } else if (anonymousId && verifyAnonymousId(anonymousId)) {
      query = query.eq('anonymous_id', anonymousId);
    } else {
      return NextResponse.json({ error: 'Invalid anonymous ID' }, { status: 401 });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ projects: data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/schedule - Create new project
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    let anonymousId = request.headers.get('x-anonymous-id');

    // Generate anonymous ID if not authenticated and none provided
    if (!userId && !anonymousId) {
      anonymousId = generateAnonymousId();
    }

    // Validate anonymous ID if provided
    if (!userId && anonymousId && !verifyAnonymousId(anonymousId)) {
      anonymousId = generateAnonymousId(); // Generate new one if invalid
    }

    const body: CreateProjectRequest = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const supabase = createServerClient();

    const projectData: Partial<Project> = {
      name: body.name,
      start_date: body.start_date || null,
      work_days: body.work_days || 'mon-fri',
      user_id: userId || null,
      anonymous_id: userId ? null : anonymousId,
    };

    const { data, error } = await supabase
      .from('projects')
      .insert(projectData)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }

    // Return anonymous ID in response so client can store it
    return NextResponse.json({
      project: data,
      anonymous_id: userId ? null : anonymousId,
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
