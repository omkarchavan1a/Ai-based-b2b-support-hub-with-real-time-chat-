import { json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const configured = !!process.env.LIBSQL_URL;
  let reachable = false;
  let error: string | null = null;
  try {
    const { getClient, initDb } = await import('@/lib/db');
    await initDb();
    await getClient().execute('SELECT 1');
    reachable = true;
  } catch (e: any) {
    error = e?.message ?? String(e);
  }
  return json({
    active: reachable,
    type: configured ? 'Turso SQLite' : 'Local SQLite',
    configured,
    reachable,
    error,
    env: {
      hasSessionSecret: !!process.env.SESSION_SECRET,
      hasVaultKey: !!process.env.VAULT_ENC_KEY,
      hasGeminiKey: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY',
    },
  });
}
