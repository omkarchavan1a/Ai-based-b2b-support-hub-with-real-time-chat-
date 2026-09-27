import { json, requireAuth, isAuthError } from '@/lib/api';
import { getOrgUsers, publicUser } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = requireAuth(req);
  if (isAuthError(auth)) return auth;
  const users = await getOrgUsers(auth.orgId);
  return json(users.map(publicUser));
}
