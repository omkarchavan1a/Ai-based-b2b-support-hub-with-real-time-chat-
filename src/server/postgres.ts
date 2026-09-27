/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import pg from 'pg';
import { 
  Organization, User, Customer, Conversation, Message, 
  KBArticle, AISuggestionLog, SupportSettings 
} from '../types';

const { Pool } = pg;

let pool: pg.Pool | null = null;
const dbUrl = process.env.DATABASE_URL;

export function isPgActive(): boolean {
  return !!dbUrl && dbUrl.trim() !== '' && dbUrl !== 'MY_DATABASE_URL';
}

if (isPgActive()) {
  const isLocal = dbUrl!.includes('localhost') || dbUrl!.includes('127.0.0.1');
  pool = new Pool({
    connectionString: dbUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false }
  });
  
  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err);
  });
}

// Helper to query Postgres securely
async function query(text: string, params?: any[]) {
  if (!pool) {
    throw new Error('PostgreSQL pool is not initialized');
  }
  return pool.query(text, params);
}

// DDL for creating tables
const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    org_id VARCHAR(255) REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    status VARCHAR(50),
    password_hash VARCHAR(255),
    password_salt VARCHAR(255)
  )`,
  `CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(255) PRIMARY KEY,
    org_id VARCHAR(255) REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    phone VARCHAR(50),
    location VARCHAR(255),
    browser_info VARCHAR(255),
    notes TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS conversations (
    id VARCHAR(255) PRIMARY KEY,
    org_id VARCHAR(255) REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id VARCHAR(255) REFERENCES customers(id) ON DELETE CASCADE,
    assigned_agent_id VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    priority VARCHAR(50) NOT NULL,
    tags TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_message_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sla_breach_time TIMESTAMP WITH TIME ZONE,
    csat_score INTEGER,
    summary TEXT,
    problem_description TEXT,
    resolution_notes TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(255) PRIMARY KEY,
    conversation_id VARCHAR(255) REFERENCES conversations(id) ON DELETE CASCADE,
    sender_type VARCHAR(50) NOT NULL,
    sender_id VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255) NOT NULL,
    sender_avatar_url TEXT,
    content TEXT NOT NULL,
    attachments TEXT,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS kb_articles (
    id VARCHAR(255) PRIMARY KEY,
    org_id VARCHAR(255) REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    content TEXT,
    embedding TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ai_suggestions_logs (
    id VARCHAR(255) PRIMARY KEY,
    conversation_id VARCHAR(255) REFERENCES conversations(id) ON DELETE CASCADE,
    suggested_text TEXT,
    was_used BOOLEAN,
    agent_edited BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    org_id VARCHAR(255) PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    sla_config TEXT,
    business_hours TEXT,
    routing_rule VARCHAR(100),
    api_keys TEXT
  )`
];

// Initialize database schema and migrate data
export async function initPgSchema(localDbGetter: () => any) {
  if (!isPgActive()) return;
  
  console.log('Initializing PostgreSQL database schema...');
  try {
    // Run DDL statements
    for (const statement of DDL_STATEMENTS) {
      await query(statement);
    }
    
    // Ensure api_keys column exists on settings table for custom keys in case of an existing table
    await query('ALTER TABLE settings ADD COLUMN IF NOT EXISTS api_keys TEXT');
    
    console.log('PostgreSQL tables checked/created successfully.');
    
    // Seed with existing JSON DB if PG is empty
    const { rows } = await query('SELECT COUNT(*) FROM organizations');
    const orgCount = parseInt(rows[0].count, 10);
    
    if (orgCount === 0) {
      console.log('PostgreSQL is empty. Migrating local JSON database into PostgreSQL...');
      const localData = localDbGetter();
      
      // Migrate Organizations
      for (const org of localData.organizations || []) {
        await query(
          'INSERT INTO organizations (id, name, created_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
          [org.id, org.name, org.createdAt]
        );
      }
      
      // Migrate Users
      for (const user of localData.users || []) {
        await query(
          `INSERT INTO users (id, org_id, role, email, name, avatar_url, status, password_hash, password_salt) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
          [user.id, user.orgId, user.role, user.email, user.name, user.avatarUrl, user.status, user.passwordHash, user.passwordSalt]
        );
      }
      
      // Migrate Customers
      for (const cust of localData.customers || []) {
        await query(
          `INSERT INTO customers (id, org_id, email, name, company_name, avatar_url, created_at, phone, location, browser_info, notes) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING`,
          [cust.id, cust.orgId, cust.email, cust.name, cust.companyName, cust.avatarUrl, cust.createdAt, cust.phone, cust.location, cust.browserInfo, cust.notes]
        );
      }
      
      // Migrate Conversations
      for (const conv of localData.conversations || []) {
        await query(
          `INSERT INTO conversations (id, org_id, customer_id, assigned_agent_id, status, channel, priority, tags, created_at, last_message_at, sla_breach_time, csat_score, summary, problem_description, resolution_notes) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) ON CONFLICT (id) DO NOTHING`,
          [
            conv.id, conv.orgId, conv.customerId, conv.assignedAgentId, conv.status, conv.channel, conv.priority, 
            JSON.stringify(conv.tags || []), conv.createdAt, conv.lastMessageAt, conv.slaBreachTime, conv.csatScore, 
            conv.summary, conv.problemDescription, conv.resolutionNotes
          ]
        );
      }
      
      // Migrate Messages
      for (const msg of localData.messages || []) {
        await query(
          `INSERT INTO messages (id, conversation_id, sender_type, sender_id, sender_name, sender_avatar_url, content, attachments, read_at, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING`,
          [msg.id, msg.conversationId, msg.senderType, msg.senderId, msg.senderName, msg.senderAvatarUrl, msg.content, JSON.stringify(msg.attachments || []), msg.readAt, msg.createdAt]
        );
      }
      
      // Migrate KB Articles
      for (const art of localData.kbArticles || []) {
        await query(
          `INSERT INTO kb_articles (id, org_id, title, category, content, embedding, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING`,
          [art.id, art.orgId, art.title, art.category, art.content, JSON.stringify(art.embedding || []), art.createdAt, art.updatedAt]
        );
      }
      
      // Migrate Logs
      for (const log of localData.aiSuggestionsLogs || []) {
        await query(
          `INSERT INTO ai_suggestions_logs (id, conversation_id, suggested_text, was_used, agent_edited, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
          [log.id, log.conversationId, log.suggestedText, log.wasUsed, log.agentEdited, log.createdAt]
        );
      }
      
      // Migrate Settings
      for (const set of localData.settings || []) {
        await query(
          `INSERT INTO settings (org_id, sla_config, business_hours, routing_rule, api_keys) 
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (org_id) DO NOTHING`,
          [set.orgId, JSON.stringify(set.slaConfig), JSON.stringify(set.businessHours), set.routingRule, JSON.stringify(set.apiKeys || [])]
        );
      }
      
      console.log('Database migration successfully completed!');
    }
  } catch (err) {
    console.error('Failed to initialize PostgreSQL:', err);
  }
}

// Reconstruct complete schema object from PG (for backward compatibility fallback)
export async function pgGetDb(): Promise<any> {
  const [orgs, users, custs, convs, msgs, arts, logs, sets] = await Promise.all([
    query('SELECT * FROM organizations'),
    query('SELECT * FROM users'),
    query('SELECT * FROM customers'),
    query('SELECT * FROM conversations'),
    query('SELECT * FROM messages'),
    query('SELECT * FROM kb_articles'),
    query('SELECT * FROM ai_suggestions_logs'),
    query('SELECT * FROM settings')
  ]);
  
  return {
    organizations: orgs.rows.map(o => ({ id: o.id, name: o.name, createdAt: o.created_at?.toISOString() || o.created_at })),
    users: users.rows.map(u => ({
      id: u.id, orgId: u.org_id, role: u.role, email: u.email, name: u.name,
      avatarUrl: u.avatar_url, status: u.status, passwordHash: u.password_hash, passwordSalt: u.password_salt
    })),
    customers: custs.rows.map(c => ({
      id: c.id, orgId: c.org_id, email: c.email, name: c.name, companyName: c.company_name,
      avatarUrl: c.avatar_url, createdAt: c.created_at?.toISOString() || c.created_at, phone: c.phone,
      location: c.location, browserInfo: c.browser_info, notes: c.notes
    })),
    conversations: convs.rows.map(c => ({
      id: c.id, orgId: c.org_id, customerId: c.customer_id, assignedAgentId: c.assigned_agent_id,
      status: c.status, channel: c.channel, priority: c.priority, tags: JSON.parse(c.tags || '[]'),
      createdAt: c.created_at?.toISOString() || c.created_at, lastMessageAt: c.last_message_at?.toISOString() || c.last_message_at,
      slaBreachTime: c.sla_breach_time?.toISOString() || c.sla_breach_time, csatScore: c.csat_score,
      summary: c.summary, problemDescription: c.problem_description, resolutionNotes: c.resolution_notes
    })),
    messages: msgs.rows.map(m => ({
      id: m.id, conversationId: m.conversation_id, senderType: m.sender_type, senderId: m.sender_id,
      senderName: m.sender_name, senderAvatarUrl: m.sender_avatar_url, content: m.content,
      attachments: JSON.parse(m.attachments || '[]'), readAt: m.read_at?.toISOString() || m.read_at,
      createdAt: m.created_at?.toISOString() || m.created_at
    })),
    kbArticles: arts.rows.map(a => ({
      id: a.id, orgId: a.org_id, title: a.title, category: a.category, content: a.content,
      embedding: JSON.parse(a.embedding || '[]'), createdAt: a.created_at?.toISOString() || a.created_at,
      updatedAt: a.updated_at?.toISOString() || a.updated_at
    })),
    aiSuggestionsLogs: logs.rows.map(l => ({
      id: l.id, conversationId: l.conversation_id, suggestedText: l.suggested_text,
      wasUsed: l.was_used, agentEdited: l.agent_edited, createdAt: l.created_at?.toISOString() || l.created_at
    })),
    settings: sets.rows.map(s => ({
      orgId: s.org_id, slaConfig: JSON.parse(s.sla_config || '{}'),
      businessHours: JSON.parse(s.business_hours || '{}'), routingRule: s.routing_rule,
      apiKeys: JSON.parse(s.api_keys || '[]')
    }))
  };
}

// Full schema sync function to save back to PG
export async function pgSaveDb(schema: any) {
  console.log('Syncing database schema changes to PostgreSQL...');
  try {
    for (const org of schema.organizations || []) {
      await query(
        `INSERT INTO organizations (id, name, created_at) VALUES ($1, $2, $3) 
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [org.id, org.name, org.createdAt]
      );
    }
    
    for (const user of schema.users || []) {
      await query(
        `INSERT INTO users (id, org_id, role, email, name, avatar_url, status, password_hash, password_salt) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         ON CONFLICT (id) DO UPDATE SET org_id = EXCLUDED.org_id, role = EXCLUDED.role, email = EXCLUDED.email, 
         name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url, status = EXCLUDED.status, 
         password_hash = EXCLUDED.password_hash, password_salt = EXCLUDED.password_salt`,
        [user.id, user.orgId, user.role, user.email, user.name, user.avatarUrl, user.status, user.passwordHash, user.passwordSalt]
      );
    }
    
    for (const cust of schema.customers || []) {
      await query(
        `INSERT INTO customers (id, org_id, email, name, company_name, avatar_url, created_at, phone, location, browser_info, notes) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
         ON CONFLICT (id) DO UPDATE SET org_id = EXCLUDED.org_id, email = EXCLUDED.email, name = EXCLUDED.name, 
         company_name = EXCLUDED.company_name, avatar_url = EXCLUDED.avatar_url, phone = EXCLUDED.phone, 
         location = EXCLUDED.location, browser_info = EXCLUDED.browser_info, notes = EXCLUDED.notes`,
        [cust.id, cust.orgId, cust.email, cust.name, cust.companyName, cust.avatarUrl, cust.createdAt, cust.phone, cust.location, cust.browserInfo, cust.notes]
      );
    }
    
    for (const conv of schema.conversations || []) {
      await query(
        `INSERT INTO conversations (id, org_id, customer_id, assigned_agent_id, status, channel, priority, tags, created_at, last_message_at, sla_breach_time, csat_score, summary, problem_description, resolution_notes) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
         ON CONFLICT (id) DO UPDATE SET assigned_agent_id = EXCLUDED.assigned_agent_id, status = EXCLUDED.status, 
         priority = EXCLUDED.priority, tags = EXCLUDED.tags, last_message_at = EXCLUDED.last_message_at, 
         sla_breach_time = EXCLUDED.sla_breach_time, csat_score = EXCLUDED.csat_score, summary = EXCLUDED.summary, 
         problem_description = EXCLUDED.problem_description, resolution_notes = EXCLUDED.resolution_notes`,
        [
          conv.id, conv.orgId, conv.customerId, conv.assignedAgentId, conv.status, conv.channel, conv.priority, 
          JSON.stringify(conv.tags || []), conv.createdAt, conv.lastMessageAt, conv.slaBreachTime, conv.csatScore, 
          conv.summary, conv.problemDescription, conv.resolutionNotes
        ]
      );
    }
    
    for (const msg of schema.messages || []) {
      await query(
        `INSERT INTO messages (id, conversation_id, sender_type, sender_id, sender_name, sender_avatar_url, content, attachments, read_at, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
         ON CONFLICT (id) DO UPDATE SET read_at = EXCLUDED.read_at`,
        [msg.id, msg.conversationId, msg.senderType, msg.senderId, msg.senderName, msg.senderAvatarUrl, msg.content, JSON.stringify(msg.attachments || []), msg.readAt, msg.createdAt]
      );
    }
    
    for (const art of schema.kbArticles || []) {
      await query(
        `INSERT INTO kb_articles (id, org_id, title, category, content, embedding, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, 
         content = EXCLUDED.content, embedding = EXCLUDED.embedding, updated_at = EXCLUDED.updated_at`,
        [art.id, art.orgId, art.title, art.category, art.content, JSON.stringify(art.embedding || []), art.createdAt, art.updatedAt]
      );
    }
    
    for (const log of schema.aiSuggestionsLogs || []) {
      await query(
        `INSERT INTO ai_suggestions_logs (id, conversation_id, suggested_text, was_used, agent_edited, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         ON CONFLICT (id) DO UPDATE SET was_used = EXCLUDED.was_used, agent_edited = EXCLUDED.agent_edited`,
        [log.id, log.conversationId, log.suggestedText, log.wasUsed, log.agentEdited, log.createdAt]
      );
    }
    
    for (const set of schema.settings || []) {
      await query(
        `INSERT INTO settings (org_id, sla_config, business_hours, routing_rule, api_keys) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (org_id) DO UPDATE SET sla_config = EXCLUDED.sla_config, 
         business_hours = EXCLUDED.business_hours, routing_rule = EXCLUDED.routing_rule,
         api_keys = EXCLUDED.api_keys`,
        [set.orgId, JSON.stringify(set.slaConfig), JSON.stringify(set.businessHours), set.routingRule, JSON.stringify(set.apiKeys || [])]
      );
    }
  } catch (err) {
    console.error('Failed to sync changes with PostgreSQL:', err);
  }
}

