import { json, requireAuth, isAuthError } from '@/lib/api';
import { getAnalytics } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = requireAuth(req);
  if (isAuthError(auth)) return auth;
  return json(await getAnalytics(auth.orgId));
}
