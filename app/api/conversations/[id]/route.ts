import { json, err, requireAuth, isAuthError, bearerToken, authorizeConversation, isAuthError as isErr } from '@/lib/api';
import { getConversationById, updateConversation, deleteConversation } from '@/lib/db';
import { verifyToken, verifyCustomerTicket } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = bearerToken(req);
  const conv = await getConversationById(id);
  if (!conv) return err('Conversation not found', 404);
  if (token) {
    const payload = verifyToken(token);
    if (!payload) return err('Unauthorized: Invalid or expired token.', 401);
    if (conv.orgId !== payload.orgId) return err('Forbidden: You do not have access to this conversation.', 403);
    return json(conv);
  }
  const url = new URL(req.url);
  const ticket = url.searchParams.get('ticket');
  if (ticket) {
    const verified = verifyCustomerTicket(ticket);
    if (!verified || verified.conversationId !== conv.id || verified.customerId !== conv.customerId) {
      return err('Forbidden: Invalid widget ticket.', 403);
    }
    return json(conv);
  }
  const customerId = url.searchParams.get('customerId');
  if (!customerId || conv.customerId !== customerId) {
    return err('Forbidden: You do not have access to this conversation.', 403);
  }
  return json(conv);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if (isAuthError(auth)) return auth;
  const { id } = await params;
  const conv = await getConversationById(id);
  if (!conv) return err('Conversation not found', 404);
  if (conv.orgId !== auth.orgId) return err('Forbidden: You do not have access to this conversation.', 403);
  const { status, priority, assignedAgentId, tags, rating, problemDescription, resolutionNotes } =
    (await req.json().catch(() => ({}))) as Record<string, any>;
  const updates: any = {};
  if (status !== undefined) {
    updates.status = status;
    if (rating !== undefined) updates.csatScore = rating;
  }
  if (priority !== undefined) updates.priority = priority;
  if (assignedAgentId !== undefined) updates.assignedAgentId = assignedAgentId;
  if (tags !== undefined) updates.tags = tags;
  if (problemDescription !== undefined) updates.problemDescription = problemDescription;
  if (resolutionNotes !== undefined) updates.resolutionNotes = resolutionNotes;
  const updated = await updateConversation(id, updates);
  return json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if (isAuthError(auth)) return auth;
  const { id } = await params;
  // Route guard: /clear-offline and /simulate are static segments handled by
  // their own route files; this is a safety net.
  if (id === 'clear-offline' || id === 'simulate') return err('API route not found', 404);
  const conv = await getConversationById(id);
  if (!conv) return err('Conversation not found', 404);
  if (conv.orgId !== auth.orgId) return err('Forbidden: You do not have access to this conversation.', 403);
  await deleteConversation(id);
  const access = await authorizeConversation(req, id).catch(() => null);
  void access;
  return json({ success: true, message: 'Conversation deleted successfully.' });
}
