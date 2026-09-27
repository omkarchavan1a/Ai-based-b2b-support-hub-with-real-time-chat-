import { json, requireAuth, isAuthError } from '@/lib/api';
import { resetWorkspaceData } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(req: Request) {
  const auth = requireAuth(req);
  if (isAuthError(auth)) return auth;
  const { conversations, customers } = await resetWorkspaceData(auth.orgId);
  return json({ success: true, conversations, customers });
}
