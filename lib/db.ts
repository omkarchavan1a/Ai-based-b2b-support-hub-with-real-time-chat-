/**
 * SQLite data layer via @libsql/client.
 * - Local dev: file at ./data/app.db (set LIBSQL_URL=file:./data/app.db or leave unset)
 * - Vercel/prod: Turso — set LIBSQL_URL + LIBSQL_AUTH_TOKEN (local files are
 *   ephemeral on serverless, so a file DB would NOT persist there).
 */
import { createClient, type Client } from '@libsql/client';
import path from 'node:path';
import fs from 'node:fs';
import type {
  Organization, User, Customer, Conversation, Message,
  KBArticle, AISuggestionLog, SupportSettings,
} from '@/src/types';
import { hashPassword } from '@/lib/auth';

let client: Client | null = null;
let initialized = false;

export function nid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getClient(): Client {
  if (client) return client;
  const url = process.env.LIBSQL_URL;
  if (url) {
    client = createClient({ url, authToken: process.env.LIBSQL_AUTH_TOKEN });
  } else {
    const dir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    client = createClient({ url: `file:${path.join(dir, 'app.db')}` });
  }
  return client;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, role TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'offline',
  password_hash TEXT, password_salt TEXT
);
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, email TEXT NOT NULL,
  name TEXT NOT NULL, company_name TEXT, avatar_url TEXT,
  created_at TEXT NOT NULL, phone TEXT, location TEXT,
  browser_info TEXT, notes TEXT
);
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, customer_id TEXT NOT NULL,
  assigned_agent_id TEXT, status TEXT NOT NULL, channel TEXT NOT NULL,
  priority TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL, last_message_at TEXT NOT NULL,
  sla_breach_time TEXT, csat_score REAL, summary TEXT,
  problem_description TEXT, resolution_notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_conv_org ON conversations(org_id);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL,
  sender_type TEXT NOT NULL, sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL, sender_avatar_url TEXT,
  content TEXT NOT NULL, attachments TEXT,
  read_at TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id);
