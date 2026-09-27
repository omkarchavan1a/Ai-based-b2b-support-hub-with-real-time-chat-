import { json, err, requireAuth, isAuthError } from '@/lib/api';
import { getLogWithConversation, updateSuggestionLog } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = requireAuth(req);
  if (isAuthError(auth)) return auth;
  const { logId, wasUsed, agentEdited } = (await req.json().catch(() => ({}))) as Record<string, any>;
  try {
    const { conv } = await getLogWithConversation(logId);
    if (!conv || conv.orgId !== auth.orgId) {
      return err('Forbidden: You do not have access to this log.', 403);
    }
    await updateSuggestionLog(logId, !!wasUsed, !!agentEdited);
    return json({ success: true });
  } catch {
    return err('Log not found', 404);
  }
}
