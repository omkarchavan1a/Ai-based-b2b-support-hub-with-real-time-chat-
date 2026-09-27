import { json, err, requireAuth, isAuthError } from '@/lib/api';
import { getSettings, updateSettings } from '@/lib/db';
import { encrypt } from '@/lib/vault';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = requireAuth(req);
  if (isAuthError(auth)) return auth;
  const { provider, apiKey, model } = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!provider || !apiKey) {
    return err('Provider and API key are required.', 400);
  }
  try {
    const settings = await getSettings(auth.orgId);
    const existingKeys = settings.apiKeys || [];
    const encryptedKey = encrypt(apiKey.trim());
    const updatedKeys = existingKeys.map((k) => {
      const nameLower = k.providerName.toLowerCase();
      const isAI = nameLower.includes('gemini') || nameLower.includes('google') || nameLower.includes('openai') || nameLower.includes('anthropic') || nameLower.includes('deepseek');
      if (isAI) return { ...k, status: 'inactive' as const };
      return k;
    });
    const existingIndex = updatedKeys.findIndex((k) => k.providerName.toLowerCase() === provider.toLowerCase());
    const newKeyObj: any = {
      id: existingIndex !== -1 ? updatedKeys[existingIndex].id : `key_${Date.now()}`,
      providerName: provider,
      apiKey: encryptedKey,
      description: `Active ${provider} Key`,
      status: 'active' as const,
      createdAt: existingIndex !== -1 ? updatedKeys[existingIndex].createdAt : new Date().toISOString(),
      model,
      isEncrypted: true,
    };
    if (existingIndex !== -1) updatedKeys[existingIndex] = newKeyObj;
    else updatedKeys.push(newKeyObj);
    await updateSettings(auth.orgId, { apiKeys: updatedKeys });
    const masked = apiKey.length > 10 ? `${apiKey.substring(0, 6)}••••••••${apiKey.substring(apiKey.length - 4)}` : '••••••••••••';
    return json({ status: 'connected', provider, model, maskedPreview: masked });
  } catch (e: any) {
    console.error('Save AI key error:', e);
    return err(e.message || 'Failed to save AI key.', 500);
  }
}