// Single entity query optimizations to avoid full schema fetch where possible
export async function pgGetConversations(orgId: string): Promise<Conversation[]> {
  const { rows } = await query('SELECT * FROM conversations WHERE org_id = $1', [orgId]);
  return rows.map(c => ({
    id: c.id,
    orgId: c.org_id,
    customerId: c.customer_id,
    assignedAgentId: c.assigned_agent_id,
    status: c.status,
    channel: c.channel,
    priority: c.priority,
    tags: JSON.parse(c.tags || '[]'),
    createdAt: c.created_at?.toISOString() || c.created_at,
    lastMessageAt: c.last_message_at?.toISOString() || c.last_message_at,
    slaBreachTime: c.sla_breach_time?.toISOString() || c.sla_breach_time,
    csatScore: c.csat_score,
    summary: c.summary,
    problemDescription: c.problem_description,
    resolutionNotes: c.resolution_notes
  }));
}

export async function pgGetMessages(conversationId: string): Promise<Message[]> {
  const { rows } = await query('SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC', [conversationId]);
  return rows.map(m => ({
    id: m.id,
    conversationId: m.conversation_id,
    senderType: m.sender_type,
    senderId: m.sender_id,
    senderName: m.sender_name,
    senderAvatarUrl: m.sender_avatar_url,
    content: m.content,
    attachments: JSON.parse(m.attachments || '[]'),
    readAt: m.read_at?.toISOString() || m.read_at,
    createdAt: m.created_at?.toISOString() || m.created_at
  }));
}

