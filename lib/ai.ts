/**
 * AI Copilot: RAG retrieval + multi-provider generation (ported from Express server).
 * Embeddings are persisted in the kb_articles.embedding column.
 * Node.js runtime only.
 */
import { GoogleGenAI } from '@google/genai';
import type { KBArticle, AISuggestionLog } from '@/src/types';
import { getKbArticles, saveKbEmbedding, getMessages, getLatestSuggestionLog, addSuggestionLog } from '@/lib/db';
import { nid } from '@/lib/db';
import { decrypt } from '@/lib/vault';
import { getSettings } from '@/lib/db';

export function getOrgActiveAIKey(settings: { apiKeys?: { providerName: string; apiKey: string; status: string; isEncrypted?: boolean; model?: string }[] } | null): { provider: string; key: string; model?: string } | undefined {
  try {
    if (settings && settings.apiKeys) {
      const aiKeyObj = settings.apiKeys.find((k) => {
        if (k.status !== 'active' || !k.apiKey || k.apiKey.trim() === '') return false;
        const nameLower = k.providerName.toLowerCase();
        return nameLower.includes('gemini') || nameLower.includes('google') || nameLower.includes('openai') || nameLower.includes('anthropic') || nameLower.includes('deepseek');
      });
      if (aiKeyObj) {
        let decryptedKey = aiKeyObj.apiKey.trim();
        if (aiKeyObj.isEncrypted) {
          try {
            decryptedKey = decrypt(decryptedKey);
          } catch (decErr) {
            console.error('Failed to decrypt custom key:', decErr);
            return undefined;
          }
        }
        const nameLower = aiKeyObj.providerName.toLowerCase();
        let provider = 'gemini';
        if (nameLower.includes('openai')) provider = 'openai';
        else if (nameLower.includes('anthropic')) provider = 'anthropic';
        else if (nameLower.includes('deepseek')) provider = 'deepseek';
        return { provider, key: decryptedKey, model: aiKeyObj.model };
      }
    }
  } catch (err) {
    console.error('Error fetching org-specific active AI key:', err);
  }
  return undefined;
}

function getGemini(customKey?: string): GoogleGenAI | null {
  const apiKey = customKey || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') return null;
  try {
    return new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
  } catch (err) {
    console.error('Failed to initialize GoogleGenAI:', err);
    return null;
  }
}

export function fallbackKeywordSearch(query: string, articles: KBArticle[]): KBArticle[] {
  const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (queryWords.length === 0) return articles.slice(0, 2);
  const scored = articles.map((art) => {
    let score = 0;
    const titleLower = art.title.toLowerCase();
    const contentLower = art.content.toLowerCase();
    const categoryLower = art.category.toLowerCase();
    for (const word of queryWords) {
      if (titleLower.includes(word)) score += 10;
      if (categoryLower.includes(word)) score += 5;
      if (contentLower.includes(word)) score += 2;
    }
    return { art, score };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).map((s) => s.art).slice(0, 2);
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function getAIEmbedding(provider: string, apiKey: string, text: string): Promise<number[] | null> {
  try {
    if (provider === 'gemini') {
      const ai = getGemini(apiKey);
      if (!ai) return null;
      for (const modelName of ['gemini-embedding-2-preview', 'text-embedding-004']) {
        try {
          const res: any = await ai.models.embedContent({ model: modelName, contents: text });
          if (res?.embedding?.values) return res.embedding.values;
        } catch (err) {
          console.error(`Gemini embedding model ${modelName} failed:`, err);
        }
      }
      return null;
    }
    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
      });
      if (response.ok) {
        const data: any = await response.json();
        return data.data?.[0]?.embedding || null;
      }
      console.error('OpenAI embedding endpoint error:', await response.text());
    }
  } catch (err) {
    console.error(`Failed to generate embedding for provider ${provider}:`, err);
  }
  return null;
}

export async function getRelevantKBArticles(query: string, orgId: string): Promise<KBArticle[]> {
  const articles = await getKbArticles(orgId);
  const settings = await getSettings(orgId);
  const activeAI = getOrgActiveAIKey(settings);
  if (!activeAI || articles.length === 0) return fallbackKeywordSearch(query, articles);
  try {
    const queryVector = await getAIEmbedding(activeAI.provider, activeAI.key, query);
    if (!queryVector || queryVector.length === 0) return fallbackKeywordSearch(query, articles);
    for (const article of articles) {
      if (!article.embedding || article.embedding.length !== queryVector.length) {
        try {
          const values = await getAIEmbedding(activeAI.provider, activeAI.key, `${article.title}\n${article.category}\n${article.content}`);
          if (values) {
            article.embedding = values;
            await saveKbEmbedding(article.id, values);
          }
        } catch (e) {
          console.error(`Failed to embed article ${article.id}:`, e);
        }
      }
    }
    return articles
      .filter((art) => art.embedding && art.embedding.length === queryVector.length)
      .map((art) => ({ art, similarity: cosineSimilarity(queryVector, art.embedding!) }))
      .sort((a, b) => b.similarity - a.similarity)
      .map((s) => s.art)
      .slice(0, 2);
  } catch (error) {
    console.error('Semantic search error, using keyword fallback:', error);
    return fallbackKeywordSearch(query, articles);
  }
}

