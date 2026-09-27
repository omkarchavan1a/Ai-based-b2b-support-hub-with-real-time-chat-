import { json, err, bearerToken } from '@/lib/api';
import { getUserById, getOrgById, publicUser } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const token = bearerToken(req);
  if (!token) return err('Unauthorized: Authentication token is required', 401);
  const payload = verifyToken(token);
  if (!payload) return err('Unauthorized: Invalid or expired token', 401);
  const user = await getUserById(payload.userId);
  if (!user) return err('Unauthorized: User not found', 401);
  const org = await getOrgById(user.orgId);
  return json({ user: publicUser(user), org });
}