export async function pgSaveMessage(msg: Message): Promise<Message> {
  await query(
    `INSERT INTO messages (id, conversation_id, sender_type, sender_id, sender_name, sender_avatar_url, content, attachments, read_at, created_at) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
     ON CONFLICT (id) DO UPDATE SET read_at = EXCLUDED.read_at`,
    [msg.id, msg.conversationId, msg.senderType, msg.senderId, msg.senderName, msg.senderAvatarUrl, msg.content, JSON.stringify(msg.attachments || []), msg.readAt, msg.createdAt]
  );
  
  await query(
    'UPDATE conversations SET last_message_at = $1 WHERE id = $2',
    [msg.createdAt, msg.conversationId]
  );
  
  return msg;
}

export async function pgUpdateConversationStatus(id: string, status: 'open' | 'pending' | 'closed', rating?: number): Promise<Conversation | null> {
  const params: any[] = [status];
  let queryStr = 'UPDATE conversations SET status = $1';
  if (rating !== undefined) {
    params.push(rating);
    queryStr += `, csat_score = $${params.length}`;
  }
  params.push(id);
  queryStr += ` WHERE id = $${params.length} RETURNING *`;

  const { rows } = await query(queryStr, params);
  if (rows.length === 0) return null;
  const c = rows[0];
  return {
    id: c.id,
    orgId: c.org_id,
    customerId: c.customer_id,
    assignedAgentId: c.assigned_agent_id,
    status: c.status,
    channel: c.channel,
    priority: c.priority,
    tags: JSON.parse(c.tags || '[]'),
    createdAt: c.created_at?.toISOString() || c.created_at,
    lastMessageAt: c.last_message_at?.toISOString() || c.last_message_at,
    slaBreachTime: c.sla_breach_time?.toISOString() || c.sla_breach_time,
    csatScore: c.csat_score,
    summary: c.summary,
    problemDescription: c.problem_description,
    resolutionNotes: c.resolution_notes
  };
}

