import { json, err, rateLimit } from '@/lib/api';
import { getRelevantKBArticles } from '@/lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  const rl = rateLimit(req, 'kb', 60, 60000);
  if (rl) return rl;
  const { query, orgId } = (await req.json().catch(() => ({}))) as Record<string, any>;
  if (!query || typeof query !== 'string' || query.length > 1000) {
    return err('Query is required (max 1000 chars).', 400);
  }
  const articles = await getRelevantKBArticles(query.slice(0, 1000), orgId || 'org_stellar');
  return json(articles);
}
