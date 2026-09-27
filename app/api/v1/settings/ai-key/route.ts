import { json, requireAuth, isAuthError } from '@/lib/api';
import { getSettings, updateSettings } from '@/lib/db';
import { getOrgActiveAIKey } from '@/lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = requireAuth(req);
  if (isAuthError(auth)) return auth;
  const activeAI = getOrgActiveAIKey(await getSettings(auth.orgId));
  if (activeAI) {
    const masked = activeAI.key.length > 10
      ? `${activeAI.key.substring(0, 6)}••••••••${activeAI.key.substring(activeAI.key.length - 4)}`
      : '••••••••••••';
    return json({
      provider: activeAI.provider,
      status: 'connected',
      maskedPreview: masked,
      model: activeAI.model || (activeAI.provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini'),
    });
  }
  return json({ provider: null, status: 'not_set', maskedPreview: null, model: null });
}

export async function DELETE(req: Request) {
  const auth = requireAuth(req);
  if (isAuthError(auth)) return auth;
  const settings = await getSettings(auth.orgId);
  if (settings.apiKeys) {
    const updatedKeys = settings.apiKeys.map((k) => {
      const nameLower = (k.providerName || '').toLowerCase();
      const isAI = nameLower.includes('gemini') || nameLower.includes('google') || nameLower.includes('openai') || nameLower.includes('anthropic') || nameLower.includes('deepseek') || nameLower.includes('groq') || nameLower.includes('openrouter') || nameLower.includes('cohere');
      if (isAI) return { ...k, status: 'inactive' as const };
      return k;
    });
    await updateSettings(auth.orgId, { apiKeys: updatedKeys });
  }
  return json({ success: true, message: 'AI provider key removed/deactivated.' });
}