export async function pgAssignConversation(id: string, agentId: string | null): Promise<Conversation | null> {
  const { rows } = await query(
    'UPDATE conversations SET assigned_agent_id = $1 WHERE id = $2 RETURNING *',
    [agentId, id]
  );
  if (rows.length === 0) return null;
  const c = rows[0];
  return {
    id: c.id,
    orgId: c.org_id,
    customerId: c.customer_id,
    assignedAgentId: c.assigned_agent_id,
    status: c.status,
    channel: c.channel,
    priority: c.priority,
    tags: JSON.parse(c.tags || '[]'),
    createdAt: c.created_at?.toISOString() || c.created_at,
    lastMessageAt: c.last_message_at?.toISOString() || c.last_message_at,
    slaBreachTime: c.sla_breach_time?.toISOString() || c.sla_breach_time,
    csatScore: c.csat_score,
    summary: c.summary,
    problemDescription: c.problem_description,
    resolutionNotes: c.resolution_notes
  };
}

export async function pgGetSettings(orgId: string): Promise<SupportSettings> {
  const { rows } = await query('SELECT * FROM settings WHERE org_id = $1', [orgId]);
  if (rows.length === 0) {
    const defaultSettings: SupportSettings = {
      orgId,
      slaConfig: { low: 1440, medium: 480, high: 120, urgent: 60 },
      businessHours: { enabled: false, start: '09:00', end: '17:00', timezone: 'UTC' },
      routingRule: 'round-robin',
      apiKeys: []
    };
    await query(
      `INSERT INTO settings (org_id, sla_config, business_hours, routing_rule, api_keys) 
       VALUES ($1, $2, $3, $4, $5)`,
      [orgId, JSON.stringify(defaultSettings.slaConfig), JSON.stringify(defaultSettings.businessHours), defaultSettings.routingRule, JSON.stringify([])]
    );
    return defaultSettings;
  }
  const s = rows[0];
  return {
    orgId: s.org_id,
    slaConfig: JSON.parse(s.sla_config || '{}'),
    businessHours: JSON.parse(s.business_hours || '{}'),
    routingRule: s.routing_rule,
    apiKeys: JSON.parse(s.api_keys || '[]')
  };
}

