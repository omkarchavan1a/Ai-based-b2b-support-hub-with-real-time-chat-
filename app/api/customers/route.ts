import { json, requireAuth, isAuthError } from '@/lib/api';
import { getOrgCustomers, isCustomerOnline } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = requireAuth(req);
  if (isAuthError(auth)) return auth;
  const customers = await getOrgCustomers(auth.orgId);
  const mapped = await Promise.all(
    customers.map(async (c) => ({ ...c, isOnline: await isCustomerOnline(c.id) })),
  );
  return json(mapped);
}
