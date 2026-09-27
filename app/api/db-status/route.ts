import { json } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const turso = !!process.env.LIBSQL_URL;
  return json({ active: turso, type: turso ? 'Turso SQLite' : 'Local SQLite' });
}