export async function pgUpdateSettings(orgId: string, updates: Partial<SupportSettings>): Promise<SupportSettings> {
  const current = await pgGetSettings(orgId);
  const merged = { ...current, ...updates };
  await query(
    `INSERT INTO settings (org_id, sla_config, business_hours, routing_rule, api_keys) 
     VALUES ($1, $2, $3, $4, $5) 
     ON CONFLICT (org_id) DO UPDATE SET sla_config = EXCLUDED.sla_config, 
     business_hours = EXCLUDED.business_hours, routing_rule = EXCLUDED.routing_rule,
     api_keys = EXCLUDED.api_keys`,
    [orgId, JSON.stringify(merged.slaConfig), JSON.stringify(merged.businessHours), merged.routingRule, JSON.stringify(merged.apiKeys || [])]
  );
  return merged;
}

// Delete propagation: pgSaveDb only upserts, so explicit deletes must be issued
// from the JSON-cache delete paths to keep PG in sync.
export async function pgDeleteConversation(id: string): Promise<void> {
  await query('DELETE FROM messages WHERE conversation_id = $1', [id]);
  await query('DELETE FROM ai_suggestions_logs WHERE conversation_id = $1', [id]);
  await query('DELETE FROM conversations WHERE id = $1', [id]);
}

export async function pgDeleteConversations(ids: string[]): Promise<void> {
  for (const id of ids) {
    await pgDeleteConversation(id);
  }
}

export async function pgDeleteCustomers(ids: string[]): Promise<void> {
  for (const id of ids) {
    await query('DELETE FROM customers WHERE id = $1', [id]);
  }
}

export async function pgDeleteKbArticle(id: string): Promise<void> {
  await query('DELETE FROM kb_articles WHERE id = $1', [id]);
}
