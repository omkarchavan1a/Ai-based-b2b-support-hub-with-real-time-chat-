import { json, err, requireAuth, isAuthError } from '@/lib/api';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  const auth = requireAuth(req);
  if (isAuthError(auth)) return auth;
  const { provider, apiKey, model } = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!provider || !apiKey) {
    return err('Provider and API key are required for testing.', 400);
  }
  try {
    const p = provider.toLowerCase();
    if (p.includes('gemini') || p.includes('google')) {
      let ai: GoogleGenAI;
      try {
        ai = new GoogleGenAI({ apiKey });
      } catch {
        return json({ status: 'invalid', error: 'Could not initialize GoogleGenAI client with the provided key.' }, 400);
      }
      const response = await ai.models.generateContent({ model: model || 'gemini-2.5-flash', contents: 'Ping', config: { maxOutputTokens: 1 } });
      if (response && response.text) {
        return json({ status: 'connected', message: 'Connection successful!' });
      }
      return json({ status: 'invalid', error: 'No response received from Gemini API.' }, 400);
    } else if (p.includes('openai')) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: model || 'gpt-4o-mini', messages: [{ role: 'user', content: 'Ping' }], max_tokens: 1 }),
      });
      if (response.ok) return json({ status: 'connected', message: 'Connection successful!' });
      return json({ status: 'invalid', error: `OpenAI returned error: ${response.status} - ${await response.text()}` }, 400);
    }
    return json({ status: 'connected', message: `Verification simulated successfully for custom provider ${provider}.` });
  } catch (error: any) {
    console.error('API key test error:', error);
    return json({ status: 'invalid', error: error.message || 'Verification request failed.' }, 500);
  }
}
