import { json, err, requireAuth, isAuthError } from '@/lib/api';
import { getKbArticles, createKbArticle, nid } from '@/lib/db';
import type { KBArticle } from '@/src/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = requireAuth(req);
  if (isAuthError(auth)) return auth;
  return json(await getKbArticles(auth.orgId));
}

export async function POST(req: Request) {
  const auth = requireAuth(req);
  if (isAuthError(auth)) return auth;
  const { title, content, category } = (await req.json().catch(() => ({}))) as Record<string, any>;
  if (typeof title !== 'string' || title.trim().length === 0 || title.length > 200) {
    return err('Title is required (max 200 chars).', 400);
  }
  if (typeof content !== 'string' || content.trim().length === 0 || content.length > 50000) {
    return err('Content is required (max 50000 chars).', 400);
  }
  const newArticle: KBArticle = {
    id: nid('kb'),
    orgId: auth.orgId,
    title: title.trim().slice(0, 200),
    content: content.slice(0, 50000),
    category: typeof category === 'string' ? category.slice(0, 100) : 'General',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await createKbArticle(newArticle);
  return json(newArticle);
}
