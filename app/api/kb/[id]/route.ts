import { json, err, requireAuth, isAuthError } from '@/lib/api';
import { getKbArticleById, deleteKbArticle } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if (isAuthError(auth)) return auth;
  const { id } = await params;
  const art = await getKbArticleById(id);
  if (!art) return err('Article not found', 404);
  if (art.orgId !== auth.orgId) return err('Forbidden: You do not have access to this article.', 403);
  await deleteKbArticle(id);
  return json({ success: true });
}