CREATE TABLE IF NOT EXISTS kb_articles (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, title TEXT NOT NULL,
  category TEXT NOT NULL, content TEXT NOT NULL, embedding TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_suggestions_logs (
  id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL,
  suggested_text TEXT NOT NULL, was_used INTEGER NOT NULL DEFAULT 0,
  agent_edited INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_log_conv ON ai_suggestions_logs(conversation_id);
CREATE TABLE IF NOT EXISTS settings (
  org_id TEXT PRIMARY KEY, sla_config TEXT NOT NULL,
  business_hours TEXT NOT NULL, routing_rule TEXT NOT NULL,
  api_keys TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS presence (
  customer_id TEXT PRIMARY KEY, org_id TEXT NOT NULL, last_seen TEXT NOT NULL
);
`;

const SEED_KB = [
  {
    id: 'kb_1', orgId: 'org_stellar', title: 'SAML Single Sign-On (SSO) Setup Guide', category: 'Security',
    content: '### SAML SSO Integration\n\nStellar B2B supports SAML 2.0 Identity Providers (IdP) including Okta, Azure AD, and OneLogin.\n\n#### Typical Issues:\n1. **InResponseTo field does not match error**:\n   This occurs when the authentication request has expired, or when a user tries to reuse a stale bookmark. Check if your IdP clock skew is under 5 minutes.\n2. **Signature Verification Failed**:\n   Ensure that you have uploaded the correct x509 public signing certificate from Okta/Azure into your Stellar dashboard.\n\n#### Configuration values:\n- **ACS (Assertion Consumer Service) URL**: `https://api.stellarb2b.com/sso/saml/acs`\n- **Entity ID**: `https://api.stellarb2b.com/sso/saml/metadata`\n- **NameID Format**: `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress`',
    createdAt: '2026-01-10T00:00:00.000Z', updatedAt: '2026-01-10T00:00:00.000Z',
  },
  {
    id: 'kb_2', orgId: 'org_stellar', title: 'Billing Policies & Pro-rated Credits', category: 'Billing',
    content: '### Seats & Proration Policies\n\nOur subscription is charged per-seat per-month. \n\n#### Adding Seats:\nWhen you add a new team member, we charge a pro-rated amount for the remainder of the current billing cycle.\n\n#### Deleting Seats:\nWhen you delete a user, the seat remains active until the end of the current billing cycle. However, if you explicitly cancel a seat and want a credit, our policy allows support agents to apply a **Credit Balance** to your account if the seat was empty and unused for more than 15 days of the cycle.\n\nTo apply a refund or credit, go to the agent refund console under customer profiles.',
    createdAt: '2026-01-12T00:00:00.000Z', updatedAt: '2026-01-12T00:00:00.000Z',
  },
  {
    id: 'kb_3', orgId: 'org_stellar', title: 'API Webhook Event Payloads & Signatures', category: 'Technical',
    content: '### Webhook Deliveries\n\nWebhooks are dispatched as HTTPS POST payloads containing a JSON payload.\n\n#### Event Schema Example (`payment.succeeded`):\n```json\n{\n  "event": "payment.succeeded",\n  "created": 1783456000,\n  "data": {\n    "amount": 25000,\n    "currency": "usd",\n    "customer": "cust_bob",\n    "invoiceId": "inv_908123"\n  }\n}\n```\n\n#### Verification:\nWe sign all webhook payloads. Each request contains a Header `X-Stellar-Signature` which is a HMAC-SHA256 signature calculated using your webhook secret key.',
    createdAt: '2026-01-15T00:00:00.000Z', updatedAt: '2026-01-15T00:00:00.000Z',
  },
  {
    id: 'kb_4', orgId: 'org_stellar', title: 'Custom Domain SSL Configuration', category: 'Technical',
    content: '### Custom White-Label Domains\n\nTo host your support hub on a custom subdomain like `support.yourcompany.com`:\n\n1. Go to **Settings > Domains**.\n2. Add your custom subdomain.\n3. Create a **CNAME record** with your DNS provider pointing to `ingress.stellarb2b.com`.\n4. We will provision a free Let\'s Encrypt SSL Certificate automatically within 15 minutes of DNS propagation.',
    createdAt: '2026-01-20T00:00:00.000Z', updatedAt: '2026-01-20T00:00:00.000Z',
  },
];

const SEED_USERS = [
  { id: 'usr_sarah', orgId: 'org_stellar', role: 'owner', email: 'stellar-admin@b2bhub.ai', name: 'Workspace Owner', avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop&crop=faces', status: 'online' },
  { id: 'usr_john', orgId: 'org_stellar', role: 'agent', email: 'stellar-john@b2bhub.ai', name: 'Support Specialist', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=faces', status: 'online' },
  { id: 'usr_omkar', orgId: 'org_stellar', role: 'agent', email: 'omkar@b2bhub.ai', name: 'Omkar Chavan', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=faces', status: 'busy' },
];

export async function initDb(): Promise<void> {
  if (initialized) return;
  const c = getClient();
  for (const stmt of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) {
    await c.execute(stmt);
  }
  const orgs = await c.execute('SELECT COUNT(*) AS n FROM organizations');
  if (Number(orgs.rows[0]?.n ?? 0) === 0) {
    const now = new Date().toISOString();
    await c.execute({ sql: 'INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)', args: ['org_stellar', 'Stellar B2B SaaS', '2026-01-01T00:00:00.000Z'] });
    await c.execute({ sql: 'INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)', args: ['org_horizon', 'Horizon Commerce', '2026-01-15T00:00:00.000Z'] });
    for (const u of SEED_USERS) {
      const { hash, salt } = hashPassword('P@ssword123!');
      await c.execute({
        sql: 'INSERT INTO users (id, org_id, role, email, name, avatar_url, status, password_hash, password_salt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [u.id, u.orgId, u.role, u.email, u.name, u.avatarUrl, u.status, hash, salt],
      });
    }
    for (const a of SEED_KB) {
      await c.execute({
        sql: 'INSERT INTO kb_articles (id, org_id, title, category, content, embedding, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        args: [a.id, a.orgId, a.title, a.category, a.content, null, a.createdAt, a.updatedAt],
      });
    }
    const sla = JSON.stringify({ low: 1440, medium: 480, high: 120, urgent: 60 });
    await c.execute({ sql: 'INSERT INTO settings (org_id, sla_config, business_hours, routing_rule, api_keys) VALUES (?, ?, ?, ?, ?)', args: ['org_stellar', sla, JSON.stringify({ enabled: false, start: '09:00', end: '17:00', timezone: 'UTC' }), 'round-robin', '[]'] });
    await c.execute({ sql: 'INSERT INTO settings (org_id, sla_config, business_hours, routing_rule, api_keys) VALUES (?, ?, ?, ?, ?)', args: ['org_horizon', sla, JSON.stringify({ enabled: false, start: '09:00', end: '17:00', timezone: 'UTC' }), 'round-robin', '[]'] });
    console.log(`Seeded SQLite DB at ${now}`);
  }
  initialized = true;
}

// --- Row mappers ---
function mapUser(r: any): User {
  return { id: r.id, orgId: r.org_id, role: r.role, email: r.email, name: r.name, avatarUrl: r.avatar_url ?? undefined, status: r.status, passwordHash: r.password_hash ?? undefined, passwordSalt: r.password_salt ?? undefined };
}
function mapCustomer(r: any): Customer {
  return { id: r.id, orgId: r.org_id, email: r.email, name: r.name, avatarUrl: r.avatar_url ?? undefined, companyName: r.company_name ?? undefined, createdAt: r.created_at, phone: r.phone ?? undefined, notes: r.notes ?? undefined, location: r.location ?? undefined, browserInfo: r.browser_info ?? undefined };
}
function mapConversation(r: any): Conversation {
  return {
    id: r.id, orgId: r.org_id, customerId: r.customer_id, assignedAgentId: r.assigned_agent_id ?? null,
    status: r.status, channel: r.channel, priority: r.priority,
    tags: r.tags ? JSON.parse(r.tags as string) : [],
    createdAt: r.created_at, lastMessageAt: r.last_message_at,
    slaBreachTime: r.sla_breach_time ?? undefined, csatScore: r.csat_score ?? undefined,
    summary: r.summary ?? undefined, problemDescription: r.problem_description ?? undefined,
    resolutionNotes: r.resolution_notes ?? undefined,
  };
}
function mapMessage(r: any): Message {
  return {
    id: r.id, conversationId: r.conversation_id, senderType: r.sender_type, senderId: r.sender_id,
    senderName: r.sender_name, senderAvatarUrl: r.sender_avatar_url ?? undefined, content: r.content,
    attachments: r.attachments ? JSON.parse(r.attachments as string) : undefined,
    readAt: r.read_at ?? null, createdAt: r.created_at,
  };
}
function mapKb(r: any): KBArticle {
  return {
    id: r.id, orgId: r.org_id, title: r.title, content: r.content, category: r.category,
    createdAt: r.created_at, updatedAt: r.updated_at,
    embedding: r.embedding ? JSON.parse(r.embedding as string) : undefined,
  };
}
function mapLog(r: any): AISuggestionLog {
  return { id: r.id, conversationId: r.conversation_id, suggestedText: r.suggested_text, wasUsed: !!r.was_used, agentEdited: !!r.agent_edited, createdAt: r.created_at };
}
function mapSettings(r: any): SupportSettings {
  return {
    orgId: r.org_id, slaConfig: JSON.parse(r.sla_config as string),
    businessHours: JSON.parse(r.business_hours as string), routingRule: r.routing_rule,
    apiKeys: r.api_keys ? JSON.parse(r.api_keys as string) : [],
  };
}

export function publicUser(u: User) {
  const { passwordHash: _h, passwordSalt: _s, ...rest } = u;
  return rest;
}

// --- Presence (heartbeat-driven online status; 30s window) ---
const ONLINE_WINDOW_MS = 30_000;

export async function heartbeat(customerId: string, orgId: string): Promise<void> {
  await initDb();
  const now = new Date().toISOString();
  await getClient().execute({
    sql: 'INSERT INTO presence (customer_id, org_id, last_seen) VALUES (?, ?, ?) ON CONFLICT(customer_id) DO UPDATE SET last_seen = excluded.last_seen, org_id = excluded.org_id',
    args: [customerId, orgId, now],
  });
}

export async function isCustomerOnline(customerId: string): Promise<boolean> {
  await initDb();
  const rs = await getClient().execute({ sql: 'SELECT last_seen FROM presence WHERE customer_id = ?', args: [customerId] });
  const last = rs.rows[0]?.last_seen as string | undefined;
  if (!last) return false;
  return Date.now() - new Date(last).getTime() < ONLINE_WINDOW_MS;
}

export async function dropPresence(customerIds: string[]): Promise<void> {
  if (customerIds.length === 0) return;
  await initDb();
  await getClient().execute({
    sql: `DELETE FROM presence WHERE customer_id IN (${customerIds.map(() => '?').join(',')})`,
    args: customerIds,
  });
}

// --- Users / orgs ---
export async function getUserById(id: string): Promise<User | null> {
  await initDb();
  const rs = await getClient().execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] });
  return rs.rows[0] ? mapUser(rs.rows[0]) : null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  await initDb();
  const rs = await getClient().execute({ sql: 'SELECT * FROM users WHERE lower(email) = lower(?)', args: [email] });
  return rs.rows[0] ? mapUser(rs.rows[0]) : null;
}

export async function getOrgUsers(orgId: string): Promise<User[]> {
  await initDb();
  const rs = await getClient().execute({ sql: 'SELECT * FROM users WHERE org_id = ?', args: [orgId] });
  return rs.rows.map(mapUser);
}

export async function getOrgById(id: string): Promise<Organization | null> {
  await initDb();
  const rs = await getClient().execute({ sql: 'SELECT * FROM organizations WHERE id = ?', args: [id] });
  const r = rs.rows[0];
  return r ? { id: r.id as string, name: r.name as string, createdAt: r.created_at as string } : null;
}

export async function createOrgWithOwner(org: Organization, user: User, settings: SupportSettings): Promise<void> {
  await initDb();
  const c = getClient();
  await c.execute({ sql: 'INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)', args: [org.id, org.name, org.createdAt] });
  await c.execute({
    sql: 'INSERT INTO users (id, org_id, role, email, name, avatar_url, status, password_hash, password_salt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [user.id, user.orgId, user.role, user.email, user.name, user.avatarUrl ?? null, user.status, user.passwordHash ?? null, user.passwordSalt ?? null],
  });
  await c.execute({
    sql: 'INSERT INTO settings (org_id, sla_config, business_hours, routing_rule, api_keys) VALUES (?, ?, ?, ?, ?)',
    args: [settings.orgId, JSON.stringify(settings.slaConfig), JSON.stringify(settings.businessHours), settings.routingRule, JSON.stringify(settings.apiKeys ?? [])],
  });
}

// --- Conversations ---
export async function getConversations(orgId: string): Promise<Conversation[]> {
  await initDb();
  const rs = await getClient().execute({ sql: 'SELECT * FROM conversations WHERE org_id = ? ORDER BY last_message_at DESC', args: [orgId] });
  return rs.rows.map(mapConversation);
}

export async function getConversationById(id: string): Promise<Conversation | null> {
  await initDb();
  const rs = await getClient().execute({ sql: 'SELECT * FROM conversations WHERE id = ?', args: [id] });
  return rs.rows[0] ? mapConversation(rs.rows[0]) : null;
}

export async function createConversation(c: Conversation): Promise<void> {
  await initDb();
  await getClient().execute({
    sql: 'INSERT INTO conversations (id, org_id, customer_id, assigned_agent_id, status, channel, priority, tags, created_at, last_message_at, sla_breach_time, csat_score, summary, problem_description, resolution_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [c.id, c.orgId, c.customerId, c.assignedAgentId, c.status, c.channel, c.priority, JSON.stringify(c.tags ?? []), c.createdAt, c.lastMessageAt, c.slaBreachTime ?? null, c.csatScore ?? null, c.summary ?? null, c.problemDescription ?? null, c.resolutionNotes ?? null],
  });
}

export async function updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | null> {
  const conv = await getConversationById(id);
  if (!conv) return null;
  const merged: Conversation = { ...conv, ...updates, id: conv.id, orgId: conv.orgId };
  await getClient().execute({
    sql: 'UPDATE conversations SET assigned_agent_id = ?, status = ?, channel = ?, priority = ?, tags = ?, last_message_at = ?, sla_breach_time = ?, csat_score = ?, summary = ?, problem_description = ?, resolution_notes = ? WHERE id = ?',
    args: [merged.assignedAgentId, merged.status, merged.channel, merged.priority, JSON.stringify(merged.tags ?? []), merged.lastMessageAt, merged.slaBreachTime ?? null, merged.csatScore ?? null, merged.summary ?? null, merged.problemDescription ?? null, merged.resolutionNotes ?? null, id],
  });
  return merged;
}

export async function deleteConversation(id: string): Promise<void> {
  await initDb();
  const c = getClient();
  await c.execute({ sql: 'DELETE FROM messages WHERE conversation_id = ?', args: [id] });
  await c.execute({ sql: 'DELETE FROM ai_suggestions_logs WHERE conversation_id = ?', args: [id] });
  await c.execute({ sql: 'DELETE FROM conversations WHERE id = ?', args: [id] });
}

// --- Messages ---
export async function getMessages(conversationId: string): Promise<Message[]> {
  await initDb();
  const rs = await getClient().execute({ sql: 'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC', args: [conversationId] });
  return rs.rows.map(mapMessage);
}

export async function saveMessage(msg: Message): Promise<Message> {
  await initDb();
  const c = getClient();
  const existing = await c.execute({ sql: 'SELECT * FROM messages WHERE id = ?', args: [msg.id] });
  if (existing.rows[0]) return mapMessage(existing.rows[0]);

  if (!msg.senderAvatarUrl) {
    if (msg.senderType === 'agent') {
      const u = await getUserById(msg.senderId);
      if (u?.avatarUrl) msg.senderAvatarUrl = u.avatarUrl;
    } else if (msg.senderType === 'customer') {
      const cust = await getCustomerById(msg.senderId);
      if (cust?.avatarUrl) msg.senderAvatarUrl = cust.avatarUrl;
    } else if (msg.senderType === 'ai') {
      msg.senderAvatarUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&h=150&fit=crop';
    }
  }
  await c.execute({
    sql: 'INSERT INTO messages (id, conversation_id, sender_type, sender_id, sender_name, sender_avatar_url, content, attachments, read_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [msg.id, msg.conversationId, msg.senderType, msg.senderId, msg.senderName, msg.senderAvatarUrl ?? null, msg.content, msg.attachments ? JSON.stringify(msg.attachments) : null, msg.readAt, msg.createdAt],
  });
  await c.execute({ sql: 'UPDATE conversations SET last_message_at = ? WHERE id = ?', args: [msg.createdAt, msg.conversationId] });
  return msg;
}

// --- Customers ---
export async function getCustomerById(id: string): Promise<Customer | null> {
  await initDb();
  const rs = await getClient().execute({ sql: 'SELECT * FROM customers WHERE id = ?', args: [id] });
  return rs.rows[0] ? mapCustomer(rs.rows[0]) : null;
}

export async function getOrgCustomers(orgId: string): Promise<Customer[]> {
  await initDb();
  const rs = await getClient().execute({ sql: 'SELECT * FROM customers WHERE org_id = ?', args: [orgId] });
  return rs.rows.map(mapCustomer);
}

export async function upsertCustomer(c: Customer): Promise<void> {
  await initDb();
  await getClient().execute({
    sql: 'INSERT INTO customers (id, org_id, email, name, company_name, avatar_url, created_at, phone, location, browser_info, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET org_id = excluded.org_id, email = excluded.email, name = excluded.name, company_name = excluded.company_name, avatar_url = excluded.avatar_url, phone = excluded.phone, location = excluded.location, browser_info = excluded.browser_info, notes = excluded.notes',
    args: [c.id, c.orgId, c.email, c.name, c.companyName ?? null, c.avatarUrl ?? null, c.createdAt, c.phone ?? null, c.location ?? undefined as unknown as string ?? null, c.browserInfo ?? null, c.notes ?? null],
  });
}

export async function patchCustomer(id: string, updates: Partial<Customer>): Promise<Customer | null> {
  const cust = await getCustomerById(id);
  if (!cust) return null;
  const merged = { ...cust, ...updates, id: cust.id, orgId: cust.orgId };
  await getClient().execute({
    sql: 'UPDATE customers SET email = ?, name = ?, company_name = ?, avatar_url = ?, phone = ?, location = ?, browser_info = ?, notes = ? WHERE id = ?',
    args: [merged.email, merged.name, merged.companyName ?? null, merged.avatarUrl ?? null, merged.phone ?? null, merged.location ?? null, merged.browserInfo ?? null, merged.notes ?? null, id],
  });
  return merged;
}

// --- KB ---
export async function getKbArticles(orgId: string): Promise<KBArticle[]> {
  await initDb();
  const rs = await getClient().execute({ sql: 'SELECT * FROM kb_articles WHERE org_id = ?', args: [orgId] });
  return rs.rows.map(mapKb);
}

export async function createKbArticle(a: KBArticle): Promise<void> {
  await initDb();
  await getClient().execute({
    sql: 'INSERT INTO kb_articles (id, org_id, title, category, content, embedding, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [a.id, a.orgId, a.title, a.category, a.content, a.embedding ? JSON.stringify(a.embedding) : null, a.createdAt, a.updatedAt],
  });
}

export async function getKbArticleById(id: string): Promise<KBArticle | null> {
  await initDb();
  const rs = await getClient().execute({ sql: 'SELECT * FROM kb_articles WHERE id = ?', args: [id] });
  return rs.rows[0] ? mapKb(rs.rows[0]) : null;
}

export async function deleteKbArticle(id: string): Promise<void> {
  await initDb();
  await getClient().execute({ sql: 'DELETE FROM kb_articles WHERE id = ?', args: [id] });
}

export async function saveKbEmbedding(id: string, embedding: number[]): Promise<void> {
  await initDb();
  await getClient().execute({ sql: 'UPDATE kb_articles SET embedding = ? WHERE id = ?', args: [JSON.stringify(embedding), id] });
}

// --- AI suggestion logs ---
export async function addSuggestionLog(log: AISuggestionLog): Promise<void> {
  await initDb();
  await getClient().execute({
    sql: 'INSERT INTO ai_suggestions_logs (id, conversation_id, suggested_text, was_used, agent_edited, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    args: [log.id, log.conversationId, log.suggestedText, log.wasUsed ? 1 : 0, log.agentEdited ? 1 : 0, log.createdAt],
  });
}

export async function getLatestSuggestionLog(conversationId: string): Promise<AISuggestionLog | null> {
  await initDb();
  const rs = await getClient().execute({ sql: 'SELECT * FROM ai_suggestions_logs WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1', args: [conversationId] });
  return rs.rows[0] ? mapLog(rs.rows[0]) : null;
}

export async function updateSuggestionLog(id: string, wasUsed: boolean, agentEdited: boolean): Promise<boolean> {
  await initDb();
  const rs = await getClient().execute({ sql: 'UPDATE ai_suggestions_logs SET was_used = ?, agent_edited = ? WHERE id = ?', args: [wasUsed ? 1 : 0, agentEdited ? 1 : 0, id] });
  return (rs.rowsAffected ?? 0) > 0;
}

export async function getLogWithConversation(id: string): Promise<{ log: AISuggestionLog; conv: Conversation | null }> {
  await initDb();
  const rs = await getClient().execute({ sql: 'SELECT * FROM ai_suggestions_logs WHERE id = ?', args: [id] });
  if (!rs.rows[0]) throw new Error('not_found');
  const log = mapLog(rs.rows[0]);
  const conv = await getConversationById(log.conversationId);
  return { log, conv };
}

// --- Settings ---
export async function getSettings(orgId: string): Promise<SupportSettings> {
  await initDb();
  const rs = await getClient().execute({ sql: 'SELECT * FROM settings WHERE org_id = ?', args: [orgId] });
  if (rs.rows[0]) return mapSettings(rs.rows[0]);
  const fresh: SupportSettings = {
    orgId,
    slaConfig: { low: 1440, medium: 480, high: 120, urgent: 60 },
    businessHours: { enabled: false, start: '09:00', end: '17:00', timezone: 'UTC' },
    routingRule: 'round-robin',
    apiKeys: [],
  };
  await updateSettings(orgId, fresh);
  return fresh;
}

export async function updateSettings(orgId: string, updates: Partial<SupportSettings>): Promise<SupportSettings> {
  await initDb();
  const current = await getSettings(orgId);
  const merged: SupportSettings = { ...current, ...updates, orgId };
  await getClient().execute({
    sql: 'INSERT INTO settings (org_id, sla_config, business_hours, routing_rule, api_keys) VALUES (?, ?, ?, ?, ?) ON CONFLICT(org_id) DO UPDATE SET sla_config = excluded.sla_config, business_hours = excluded.business_hours, routing_rule = excluded.routing_rule, api_keys = excluded.api_keys',
    args: [orgId, JSON.stringify(merged.slaConfig), JSON.stringify(merged.businessHours), merged.routingRule, JSON.stringify(merged.apiKeys ?? [])],
  });
  return merged;
}

// --- Workspace ops ---
export async function resetWorkspaceData(orgId: string): Promise<{ conversations: number; customers: number }> {
  await initDb();
  const c = getClient();
  const convs = await c.execute({ sql: 'SELECT id FROM conversations WHERE org_id = ?', args: [orgId] });
  const convIds = convs.rows.map((r) => r.id as string);
  const custs = await c.execute({ sql: 'SELECT id FROM customers WHERE org_id = ?', args: [orgId] });
  const custIds = custs.rows.map((r) => r.id as string);
  if (convIds.length > 0) {
    const ph = convIds.map(() => '?').join(',');
    await c.execute({ sql: `DELETE FROM messages WHERE conversation_id IN (${ph})`, args: [...convIds] });
    await c.execute({ sql: `DELETE FROM ai_suggestions_logs WHERE conversation_id IN (${ph})`, args: [...convIds] });
    await c.execute({ sql: 'DELETE FROM conversations WHERE org_id = ?', args: [orgId] });
  }
  await c.execute({ sql: 'DELETE FROM customers WHERE org_id = ?', args: [orgId] });
  await dropPresence(custIds);
  return { conversations: convIds.length, customers: custIds.length };
}

export async function deleteWorkspace(orgId: string): Promise<void> {
  await resetWorkspaceData(orgId);
  const c = getClient();
  await c.execute({ sql: 'DELETE FROM kb_articles WHERE org_id = ?', args: [orgId] });
  await c.execute({ sql: 'DELETE FROM settings WHERE org_id = ?', args: [orgId] });
  await c.execute({ sql: 'DELETE FROM users WHERE org_id = ?', args: [orgId] });
  await c.execute({ sql: 'DELETE FROM organizations WHERE id = ?', args: [orgId] });
}

export async function clearOfflineConversations(orgId: string): Promise<{ ids: string[]; deletedCustomerIds: string[] }> {
  await initDb();
  const convs = await getConversations(orgId);
  const toDelete: string[] = [];
  for (const c of convs) {
    if (!(await isCustomerOnline(c.customerId))) toDelete.push(c.id);
  }
  const preset = new Set(['cust_alice', 'cust_bob', 'cust_charlie']);
  const deletedCustomerIds: string[] = [];
  for (const id of toDelete) {
    const conv = await getConversationById(id);
    await deleteConversation(id);
    if (conv && !preset.has(conv.customerId)) {
      const stillUsed = (await getClient().execute({ sql: 'SELECT id FROM conversations WHERE customer_id = ? LIMIT 1', args: [conv.customerId] })).rows[0];
      if (!stillUsed) {
        await getClient().execute({ sql: 'DELETE FROM customers WHERE id = ?', args: [conv.customerId] });
        deletedCustomerIds.push(conv.customerId);
      }
    }
  }
  await dropPresence(deletedCustomerIds);
  return { ids: toDelete, deletedCustomerIds };
}

// --- Analytics ---
export async function getAnalytics(orgId: string) {
  const orgConvs = await getConversations(orgId);
  const totalTickets = orgConvs.length;
  const openTickets = orgConvs.filter((c) => c.status === 'open').length;
  const pendingTickets = orgConvs.filter((c) => c.status === 'pending').length;
  const closedTickets = orgConvs.filter((c) => c.status === 'closed').length;
  const ratings = orgConvs.filter((c) => c.csatScore !== undefined).map((c) => c.csatScore!);
  const averageCsat = ratings.length > 0 ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)) : 5.0;
  const slaBreached = orgConvs.filter((c) => {
    if (c.status === 'closed') return false;
    return c.slaBreachTime && new Date(c.slaBreachTime) < new Date();
  }).length;
  await initDb();
  const logsRs = await getClient().execute({
    sql: 'SELECT l.* FROM ai_suggestions_logs l JOIN conversations c ON c.id = l.conversation_id WHERE c.org_id = ?',
    args: [orgId],
  });
  const logs = logsRs.rows.map(mapLog);
  const helpfulPercentage = logs.length > 0 ? Math.round((logs.filter((l) => l.wasUsed).length / logs.length) * 100) : 85;
  return {
    totalTickets, openTickets, pendingTickets, closedTickets, averageCsat, slaBreached, helpfulPercentage,
    ticketVolumeTrends: [
      { name: 'Mon', tickets: 4 },
      { name: 'Tue', tickets: 7 },
      { name: 'Wed', tickets: 5 },
      { name: 'Thu', tickets: 8 },
      { name: 'Fri', tickets: 6 },
      { name: 'Sat', tickets: 2 },
      { name: 'Sun', tickets: totalTickets },
    ],
  };
}
