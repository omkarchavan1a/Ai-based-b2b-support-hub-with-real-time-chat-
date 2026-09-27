import { json, requireAuth, isAuthError } from '@/lib/api';
import { clearOfflineConversations } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(req: Request) {
  const auth = requireAuth(req);
  if (isAuthError(auth)) return auth;
  const { ids, deletedCustomerIds } = await clearOfflineConversations(auth.orgId);
  return json({ success: true, count: ids.length, ids, deletedCustomerIds });
}
