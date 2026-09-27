/** Shared helpers for Next.js route handlers. */
import { NextResponse } from 'next/server';
import { verifyToken, verifyCustomerTicket, getClientIp, checkPublicRateLimit } from '@/lib/auth';
import { getConversationById } from '@/lib/db';

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function bearerToken(req: Request): string | null {
  const h = req.headers.get('authorization');
  if (!h || !h.startsWith('Bearer ')) return null;
  return h.split(' ')[1] || null;
}

/** Agent auth: returns { userId, orgId } or an error Response. */
export function requireAuth(req: Request): { userId: string; orgId: string } | NextResponse {
  const token = bearerToken(req);
  if (!token) return err('Unauthorized: Authentication token is required', 401);
  const payload = verifyToken(token);
  if (!payload) return err('Unauthorized: Invalid or expired token', 401);
  return payload;
}

export function isAuthError(v: unknown): v is NextResponse {
  return v instanceof NextResponse;
}

/**
 * Conversation access for agent (Bearer, org match) or widget
 * (signed ticket, or customerId fallback). Returns the conversation's
 * orgId + customerId, or an error Response.
 */
export async function authorizeConversation(
  req: Request,
  conversationId: string,
): Promise<{ orgId: string; customerId: string } | NextResponse> {
  const conv = await getConversationById(conversationId);
  if (!conv) return err('Conversation not found.', 404);
  const token = bearerToken(req);
  if (token) {
    const payload = verifyToken(token);
    if (!payload) return err('Unauthorized: Invalid or expired token.', 401);
    if (conv.orgId !== payload.orgId) return err('Forbidden: You do not have access to this conversation.', 403);
    return { orgId: conv.orgId, customerId: conv.customerId };
  }
  const url = new URL(req.url);
  const ticket = url.searchParams.get('ticket');
  if (ticket) {
    const verified = verifyCustomerTicket(ticket);
    if (!verified || verified.conversationId !== conv.id || verified.customerId !== conv.customerId) {
      return err('Forbidden: Invalid widget ticket.', 403);
    }
    return { orgId: conv.orgId, customerId: conv.customerId };
  }
  const customerId = url.searchParams.get('customerId');
  if (!customerId) return err('Unauthorized: Authentication token or customerId is required.', 401);
  if (conv.customerId !== customerId) return err('Forbidden: You do not have access to this conversation.', 403);
  return { orgId: conv.orgId, customerId: conv.customerId };
}

export function rateLimit(req: Request, key: string, max: number, windowMs: number): NextResponse | null {
  const ip = getClientIp(req.headers);
  const rl = checkPublicRateLimit(`${key}:${ip}`, max, windowMs);
  if (!rl.allowed) return err('Too many requests. Please try again shortly.', 429);
  return null;
}
