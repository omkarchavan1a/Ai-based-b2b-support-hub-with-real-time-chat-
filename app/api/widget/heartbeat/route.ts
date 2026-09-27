import { json, err } from '@/lib/api';
import { getConversationById, heartbeat } from '@/lib/db';
import { verifyCustomerTicket } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Widget presence heartbeat (polling architecture replacement for
 * WebSocket connect/disconnect online tracking).
 * Body: { customerId, conversationId?, ticket? }
 */
export async function POST(req: Request) {
  const { customerId, conversationId, ticket } = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!customerId) return err('customerId is required.', 400);
  let orgId: string | null = null;
  if (ticket) {
    const verified = verifyCustomerTicket(ticket);
    if (!verified || verified.customerId !== customerId) return err('Invalid widget ticket.', 403);
    const conv = await getConversationById(verified.conversationId);
    if (!conv) return err('Conversation not found.', 404);
    orgId = conv.orgId;
  } else if (conversationId) {
    const conv = await getConversationById(conversationId);
    if (!conv || conv.customerId !== customerId) return err('Conversation mismatch.', 403);
    orgId = conv.orgId;
  } else {
    return err('conversationId or ticket is required.', 400);
  }
  await heartbeat(customerId, orgId);
  return json({ success: true });
}
