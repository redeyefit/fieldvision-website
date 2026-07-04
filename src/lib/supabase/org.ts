import 'server-only';

import { createServerClient, verifyAnonymousId } from '@/lib/supabase/client';

// ============================================================================
// Org access layer (server-only)
// ----------------------------------------------------------------------------
// The app talks to projects via the SERVICE ROLE client (bypasses RLS), so
// org-scoping must be enforced in the QUERIES here — not by RLS alone. These
// helpers mirror the SQL helpers is_org_member/is_org_admin from migration
// 20260701_team_platform_org_projects.sql, including the organizations.owner_id
// fallback (an owner without an org_members row still counts) and the
// joined_at guard (pending invitees don't count as members).
// ============================================================================

export type OrgRole = 'owner' | 'admin' | 'member';

export interface OrgMembership {
  orgId: string;
  orgName: string;
  role: OrgRole;
  plan: string;
  status: string;
}

/**
 * Every org the user belongs to (accepted member rows) OR owns.
 * Dedupes owned orgs that also have a member row (owner role wins).
 */
export async function getUserOrgs(userId: string): Promise<OrgMembership[]> {
  const supabase = createServerClient();

  const [membersRes, ownedRes] = await Promise.all([
    supabase
      .from('org_members')
      .select('org_id, role, organizations(id, name, plan, status)')
      .eq('user_id', userId)
      .not('joined_at', 'is', null),
    supabase
      .from('organizations')
      .select('id, name, plan, status')
      .eq('owner_id', userId),
  ]);

  const byId = new Map<string, OrgMembership>();

  // Owner fallback first — an owner always counts, even without a member row.
  for (const row of ownedRes.data ?? []) {
    byId.set(row.id, {
      orgId: row.id,
      orgName: row.name,
      role: 'owner',
      plan: row.plan,
      status: row.status,
    });
  }

  for (const row of membersRes.data ?? []) {
    if (byId.has(row.org_id)) continue; // owner role already set
    // Supabase returns the embedded table as an object or 1-element array.
    const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
    if (!org) continue;
    byId.set(row.org_id, {
      orgId: row.org_id,
      orgName: org.name,
      role: (row.role as OrgRole) ?? 'member',
      plan: org.plan,
      status: org.status,
    });
  }

  return [...byId.values()];
}

/** The org IDs the user can see (member or owner). */
export async function getUserOrgIds(userId: string): Promise<string[]> {
  const orgs = await getUserOrgs(userId);
  return orgs.map((o) => o.orgId);
}

/** Is the user a member (or owner) of this org? */
export async function isOrgMember(userId: string, orgId: string): Promise<boolean> {
  const ids = await getUserOrgIds(userId);
  return ids.includes(orgId);
}

/** Is the user an owner/admin of this org? */
export async function isOrgAdmin(userId: string, orgId: string): Promise<boolean> {
  const orgs = await getUserOrgs(userId);
  return orgs.some((o) => o.orgId === orgId && (o.role === 'owner' || o.role === 'admin'));
}

/**
 * Can this caller access this project?
 *   - authenticated: owns it (user_id) OR is a member of its org (org_id)
 *   - anonymous: the project's anonymous_id matches
 * Mirrors the RLS SELECT policies; used by service-role routes that bypass RLS.
 * Replaces the verifyProjectOwnership() duplicated across the schedule routes.
 */
export async function canAccessProject(
  projectId: string,
  userId: string | null,
  anonymousId: string | null
): Promise<boolean> {
  const supabase = createServerClient();
  const { data: project, error } = await supabase
    .from('projects')
    .select('user_id, anonymous_id, org_id')
    .eq('id', projectId)
    .single();

  // PGRST116 = no row (genuine not-found). Anything else is a real DB fault —
  // log it so an outage isn't silently indistinguishable from "no access".
  if (error && error.code !== 'PGRST116') {
    console.error('canAccessProject lookup failed:', error);
  }
  if (!project) return false;

  if (userId) {
    if (project.user_id === userId) return true;
    if (project.org_id && (await isOrgMember(userId, project.org_id))) return true;
    return false;
  }

  if (anonymousId && project.anonymous_id === anonymousId && verifyAnonymousId(anonymousId)) {
    return true;
  }
  return false;
}
