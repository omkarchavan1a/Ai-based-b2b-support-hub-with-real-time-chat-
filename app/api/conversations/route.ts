import { json, err, requireAuth, isAuthError, rateLimit } from '@/lib/api';
import { getConversations, getCustomerById, upsertCustomer, createConversation, getOrgById, nid, isCustomerOnline } from '@/lib/db';
import { signCustomerTicket } from '@/lib/auth';
import type { Conversation } from '@/src/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = requireAuth(req);
  if (isAuthError(auth)) return auth;
  const list = await getConversations(auth.orgId);
  const mapped = await Promise.all(
    list.map(async (c) => ({ ...c, isCustomerOnline: await isCustomerOnline(c.customerId) })),
  );
  return json(mapped);
}

export async function POST(req: Request) {
  const rl = rateLimit(req, 'conv', 30, 60000);
  if (rl) return rl;
  const body = (await req.json().catch(() => ({}))) as Record<string, any>;
  const { orgId, customerId, channel, priority, tags, problemDescription } = body;
  if (!customerId || typeof customerId !== 'string' || customerId.length > 128) {
    return err('customerId is required.', 400);
  }
  const allowedPriorities = ['low', 'medium', 'high', 'urgent'];
  const safePriority = allowedPriorities.includes(priority) ? priority : 'medium';
  const safeTags = Array.isArray(tags) ? tags.filter((t) => typeof t === 'string').slice(0, 10) : [];
  const safeProblem = typeof problemDescription === 'string' ? problemDescription.slice(0, 5000) : '';

  const finalOrgId = (await getOrgById(orgId)) ? orgId : 'org_stellar';

  let customer = await getCustomerById(customerId);
  if (!customer) {
    customer = {
      id: customerId,
      orgId: finalOrgId,
      name: body.customerName || 'Anonymous Visitor',
      email: body.customerEmail || 'anonymous@visitor.com',
      companyName: body.companyName || 'Web Widget',
      avatarUrl: body.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=faces',
      createdAt: new Date().toISOString(),
      phone: body.customerPhone || '+1 (555) 010-0000',
      location: body.customerLocation || 'San Jose, CA (IP: 64.233.160.1)',
      browserInfo: body.customerBrowser || 'Chrome 126.0 on Windows',
      notes: body.customerNotes || 'This user initiated chat via the simulated web widget.',
    };
    await upsertCustomer(customer);
  } else {
    const patch: any = {};
    if (body.customerName) patch.name = body.customerName;
    if (body.customerEmail) patch.email = body.customerEmail;
    if (body.companyName) patch.companyName = body.companyName;
    if (body.avatarUrl) patch.avatarUrl = body.avatarUrl;
    if (Object.keys(patch).length > 0) {
      customer = { ...customer, ...patch };
      await upsertCustomer(customer);
    }
  }

  const newConv: Conversation = {
    id: nid('conv'),
    orgId: finalOrgId,
    customerId,
    assignedAgentId: null,
    status: 'open',
    channel: channel || 'widget',
    priority: safePriority,
    tags: safeTags,
    createdAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
    slaBreachTime: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
    problemDescription: safeProblem || '',
    resolutionNotes: '',
  };
  await createConversation(newConv);
  const ticket = signCustomerTicket(customer.id, newConv.id);
  return json({ ...newConv, ticket });
}
