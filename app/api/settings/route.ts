import { json, err, requireAuth, isAuthError } from '@/lib/api';
import { getSettings, updateSettings } from '@/lib/db';
import { encrypt, maskKey, getDecryptedOrRawKey } from '@/lib/vault';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function maskSettings(s: any) {
  const settings = JSON.parse(JSON.stringify(s));
  if (settings.apiKeys) {
    settings.apiKeys = settings.apiKeys.map((k: any) => ({ ...k, apiKey: maskKey(getDecryptedOrRawKey(k)) }));
  }
  return settings;
}

export async function GET(req: Request) {
  const auth = requireAuth(req);
  if (isAuthError(auth)) return auth;
  return json(maskSettings(await getSettings(auth.orgId)));
}

export async function POST(req: Request) {
  const auth = requireAuth(req);
  if (isAuthError(auth)) return auth;
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const existing = await getSettings(auth.orgId);
    if (body.apiKeys && Array.isArray(body.apiKeys)) {
      body.apiKeys = body.apiKeys.map((incomingKey: any) => {
        if (incomingKey.apiKey && incomingKey.apiKey.includes('••••')) {
          const original = existing.apiKeys?.find((ok) => ok.id === incomingKey.id);
          if (original) return { ...incomingKey, apiKey: original.apiKey, isEncrypted: original.isEncrypted };
        }
        if (incomingKey.apiKey && incomingKey.apiKey.trim() !== '') {
          try {
            return { ...incomingKey, apiKey: encrypt(incomingKey.apiKey.trim()), isEncrypted: true };
          } catch (encErr) {
            console.error('Encryption failed for incoming key:', encErr);
          }
        }
        return incomingKey;
      });
    }
    const settings = await updateSettings(auth.orgId, body);
    return json(maskSettings(settings));
  } catch (e: any) {
    console.error('Update settings error:', e);
    return err(e.message || 'Failed to update settings.', 500);
  }
}
