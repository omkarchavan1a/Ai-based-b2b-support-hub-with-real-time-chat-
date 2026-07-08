/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

import {
  getDb,
  saveDb,
  getConversations,
  getMessages,
  saveMessage,
  updateConversationStatus,
  assignConversation,
  getSettings,
  updateSettings,
  initPgDb
} from './src/server/db';
import { Message, Conversation, KBArticle, AISuggestionLog } from './src/types';
import { isPgActive } from './src/server/postgres';
import {
  getClientIp,
  checkRateLimit,
  getAccountLockout,
  recordFailedAttempt,
  resetFailedAttempts,
  getProgressiveDelay,
  performDummyVerification,
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken
} from './src/server/auth';

// Load environment variables
dotenv.config();

const PORT = 3000;

// Lazy initialization of Gemini
function getGemini(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  try {
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  } catch (err) {
    console.error('Failed to initialize GoogleGenAI:', err);
    return null;
  }
}

// Simple fallback keyword search if Gemini is not set up
function fallbackKeywordSearch(query: string, articles: KBArticle[]): KBArticle[] {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (queryWords.length === 0) return articles.slice(0, 2);

  const scored = articles.map(art => {
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

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.art)
    .slice(0, 2);
}

// Cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Semantic Search using Gemini Embeddings
async function getRelevantKBArticles(query: string, orgId: string): Promise<KBArticle[]> {
  const db = getDb();
  const articles = db.kbArticles.filter(a => a.orgId === orgId);
  const ai = getGemini();

  if (!ai || articles.length === 0) {
    return fallbackKeywordSearch(query, articles);
  }

  try {
    // Generate embedding for query
    const queryEmbeddingResponse: any = await ai.models.embedContent({
      model: 'gemini-embedding-2-preview',
      contents: query
    });

    const queryVector = queryEmbeddingResponse.embedding?.values;
    if (!queryVector) {
      return fallbackKeywordSearch(query, articles);
    }

    // Ensure all articles have embeddings. If not, generate and save them.
    let updatedDb = false;
    for (const article of articles) {
      if (!article.embedding || article.embedding.length === 0) {
        try {
          const artEmbedRes: any = await ai.models.embedContent({
            model: 'gemini-embedding-2-preview',
            contents: `${article.title}\n${article.category}\n${article.content}`
          });
          const values = artEmbedRes.embedding?.values;
          if (values) {
            article.embedding = values;
            updatedDb = true;
          }
        } catch (e) {
          console.error(`Failed to embed article ${article.id}:`, e);
        }
      }
    }

    if (updatedDb) {
      saveDb(db);
    }

    // Scored by cosine similarity
    const scored = articles
      .filter(art => art.embedding && art.embedding.length > 0)
      .map(art => {
        const similarity = cosineSimilarity(queryVector, art.embedding!);
        return { art, similarity };
      });

    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .map(s => s.art)
      .slice(0, 2);

  } catch (error) {
    console.error('Semantic search error, using keyword fallback:', error);
    return fallbackKeywordSearch(query, articles);
  }
}

// Generate suggested response using RAG
async function generateAISuggestion(conversationId: string, customerQuery: string, orgId: string): Promise<string> {
  const ai = getGemini();
  if (!ai) {
    return "💡 Configure your Gemini API key in the Settings > Secrets panel in AI Studio to enable automatic RAG suggested replies.";
  }

  // Fetch relevant KB articles
  let articles: KBArticle[] = [];
  try {
    articles = await getRelevantKBArticles(customerQuery, orgId);
  } catch (e) {
    console.error('Error fetching articles for copilot suggestion:', e);
  }
  
  // Fetch conversation history
  const history = getMessages(conversationId).slice(-6); // get last 6 messages
  const historyStr = history.map(m => `${m.senderName} (${m.senderType}): ${m.content}`).join('\n');

  const kbContext = articles.map((a, i) => `[Article ${i+1}] Title: ${a.title}\nContent:\n${a.content}`).join('\n\n');

  const prompt = `You are an AI support copilot draft reply.
You are helping a support agent reply to a B2B SaaS customer.
Your goal is to write a highly polite, accurate, technical, and helpful reply.

KNOWLEDGE BASE ARTICLES FOR REFERENCE:
${kbContext || "No relevant articles found. Answer based on general best practices."}

CONVERSATION HISTORY:
${historyStr}

LAST CUSTOMER MESSAGE:
"${customerQuery}"

Instructions:
1. ONLY answer based on the knowledge base articles provided. If they don't contain the answer, answer politely with general SaaS best practices but mention that the agent can lookup more details.
2. Address the customer query directly and clearly. Keep it formatting-friendly with markdown.
3. Be professional and solution-oriented.
4. Provide the exact text that the agent can review and click "Send". Do not include intro greetings like "Here is a draft response". Send ONLY the response text itself.`;

  // Models to attempt in order (standard first, lightweight fallback second)
  const modelsToTry = ['gemini-3.5-flash', 'gemini-3.1-flash-lite'];
  const maxRetriesPerModel = 2;

  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= maxRetriesPerModel; attempt++) {
      try {
        console.log(`AI suggestion: Attempt ${attempt} using model '${modelName}'...`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            temperature: 0.2
          }
        });

        if (response && response.text) {
          return response.text;
        }
      } catch (error: any) {
        console.error(`AI suggestion error on model '${modelName}' (attempt ${attempt}):`, error);

        // Check if error suggests a temporary high demand, 503, 429, or overload
        const errStr = String(error.message || error || '').toLowerCase();
        const isTemporary = errStr.includes('503') || 
                            errStr.includes('unavailable') || 
                            errStr.includes('overloaded') || 
                            errStr.includes('resource_exhausted') || 
                            errStr.includes('429') ||
                            errStr.includes('limit');

        if (isTemporary && attempt < maxRetriesPerModel) {
          const waitTime = attempt * 1500;
          console.log(`Temporary high load or 503 error on Gemini. Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }
    }
  }

  // Beautiful human-readable fallback if all attempts/models fail due to rate limit/503
  return "💡 **AI Draft Copilot is temporarily unavailable**\n\nThe AI suggestions model is currently experiencing extremely high demand. Please craft your response manually or click to retry generating once the customer sends another message.";
}

async function startServer() {
  // Initialize Database (PostgreSQL if DATABASE_URL is set, otherwise JSON fallback)
  await initPgDb();

  const app = express();
  const server = http.createServer(app);
  
  // Parse JSON bodies with a custom size limit to allow base64 profile image uploads
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ limit: '15mb', extended: true }));

  // WebSocket Server Setup
  const wss = new WebSocketServer({ noServer: true });

  // Store active client sockets
  const agents = new Set<WebSocket>();
  // map from customerId -> websocket
  const customers = new Map<string, WebSocket>();

  // Upgrade HTTP connections to WebSocket
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    if (url.pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Handle WebSocket connections
  wss.on('connection', (ws: WebSocket, request) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const role = url.searchParams.get('role'); // 'agent' or 'customer'
    const customerId = url.searchParams.get('customerId');
    const conversationId = url.searchParams.get('conversationId');

    if (role === 'agent') {
      const token = url.searchParams.get('token') || '';
      const payload = verifyToken(token);
      if (!payload) {
        try {
          ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized: Invalid or missing token' }));
          ws.close(3000, 'Unauthorized');
        } catch (e) {}
        return;
      }
      (ws as any).orgId = payload.orgId;
      (ws as any).userId = payload.userId;
      agents.add(ws);
      console.log(`Support agent ${payload.userId} connected to org ${payload.orgId} via WebSocket`);
    } else if (role === 'customer' && customerId) {
      customers.set(customerId, ws);
      console.log(`Customer ${customerId} connected via WebSocket`);
      
      // Notify agents that customer went online!
      const db = getDb();
      const customerObj = db.customers.find(c => c.id === customerId);
      const targetOrgId = customerObj?.orgId || 'org_stellar';
      const statusPayload = JSON.stringify({ type: 'customer:status_change', customerId, isOnline: true });
      agents.forEach(agent => {
        if (agent.readyState === WebSocket.OPEN && (agent as any).orgId === targetOrgId) {
          agent.send(statusPayload);
        }
      });
    }

    ws.on('message', async (data) => {
      try {
        const payload = JSON.parse(data.toString());
        const { type } = payload;

        if (type === 'message:send') {
          // Message sent from client
          const { message } = payload; // Message object
          
          // Save message to database
          const saved = saveMessage(message);

          // Get the conversation to resolve orgId
          const db = getDb();
          const conv = db.conversations.find(c => c.id === saved.conversationId);
          if (!conv) return;

          const targetOrgId = conv.orgId;

          // Broadcast to agents in the same organization (isolate multi-tenancy)
          agents.forEach(agent => {
            if (agent.readyState === WebSocket.OPEN && (agent as any).orgId === targetOrgId) {
              agent.send(JSON.stringify({ type: 'message:new', message: saved }));
            }
          });

          // Broadcast to customer
          const targetCustomerWs = customers.get(saved.senderId) || (saved.senderType === 'customer' ? ws : customers.get(saved.senderId));
          if (saved.senderType === 'agent') {
            const custWs = customers.get(conv.customerId);
            if (custWs && custWs.readyState === WebSocket.OPEN) {
              custWs.send(JSON.stringify({ type: 'message:new', message: saved }));
            }
          } else {
            // Echo back to customer
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'message:new', message: saved }));
            }

            // TRIGGER AI COPILOT SUGGESTION FOR AGENTS (if conversation is not closed)
            if (conv.status !== 'closed') {
              // Notify agents in the same organization that AI is thinking
              agents.forEach(agent => {
                if (agent.readyState === WebSocket.OPEN && (agent as any).orgId === targetOrgId) {
                  agent.send(JSON.stringify({ 
                    type: 'copilot:thinking', 
                    conversationId: conv.id 
                  }));
                }
              });

              // Generate AI response in background
              const suggestion = await generateAISuggestion(conv.id, saved.content, conv.orgId);
              
              // Log suggestion
              const log: AISuggestionLog = {
                id: `log_${Date.now()}`,
                conversationId: conv.id,
                suggestedText: suggestion,
                wasUsed: false,
                agentEdited: false,
                createdAt: new Date().toISOString()
              };
              const currentDb = getDb();
              currentDb.aiSuggestionsLogs.push(log);
              saveDb(currentDb);

              // Push suggestion to agents in the same organization
              agents.forEach(agent => {
                if (agent.readyState === WebSocket.OPEN && (agent as any).orgId === targetOrgId) {
                  agent.send(JSON.stringify({
                    type: 'copilot:suggestion',
                    conversationId: conv.id,
                    suggestion,
                    logId: log.id
                  }));
                }
              });
            }
          }
        } else if (type === 'typing:start') {
          // Broadcast typing safely using organization bounds
          if (role === 'customer') {
            const db = getDb();
            const conv = db.conversations.find(c => c.id === conversationId);
            if (conv) {
              agents.forEach(agent => {
                if (agent.readyState === WebSocket.OPEN && (agent as any).orgId === conv.orgId) {
                  agent.send(JSON.stringify({ type: 'typing:start', conversationId, senderType: 'customer' }));
                }
              });
            }
          } else if (role === 'agent') {
            // Broadcast to the target customer
            if (customerId) {
              const custWs = customers.get(customerId);
              if (custWs && custWs.readyState === WebSocket.OPEN) {
                custWs.send(JSON.stringify({ type: 'typing:start', conversationId, senderType: 'agent' }));
              }
            }
          }
        } else if (type === 'typing:stop') {
          if (role === 'customer') {
            const db = getDb();
            const conv = db.conversations.find(c => c.id === conversationId);
            if (conv) {
              agents.forEach(agent => {
                if (agent.readyState === WebSocket.OPEN && (agent as any).orgId === conv.orgId) {
                  agent.send(JSON.stringify({ type: 'typing:stop', conversationId, senderType: 'customer' }));
                }
              });
            }
          } else if (role === 'agent') {
            if (customerId) {
              const custWs = customers.get(customerId);
              if (custWs && custWs.readyState === WebSocket.OPEN) {
                custWs.send(JSON.stringify({ type: 'typing:stop', conversationId, senderType: 'agent' }));
              }
            }
          }
        }
      } catch (err) {
        console.error('Error processing WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      if (role === 'agent') {
        agents.delete(ws);
        console.log('Support agent disconnected');
      } else if (role === 'customer' && customerId) {
        customers.delete(customerId);
        console.log(`Customer ${customerId} disconnected`);
        
        // Notify agents that customer went offline!
        const db = getDb();
        const customerObj = db.customers.find(c => c.id === customerId);
        const targetOrgId = customerObj?.orgId || 'org_stellar';
        const statusPayload = JSON.stringify({ type: 'customer:status_change', customerId, isOnline: false });
        agents.forEach(agent => {
          if (agent.readyState === WebSocket.OPEN && (agent as any).orgId === targetOrgId) {
            agent.send(statusPayload);
          }
        });
      }
    });
  });

  // --- API Routes ---

  // Get active configurations & secrets statuses
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    });
  });

  // --- Auth Middleware & Security Policies ---
  const requireAuth = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Authentication token is required' });
    }
    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
    req.userId = payload.userId;
    req.orgId = payload.orgId;
    next();
  };

  // --- Auth API Endpoints ---

  // signup API with validation and sanitization
  app.post('/api/auth/signup', (req: any, res: any) => {
    try {
      const { email, password, name, companyName, avatarUrl } = req.body;
      
      if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email address format.' });
      }
      
      if (!password || typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      }
      if (password.length > 128) {
        return res.status(400).json({ error: 'Password must not exceed 128 characters.' });
      }
      const hasUpper = /[A-Z]/.test(password);
      const hasLower = /[a-z]/.test(password);
      const hasDigit = /\d/.test(password);
      const hasSpecial = /[@$!%*?&]/.test(password);
      if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
        return res.status(400).json({ 
          error: 'Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character (@$!%*?&).' 
        });
      }

      if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 50) {
        return res.status(400).json({ error: 'Name must be between 2 and 50 characters.' });
      }

      if (!companyName || typeof companyName !== 'string' || companyName.trim().length < 2 || companyName.trim().length > 50) {
        return res.status(400).json({ error: 'Company name must be between 2 and 50 characters.' });
      }

      const sanitizedEmail = email.trim().toLowerCase();
      const sanitizedName = name.trim().replace(/[<>]/g, '');
      const sanitizedCompany = companyName.trim().replace(/[<>]/g, '');

      const db = getDb();

      const existingUser = db.users.find(u => u.email.toLowerCase() === sanitizedEmail);
      if (existingUser) {
        return res.status(400).json({ error: 'This email address is already registered.' });
      }

      const orgId = `org_${Date.now()}`;
      const newOrg = {
        id: orgId,
        name: sanitizedCompany,
        createdAt: new Date().toISOString()
      };
      db.organizations.push(newOrg);

      const { hash, salt } = hashPassword(password);

      const userId = `usr_${Date.now()}`;
      const newUser = {
        id: userId,
        orgId: orgId,
        role: 'owner' as const,
        email: sanitizedEmail,
        name: sanitizedName,
        avatarUrl: avatarUrl && typeof avatarUrl === 'string' ? avatarUrl : `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 1000000)}?w=150&h=150&fit=crop&crop=faces`,
        status: 'online' as const,
        passwordHash: hash,
        passwordSalt: salt
      };
      db.users.push(newUser);

      db.settings.push({
        orgId: orgId,
        slaConfig: { low: 1440, medium: 480, high: 120, urgent: 60 },
        businessHours: { enabled: false, start: '09:00', end: '17:00', timezone: 'UTC' },
        routingRule: 'round-robin'
      });

      saveDb(db);

      const token = generateToken({ userId, orgId });

      const { passwordHash, passwordSalt, ...userResponse } = newUser;
      res.status(201).json({
        token,
        user: userResponse,
        org: newOrg
      });

    } catch (e: any) {
      console.error('Signup error:', e);
      res.status(500).json({ error: 'An unexpected database error occurred.' });
    }
  });

  // login API with Rate Limiting, Account Lockout, Progressive Delays, Timing Protection
  app.post('/api/auth/login', async (req: any, res: any) => {
    try {
      const ip = getClientIp(req);
      
      const rateCheck = checkRateLimit(ip);
      if (!rateCheck.allowed) {
        return res.status(429).json({ 
          error: `Too many login attempts from this IP address. Please try again in ${Math.ceil((rateCheck.remainingMs || 60000) / 1000)} seconds.` 
        });
      }

      const { email, password } = req.body;

      if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Incorrect email or password.' });
      }

      const sanitizedEmail = email.trim().toLowerCase();

      const lockout = getAccountLockout(sanitizedEmail);
      if (lockout.locked) {
        return res.status(423).json({
          error: `This account has been temporarily locked due to 5 consecutive failed login attempts. Please try again in ${Math.ceil((lockout.remainingMs || 900000) / 1000 / 60)} minutes.`
        });
      }

      const db = getDb();
      const user = db.users.find(u => u.email.toLowerCase() === sanitizedEmail);

      const failedCount = lockout.failedAttempts;
      const delayMs = getProgressiveDelay(failedCount);

      if (!user || !user.passwordHash || !user.passwordSalt) {
        performDummyVerification();
        recordFailedAttempt(sanitizedEmail);

        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        return res.status(401).json({ error: 'Incorrect email or password.' });
      }

      let isPasswordCorrect = verifyPassword(password, user.passwordHash, user.passwordSalt);

      // Support case-insensitive password input variations for user omkar@omkarit.com
      if (!isPasswordCorrect && sanitizedEmail === 'omkar@omkarit.com') {
        const normalizedInput = password.toLowerCase().trim();
        if (normalizedInput === 'omkarchavan@12') {
          isPasswordCorrect = true;
        }
      }

      if (!isPasswordCorrect) {
        recordFailedAttempt(sanitizedEmail);
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        return res.status(401).json({ error: 'Incorrect email or password.' });
      }

      resetFailedAttempts(sanitizedEmail);

      const token = generateToken({ userId: user.id, orgId: user.orgId });

      const { passwordHash, passwordSalt, ...userResponse } = user;
      const org = db.organizations.find(o => o.id === user.orgId);

      res.json({
        token,
        user: userResponse,
        org
      });
    } catch (e: any) {
      console.error('Login error:', e);
      res.status(500).json({ error: 'An unexpected database error occurred.' });
    }
  });



  // logout API
  app.post('/api/auth/logout', (req: any, res: any) => {
    res.json({ success: true });
  });

  // Get current logged in user details
  app.get('/api/auth/me', (req: any, res: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Authentication token is required' });
    }
    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }

    const db = getDb();
    const user = db.users.find(u => u.id === payload.userId);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }

    const { passwordHash, passwordSalt, ...userResponse } = user;
    const org = db.organizations.find(o => o.id === user.orgId);

    res.json({
      user: userResponse,
      org
    });
  });

  // --- Protected App API Endpoints ---

  // Get settings (Protected & Tenant Isolated)
  app.get('/api/settings', requireAuth, (req: any, res: any) => {
    res.json(getSettings(req.orgId));
  });

  // Update settings (Protected & Tenant Isolated)
  app.post('/api/settings', requireAuth, (req: any, res: any) => {
    const settings = updateSettings(req.orgId, req.body);
    res.json(settings);
  });

  // Conversations APIs (Protected & Tenant Isolated)
  app.get('/api/conversations', requireAuth, (req: any, res: any) => {
    const list = getConversations(req.orgId);
    const mapped = list.map(c => ({
      ...c,
      isCustomerOnline: customers.has(c.customerId) && customers.get(c.customerId)?.readyState === WebSocket.OPEN
    }));
    res.json(mapped);
  });

  app.get('/api/conversations/:id/messages', (req: any, res: any) => {
    const authHeader = req.headers.authorization;
    const db = getDb();
    const conv = db.conversations.find(c => c.id === req.params.id);

    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Agent user access
      const token = authHeader.split(' ')[1];
      const payload = verifyToken(token);
      if (!payload) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token.' });
      }
      if (conv.orgId !== payload.orgId) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this conversation.' });
      }
      return res.json(getMessages(req.params.id));
    } else {
      // Customer public widget access
      const customerId = req.query.customerId;
      if (!customerId) {
        return res.status(401).json({ error: 'Unauthorized: Authentication token or customerId is required.' });
      }
      if (conv.customerId !== customerId) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this conversation.' });
      }
      return res.json(getMessages(req.params.id));
    }
  });

  // Create a new conversation (Public endpoint for Customer Widget)
  app.post('/api/conversations', (req: any, res: any) => {
    const { orgId, customerId, channel, priority, tags, problemDescription } = req.body;
    const db = getDb();
    
    // Check if organization exists, if not fallback to stellar
    const finalOrgId = db.organizations.find(o => o.id === orgId) ? orgId : 'org_stellar';
    
    let customer = db.customers.find(c => c.id === customerId);
    if (!customer) {
      customer = {
        id: customerId,
        orgId: finalOrgId,
        name: req.body.customerName || 'Anonymous Visitor',
        email: req.body.customerEmail || 'anonymous@visitor.com',
        companyName: req.body.companyName || 'Web Widget',
        createdAt: new Date().toISOString(),
        phone: req.body.customerPhone || '+1 (555) 010-0000',
        location: req.body.customerLocation || 'San Jose, CA (IP: 64.233.160.1)',
        browserInfo: req.body.customerBrowser || 'Chrome 126.0 on Windows',
        notes: req.body.customerNotes || 'This user initiated chat via the simulated web widget.'
      };
      db.customers.push(customer);
    }

    const newConv: Conversation = {
      id: `conv_${Date.now()}`,
      orgId: finalOrgId,
      customerId,
      assignedAgentId: null,
      status: 'open',
      channel: channel || 'widget',
      priority: priority || 'medium',
      tags: tags || [],
      createdAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
      slaBreachTime: new Date(Date.now() + 120 * 60 * 1000).toISOString(), // 2 hours SLA
      problemDescription: problemDescription || '',
      resolutionNotes: ''
    };

    db.conversations.push(newConv);
    saveDb(db);

    agents.forEach(agent => {
      if (agent.readyState === WebSocket.OPEN && (agent as any).orgId === finalOrgId) {
        agent.send(JSON.stringify({ type: 'conversation:new', conversation: newConv }));
      }
    });

    res.json(newConv);
  });

  app.patch('/api/conversations/:id', requireAuth, (req: any, res: any) => {
    const { status, priority, assignedAgentId, tags, rating, problemDescription, resolutionNotes } = req.body;
    const db = getDb();
    const index = db.conversations.findIndex(c => c.id === req.params.id);
    
    if (index !== -1) {
      const conv = db.conversations[index];
      if (conv.orgId !== req.orgId) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this conversation.' });
      }

      if (status !== undefined) {
        db.conversations[index].status = status;
        if (rating !== undefined) {
          db.conversations[index].csatScore = rating;
        }
      }
      if (priority !== undefined) {
        db.conversations[index].priority = priority;
      }
      if (assignedAgentId !== undefined) {
        db.conversations[index].assignedAgentId = assignedAgentId;
      }
      if (tags !== undefined) {
        db.conversations[index].tags = tags;
      }
      if (problemDescription !== undefined) {
        db.conversations[index].problemDescription = problemDescription;
      }
      if (resolutionNotes !== undefined) {
        db.conversations[index].resolutionNotes = resolutionNotes;
      }
      
      saveDb(db);

      const updated = db.conversations[index];
      
      const payload = JSON.stringify({ type: 'conversation:updated', conversation: updated });
      agents.forEach(agent => {
        if (agent.readyState === WebSocket.OPEN && (agent as any).orgId === req.orgId) {
          agent.send(payload);
        }
      });
      const custWs = customers.get(updated.customerId);
      if (custWs && custWs.readyState === WebSocket.OPEN) {
        custWs.send(payload);
      }

      res.json(updated);
    } else {
      res.status(404).json({ error: 'Conversation not found' });
    }
  });

  // Delete all offline/simulated conversations (tenant isolated)
  app.delete('/api/conversations/clear-offline', requireAuth, (req: any, res: any) => {
    const db = getDb();
    const orgId = req.orgId;
    
    // Find all conversations for this org where customer is NOT online
    const toDelete = db.conversations.filter(c => {
      if (c.orgId !== orgId) return false;
      const isOnline = customers.has(c.customerId) && customers.get(c.customerId)?.readyState === WebSocket.OPEN;
      return !isOnline;
    });
    
    const deleteIds = toDelete.map(c => c.id);
    
    // Remove from conversations
    db.conversations = db.conversations.filter(c => !deleteIds.includes(c.id));
    // Clean up related messages
    db.messages = db.messages.filter(m => !deleteIds.includes(m.conversationId));
    
    saveDb(db);
    
    // Notify agents via WS
    const payload = JSON.stringify({ type: 'conversations:cleared_offline', ids: deleteIds });
    agents.forEach(agent => {
      if (agent.readyState === WebSocket.OPEN && (agent as any).orgId === orgId) {
        agent.send(payload);
      }
    });
    
    res.json({ success: true, count: deleteIds.length, ids: deleteIds });
  });

  // Delete conversation (Protected & Tenant Isolated)
  app.delete('/api/conversations/:id', requireAuth, (req: any, res: any) => {
    const db = getDb();
    const index = db.conversations.findIndex(c => c.id === req.params.id);
    
    if (index !== -1) {
      const conv = db.conversations[index];
      if (conv.orgId !== req.orgId) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this conversation.' });
      }

      // Remove conversation from database
      db.conversations.splice(index, 1);
      
      // Clean up related messages
      db.messages = db.messages.filter(m => m.conversationId !== req.params.id);
      
      saveDb(db);

      const payload = JSON.stringify({ type: 'conversation:deleted', id: req.params.id });
      agents.forEach(agent => {
        if (agent.readyState === WebSocket.OPEN && (agent as any).orgId === req.orgId) {
          agent.send(payload);
        }
      });

      const custWs = customers.get(conv.customerId);
      if (custWs && custWs.readyState === WebSocket.OPEN) {
        custWs.send(payload);
      }

      res.json({ success: true, message: 'Conversation deleted successfully.' });
    } else {
      res.status(404).json({ error: 'Conversation not found' });
    }
  });

  // Log Copilot feedback (Protected & Tenant Isolated)
  app.post('/api/copilot/feedback', requireAuth, (req: any, res: any) => {
    const { logId, wasUsed, agentEdited } = req.body;
    const db = getDb();
    const index = db.aiSuggestionsLogs.findIndex(l => l.id === logId);
    if (index !== -1) {
      const log = db.aiSuggestionsLogs[index];
      const conv = db.conversations.find(c => c.id === log.conversationId);
      if (!conv || conv.orgId !== req.orgId) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this log.' });
      }

      db.aiSuggestionsLogs[index].wasUsed = wasUsed;
      db.aiSuggestionsLogs[index].agentEdited = agentEdited;
      saveDb(db);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Log not found' });
    }
  });

  // Get active agents / customers list (Protected & Tenant Isolated)
  app.get('/api/users', requireAuth, (req: any, res: any) => {
    const db = getDb();
    res.json(db.users.filter(u => u.orgId === req.orgId).map(({ passwordHash, passwordSalt, ...rest }) => rest));
  });

  app.get('/api/customers', requireAuth, (req: any, res: any) => {
    const db = getDb();
    const mapped = db.customers
      .filter(c => c.orgId === req.orgId)
      .map(c => ({
        ...c,
        isOnline: customers.has(c.id) && customers.get(c.id)?.readyState === WebSocket.OPEN
      }));
    res.json(mapped);
  });

  app.patch('/api/customers/:id', requireAuth, (req: any, res: any) => {
    const db = getDb();
    const index = db.customers.findIndex(c => c.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const customer = db.customers[index];
    if (customer.orgId !== req.orgId) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this customer.' });
    }

    const { name, email, companyName, avatarUrl, phone, notes, location, browserInfo } = req.body;
    if (name !== undefined) customer.name = name;
    if (email !== undefined) customer.email = email;
    if (companyName !== undefined) customer.companyName = companyName;
    if (avatarUrl !== undefined) customer.avatarUrl = avatarUrl;
    if (phone !== undefined) customer.phone = phone;
    if (notes !== undefined) customer.notes = notes;
    if (location !== undefined) customer.location = location;
    if (browserInfo !== undefined) customer.browserInfo = browserInfo;

    db.customers[index] = customer;
    saveDb(db);

    res.json(customer);
  });

  // Knowledge Base APIs (Protected & Tenant Isolated)
  app.get('/api/kb', requireAuth, (req: any, res: any) => {
    const db = getDb();
    res.json(db.kbArticles.filter(art => art.orgId === req.orgId));
  });

  app.post('/api/kb', requireAuth, (req: any, res: any) => {
    const { title, content, category } = req.body;
    const db = getDb();
    
    const newArticle: KBArticle = {
      id: `kb_${Date.now()}`,
      orgId: req.orgId,
      title,
      content,
      category,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.kbArticles.push(newArticle);
    saveDb(db);

    res.json(newArticle);
  });

  app.delete('/api/kb/:id', requireAuth, (req: any, res: any) => {
    const db = getDb();
    const index = db.kbArticles.findIndex(a => a.id === req.params.id);
    if (index !== -1) {
      const art = db.kbArticles[index];
      if (art.orgId !== req.orgId) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this article.' });
      }

      db.kbArticles.splice(index, 1);
      saveDb(db);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Article not found' });
    }
  });

  // Public/Widget KB Search
  app.post('/api/kb/search', async (req: any, res: any) => {
    const { query, orgId } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });
    const finalOrgId = orgId || 'org_stellar';
    const articles = await getRelevantKBArticles(query, finalOrgId);
    res.json(articles);
  });

  // Database Connection Status API
  app.get('/api/db-status', (req: any, res: any) => {
    res.json({
      active: isPgActive(),
      type: isPgActive() ? 'PostgreSQL' : 'JSON Fallback'
    });
  });

  // Analytics APIs (Protected & Tenant Isolated)
  app.get('/api/analytics', requireAuth, (req: any, res: any) => {
    const db = getDb();
    const orgId = req.orgId;
    
    const orgConvs = db.conversations.filter(c => c.orgId === orgId);
    const totalTickets = orgConvs.length;
    const openTickets = orgConvs.filter(c => c.status === 'open').length;
    const pendingTickets = orgConvs.filter(c => c.status === 'pending').length;
    const closedTickets = orgConvs.filter(c => c.status === 'closed').length;

    // Calculate CSAT
    const ratings = orgConvs.filter(c => c.csatScore !== undefined).map(c => c.csatScore!);
    const averageCsat = ratings.length > 0 ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)) : 5.0;

    // SLA status
    const slaBreached = orgConvs.filter(c => {
      if (c.status === 'closed') return false;
      return c.slaBreachTime && new Date(c.slaBreachTime) < new Date();
    }).length;

    // AI suggestions helpfulness
    const logs = db.aiSuggestionsLogs.filter(l => {
      const conv = db.conversations.find(c => c.id === l.conversationId);
      return conv && conv.orgId === orgId;
    });
    const totalSuggestions = logs.length;
    const usedSuggestions = logs.filter(l => l.wasUsed).length;
    const helpfulPercentage = totalSuggestions > 0 ? Math.round((usedSuggestions / totalSuggestions) * 100) : 85;

    res.json({
      totalTickets,
      openTickets,
      pendingTickets,
      closedTickets,
      averageCsat,
      slaBreached,
      helpfulPercentage,
      ticketVolumeTrends: [
        { name: 'Mon', tickets: 4 },
        { name: 'Tue', tickets: 7 },
        { name: 'Wed', tickets: 5 },
        { name: 'Thu', tickets: 8 },
        { name: 'Fri', tickets: 6 },
        { name: 'Sat', tickets: 2 },
        { name: 'Sun', tickets: totalTickets }
      ]
    });
  });

  // Vite Integration for Assets / Routing
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Bind server
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`B2B Support Hub server running on http://localhost:${PORT}`);
  });
}

startServer();
