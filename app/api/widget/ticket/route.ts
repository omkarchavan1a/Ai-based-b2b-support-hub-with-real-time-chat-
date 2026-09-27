import { json, err } from '@/lib/api';
import { getConversationById } from '@/lib/db';
import { signCustomerTicket } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { customerId, conversationId } = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!customerId || !conversationId) {
    return err('customerId and conversationId are required.', 400);
  }
  const conv = await getConversationById(conversationId);
  if (!conv || conv.customerId !== customerId) {
    return err('Conversation mismatch.', 403);
  }
  return json({ ticket: signCustomerTicket(customerId, conversationId) });
}
