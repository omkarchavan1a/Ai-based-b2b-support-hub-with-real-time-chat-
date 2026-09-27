import { json, err, requireAuth, isAuthError } from '@/lib/api';
import { getConversationById } from '@/lib/db';
import { ensureSuggestion } from '@/lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Polling-friendly copilot endpoint. Returns the latest AI draft for the
 * conversation, generating one on demand when the newest customer message
 * has no suggestion yet.
 */
export async function GET(req: Request) {
  const auth = requireAuth(req);
  if (isAuthError(auth)) return auth;
  const conversationId = new URL(req.url).searchParams.get('conversationId');
  if (!conversationId) return err('conversationId is required.', 400);
  const conv = await getConversationById(conversationId);
  if (!conv) return err('Conversation not found.', 404);
  if (conv.orgId !== auth.orgId) return err('Forbidden: You do not have access to this conversation.', 403);
  const log = await ensureSuggestion(conversationId, auth.orgId);
  if (!log) return json({ suggestion: null, logId: null, isThinking: false });
  return json({ suggestion: log.suggestedText, logId: log.id, isThinking: false, conversationId });
}
