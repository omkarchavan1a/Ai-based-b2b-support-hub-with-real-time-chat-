import { json, err, authorizeConversation, isAuthError, rateLimit } from '@/lib/api';
import { getMessages, saveMessage, nid, heartbeat } from '@/lib/db';
import type { Message } from '@/src/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await authorizeConversation(req, id);
  if (isAuthError(access)) return access;
  return json(await getMessages(id));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rl = rateLimit(req, 'msg', 120, 60000);
  if (rl) return rl;
  const { id } = await params;
  const access = await authorizeConversation(req, id);
  if (isAuthError(access)) return access;

  const msg = ((await req.json().catch(() => ({}))) as Record<string, any>) || {};
  if (typeof msg.content !== 'string' || msg.content.trim().length === 0) {
    return err('Message content is required.', 400);
  }
  if (msg.content.length > 10000) {
    return err('Message content is too long (max 10000 chars).', 400);
  }
  if (!['customer', 'agent', 'system', 'ai'].includes(msg.senderType)) {
    return err('Invalid senderType.', 400);
  }
  const newMsg: Message = {
    id: typeof msg.id === 'string' && msg.id.length <= 128 ? msg.id : nid('msg'),
    conversationId: id,
    senderType: msg.senderType,
    senderId: typeof msg.senderId === 'string' ? msg.senderId.slice(0, 128) : access.customerId,
    senderName: typeof msg.senderName === 'string' ? msg.senderName.slice(0, 128).replace(/[<>]/g, '') : 'Visitor',
    content: msg.content.slice(0, 10000),
    readAt: msg.readAt || null,
    createdAt: msg.createdAt || new Date().toISOString(),
    senderAvatarUrl: typeof msg.senderAvatarUrl === 'string' ? msg.senderAvatarUrl.slice(0, 2048) : undefined,
  };
  const saved = await saveMessage(newMsg);
  // NOTE (polling architecture): no WebSocket broadcast. The agent dashboard
  // and widget pick up new messages on their next poll cycle. AI copilot
  // drafts are generated lazily by GET /api/copilot/latest.
  if (saved.senderType === 'customer') {
    await heartbeat(saved.senderId, access.orgId).catch(() => {});
  }
  return json(saved);
}