export async function generateGenericAISuggestion(provider: string, apiKey: string, prompt: string): Promise<string> {
  console.log(`Generating AI suggestion using provider: ${provider}...`);
  if (provider === 'gemini') {
    const ai = getGemini(apiKey);
    if (!ai) throw new Error('Gemini API key is invalid or not provided');
    for (const modelName of ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-2.5-flash']) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`Trying Gemini model: ${modelName} (attempt ${attempt}/2)...`);
          const response = await ai.models.generateContent({ model: modelName, contents: prompt, config: { temperature: 0.2 } });
          if (response && response.text) {
            console.log(`Success with Gemini model: ${modelName}`);
            return response.text;
          }
        } catch (err: any) {
          console.error(`Gemini model ${modelName} attempt ${attempt} failed:`, err);
          const errStr = String(err.message || err || '').toLowerCase();
          if ((errStr.includes('503') || errStr.includes('unavailable') || errStr.includes('429')) && attempt < 2) {
            await new Promise((r) => setTimeout(r, 1500));
          }
        }
      }
    }
    throw new Error('All Gemini model generation attempts failed');
  }
  if (provider === 'openai') {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.2 }),
    });
    if (!response.ok) throw new Error(`OpenAI API error: ${response.status} - ${await response.text()}`);
    const data: any = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
  if (provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-3-5-haiku-20241022', max_tokens: 1024, messages: [{ role: 'user', content: prompt }], temperature: 0.2 }),
    });
    if (!response.ok) throw new Error(`Anthropic API error: ${response.status} - ${await response.text()}`);
    const data: any = await response.json();
    return data.content?.[0]?.text || '';
  }
  if (provider === 'deepseek') {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.2 }),
    });
    if (!response.ok) throw new Error(`DeepSeek API error: ${response.status} - ${await response.text()}`);
    const data: any = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
  if (provider === 'groq') {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.2 }),
    });
    if (!response.ok) throw new Error(`Groq API error: ${response.status} - ${await response.text()}`);
    const data: any = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
  if (provider === 'openrouter') {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'meta-llama/llama-3-8b-instruct:free', messages: [{ role: 'user', content: prompt }], temperature: 0.2 }),
    });
    if (!response.ok) throw new Error(`OpenRouter API error: ${response.status} - ${await response.text()}`);
    const data: any = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
  if (provider === 'cohere') {
    const response = await fetch('https://api.cohere.com/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ message: prompt, model: 'command-r-plus', temperature: 0.2 }),
    });
    if (!response.ok) throw new Error(`Cohere API error: ${response.status} - ${await response.text()}`);
    const data: any = await response.json();
    return data.text || '';
  }
  throw new Error(`Unsupported AI provider: ${provider}`);
}

export async function generateAISuggestion(conversationId: string, customerQuery: string, orgId: string): Promise<string> {
  const settings = await getSettings(orgId);
  const activeAI = getOrgActiveAIKey(settings);
  if (!activeAI) {
    return '💡 Configure an API key in Settings > AI Provider to enable automatic RAG suggested replies.';
  }
  let articles: KBArticle[] = [];
  try {
    articles = await getRelevantKBArticles(customerQuery, orgId);
  } catch (e) {
    console.error('Error fetching articles for copilot suggestion:', e);
  }
  const history = (await getMessages(conversationId)).slice(-6);
  const historyStr = history.map((m) => `${m.senderName} (${m.senderType}): ${m.content}`).join('\n');
  const kbContext = articles.map((a, i) => `[Article ${i + 1}] Title: ${a.title}\nContent:\n${a.content}`).join('\n\n');
  const prompt = `You are an AI support copilot draft reply.
You are helping a support agent reply to a B2B SaaS customer.
Your goal is to write a highly polite, accurate, technical, and helpful reply.

KNOWLEDGE BASE ARTICLES FOR REFERENCE:
${kbContext || 'No relevant articles found. Answer based on general best practices.'}

CONVERSATION HISTORY:
${historyStr}

LAST CUSTOMER MESSAGE:
"${customerQuery}"

Instructions:
1. ONLY answer based on the knowledge base articles provided. If they don't contain the answer, answer politely with general SaaS best practices but mention that the agent can lookup more details.
2. Address the customer query directly and clearly. Keep it formatting-friendly with markdown.
3. Be professional and solution-oriented.
4. Provide the exact text that the agent can review and click "Send". Do not include intro greetings like "Here is a draft response". Send ONLY the response text itself.`;
  try {
    const responseText = await generateGenericAISuggestion(activeAI.provider, activeAI.key, prompt);
    if (responseText) return responseText;
  } catch (error: any) {
    console.error(`AI suggestion generation failed via ${activeAI.provider}:`, error);
  }
  return `💡 **AI Draft Copilot (${activeAI.provider.toUpperCase()}) is temporarily unavailable**\n\nThe AI suggestions model is currently experiencing extremely high demand or an authentication issue. Please verify your registered API key or craft your response manually.`;
}

/**
 * Polling-friendly copilot: if the newest customer message in the conversation
 * is newer than the latest stored suggestion, generate + store a fresh one.
 * Returns the latest log, or null when no suggestion is relevant
 * (e.g. agent already replied after the last customer message).
 */
export async function ensureSuggestion(conversationId: string, orgId: string): Promise<AISuggestionLog | null> {
  const messages = await getMessages(conversationId);
  if (messages.length === 0) return null;
  const lastCustomer = [...messages].reverse().find((m) => m.senderType === 'customer');
  if (!lastCustomer) return null;
  const latest = await getLatestSuggestionLog(conversationId);
  if (latest && new Date(latest.createdAt).getTime() >= new Date(lastCustomer.createdAt).getTime()) {
    return latest;
  }
  const lastMsg = messages[messages.length - 1];
  if (lastMsg.senderType !== 'customer') return latest;
  const suggestion = await generateAISuggestion(conversationId, lastCustomer.content, orgId);
  const log: AISuggestionLog = {
    id: nid('log'), conversationId, suggestedText: suggestion,
    wasUsed: false, agentEdited: false, createdAt: new Date().toISOString(),
  };
  await addSuggestionLog(log);
  return log;
}
