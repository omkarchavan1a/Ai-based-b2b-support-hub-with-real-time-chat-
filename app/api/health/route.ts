import { json } from '@/lib/api';
import { getSettings } from '@/lib/db';
import { getOrgActiveAIKey } from '@/lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const orgId = new URL(req.url).searchParams.get('orgId') as string | null;
  let hasGeminiKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY';
  let activeProvider = 'Google Gemini';
  if (orgId) {
    const activeAI = getOrgActiveAIKey(await getSettings(orgId));
    if (activeAI) {
      hasGeminiKey = true;
      activeProvider = activeAI.provider === 'gemini' ? 'Google Gemini' : activeAI.provider.charAt(0).toUpperCase() + activeAI.provider.slice(1);
    }
  }
  return json({ status: 'ok', hasGeminiKey, activeProvider });
}
