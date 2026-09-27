import { json, err, requireAuth, isAuthError } from '@/lib/api';
import { getCustomerById, patchCustomer } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if (isAuthError(auth)) return auth;
  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) return err('Customer not found', 404);
  if (customer.orgId !== auth.orgId) return err('Forbidden: You do not have access to this customer.', 403);
  const { name, email, companyName, avatarUrl, phone, notes, location, browserInfo } =
    (await req.json().catch(() => ({}))) as Record<string, any>;
  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (companyName !== undefined) updates.companyName = companyName;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
  if (phone !== undefined) updates.phone = phone;
  if (notes !== undefined) updates.notes = notes;
  if (location !== undefined) updates.location = location;
  if (browserInfo !== undefined) updates.browserInfo = browserInfo;
  return json(await patchCustomer(id, updates));
}
