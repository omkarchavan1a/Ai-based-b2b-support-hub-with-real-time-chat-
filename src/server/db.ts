/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { 
  Organization, User, Customer, Conversation, Message, 
  KBArticle, AISuggestionLog, SupportSettings 
} from '../types';
import { hashPassword } from './auth';
import { 
  isPgActive, initPgSchema, pgGetDb, pgSaveDb, 
  pgSaveMessage, pgUpdateConversationStatus, pgAssignConversation, 
  pgUpdateSettings 
} from './postgres';

const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

interface Schema {
  organizations: Organization[];
  users: User[];
  customers: Customer[];
  conversations: Conversation[];
  messages: Message[];
  kbArticles: KBArticle[];
  aiSuggestionsLogs: AISuggestionLog[];
  settings: SupportSettings[];
}

const DEFAULT_DB: Schema = {
  organizations: [
    { id: 'org_stellar', name: 'Stellar B2B SaaS', createdAt: new Date('2026-01-01').toISOString() },
    { id: 'org_horizon', name: 'Horizon Commerce', createdAt: new Date('2026-01-15').toISOString() }
  ],
  users: [
    {
      id: 'usr_sarah',
      orgId: 'org_stellar',
      role: 'owner',
      email: 'stellar-admin@b2bhub.ai',
      name: 'Workspace Owner',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop&crop=faces',
      status: 'online'
    },
    {
      id: 'usr_john',
      orgId: 'org_stellar',
      role: 'agent',
      email: 'stellar-john@b2bhub.ai',
      name: 'Support Specialist',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=faces',
      status: 'online'
    },
    {
      id: 'usr_omkar',
      orgId: 'org_stellar',
      role: 'agent',
      email: 'omkar@b2bhub.ai',
      name: 'Omkar Chavan',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=faces',
      status: 'busy'
    }
  ],
  customers: [],
  conversations: [],
  messages: [],
  kbArticles: [
    {
      id: 'kb_1',
      orgId: 'org_stellar',
      title: 'SAML Single Sign-On (SSO) Setup Guide',
      category: 'Security',
      content: '### SAML SSO Integration\n\nStellar B2B supports SAML 2.0 Identity Providers (IdP) including Okta, Azure AD, and OneLogin.\n\n#### Typical Issues:\n1. **InResponseTo field does not match error**:\n   This occurs when the authentication request has expired, or when a user tries to reuse a stale bookmark. Check if your IdP clock skew is under 5 minutes.\n2. **Signature Verification Failed**:\n   Ensure that you have uploaded the correct x509 public signing certificate from Okta/Azure into your Stellar dashboard.\n\n#### Configuration values:\n- **ACS (Assertion Consumer Service) URL**: `https://api.stellarb2b.com/sso/saml/acs`\n- **Entity ID**: `https://api.stellarb2b.com/sso/saml/metadata`\n- **NameID Format**: `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress`',
      createdAt: new Date('2026-01-10').toISOString(),
      updatedAt: new Date('2026-01-10').toISOString()
    },
    {
      id: 'kb_2',
      orgId: 'org_stellar',
      title: 'Billing Policies & Pro-rated Credits',
      category: 'Billing',
      content: '### Seats & Proration Policies\n\nOur subscription is charged per-seat per-month. \n\n#### Adding Seats:\nWhen you add a new team member, we charge a pro-rated amount for the remainder of the current billing cycle.\n\n#### Deleting Seats:\nWhen you delete a user, the seat remains active until the end of the current billing cycle. However, if you explicitly cancel a seat and want a credit, our policy allows support agents to apply a **Credit Balance** to your account if the seat was empty and unused for more than 15 days of the cycle.\n\nTo apply a refund or credit, go to the agent refund console under customer profiles.',
      createdAt: new Date('2026-01-12').toISOString(),
      updatedAt: new Date('2026-01-12').toISOString()
    },
    {
      id: 'kb_3',
      orgId: 'org_stellar',
      title: 'API Webhook Event Payloads & Signatures',
      category: 'Technical',
      content: '### Webhook Deliveries\n\nWebhooks are dispatched as HTTPS POST payloads containing a JSON payload.\n\n#### Event Schema Example (`payment.succeeded`):\n```json\n{\n  "event": "payment.succeeded",\n  "created": 1783456000,\n  "data": {\n    "amount": 25000,\n    "currency": "usd",\n    "customer": "cust_bob",\n    "invoiceId": "inv_908123"\n  }\n}\n```\n\n#### Verification:\nWe sign all webhook payloads. Each request contains a Header `X-Stellar-Signature` which is a HMAC-SHA256 signature calculated using your webhook secret key.',
      createdAt: new Date('2026-01-15').toISOString(),
      updatedAt: new Date('2026-01-15').toISOString()
    },
    {
      id: 'kb_4',
      orgId: 'org_stellar',
      title: 'Custom Domain SSL Configuration',
      category: 'Technical',
      content: '### Custom White-Label Domains\n\nTo host your support hub on a custom subdomain like `support.yourcompany.com`:\n\n1. Go to **Settings > Domains**.\n2. Add your custom subdomain.\n3. Create a **CNAME record** with your DNS provider pointing to `ingress.stellarb2b.com`.\n4. We will provision a free Let\'s Encrypt SSL Certificate automatically within 15 minutes of DNS propagation.',
      createdAt: new Date('2026-01-20').toISOString(),
      updatedAt: new Date('2026-01-20').toISOString()
    }
  ],
  aiSuggestionsLogs: [],
  settings: [
    {
      orgId: 'org_stellar',
      slaConfig: {
        low: 1440, // 24 hours
        medium: 480, // 8 hours
        high: 120, // 2 hours
        urgent: 60 // 1 hour
      },
      businessHours: {
        enabled: true,
        start: '09:00',
        end: '18:00',
        timezone: 'UTC'
      },
      routingRule: 'round-robin'
    }
  ]
};

// PostgreSQL in-memory cache for ultra-fast synchronous operations
let pgCache: Schema | null = null;

// Initialize PostgreSQL connection, tables, and seeding
export async function initPgDb() {
  if (!isPgActive()) {
    console.log('PostgreSQL is not configured. Falling back to local JSON file database.');
    return;
  }
  try {
    // Pass local getDb for migration / seeding if Postgres is empty
    await initPgSchema(getDbLocal);
    // Fetch and populate the in-memory cache
    pgCache = await pgGetDb();
    if (pgCache) {
      pgCache.customers = [];
      pgCache.conversations = [];
      pgCache.messages = [];
      await pgSaveDb(pgCache);
    }
    console.log('PostgreSQL connected and cached successfully.');
  } catch (err) {
    console.error('Failed to initialize PostgreSQL Cache, falling back to local database:', err);
  }
}

// Local DB file reader/writer (used as fallback or for PostgreSQL migration)
function getDbLocal(): Schema {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  if (!fs.existsSync(DB_FILE)) {
    DEFAULT_DB.users.forEach(u => {
      if (!u.passwordHash) {
        const { hash, salt } = hashPassword('P@ssword123!');
        u.passwordHash = hash;
        u.passwordSalt = salt;
      }
    });
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
    return DEFAULT_DB;
  } else {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const db = JSON.parse(raw);
      let updated = false;
      db.users.forEach((u: any) => {
        if (!u.passwordHash) {
          const { hash, salt } = hashPassword('P@ssword123!');
          u.passwordHash = hash;
          u.passwordSalt = salt;
          updated = true;
        }
      });
      if (updated) {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
      }
      return db;
    } catch (e) {
      console.error('Error during db initialization or self-healing upgrade:', e);
      return DEFAULT_DB;
    }
  }
}

let hasCleanedOnStartup = false;

// Initialize DB file
export function initDb() {
  if (isPgActive()) {
    // If PG is active, initialization is handled in initPgDb asynchronously at startup.
    return;
  }
  const db = getDbLocal();
  if (!hasCleanedOnStartup) {
    db.customers = [];
    db.conversations = [];
    db.messages = [];
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    hasCleanedOnStartup = true;
    console.log('Database visitor and conversation data cleared for clean startup as requested.');
  }
}

export function getDb(): Schema {
  if (isPgActive() && pgCache) {
    return pgCache;
  }
  initDb();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Error reading db.json, returning defaults', error);
    return DEFAULT_DB;
  }
}

export function saveDb(data: Schema) {
  if (isPgActive()) {
    pgCache = data;
    pgSaveDb(data).catch(err => console.error('Asynchronous pgSaveDb error:', err));
    return;
  }
  initDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Support helpers
export function getConversations(orgId: string): Conversation[] {
  const db = getDb();
  return db.conversations.filter(c => c.orgId === orgId);
}

export function getMessages(conversationId: string): Message[] {
  const db = getDb();
  return db.messages.filter(m => m.conversationId === conversationId).map(m => {
    if (!m.senderAvatarUrl) {
      if (m.senderType === 'agent') {
        const u = db.users.find(usr => usr.id === m.senderId);
        if (u) m.senderAvatarUrl = u.avatarUrl;
      } else if (m.senderType === 'customer') {
        const c = db.customers.find(cust => cust.id === m.senderId);
        if (c) m.senderAvatarUrl = c.avatarUrl;
      } else if (m.senderType === 'ai') {
        m.senderAvatarUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&h=150&fit=crop';
      }
    }
    return m;
  });
}

export function saveMessage(msg: Message): Message {
  const db = getDb();
  
  if (!msg.senderAvatarUrl) {
    if (msg.senderType === 'agent') {
      const u = db.users.find(usr => usr.id === msg.senderId);
      if (u) msg.senderAvatarUrl = u.avatarUrl;
    } else if (msg.senderType === 'customer') {
      const c = db.customers.find(cust => cust.id === msg.senderId);
      if (c) msg.senderAvatarUrl = c.avatarUrl;
    } else if (msg.senderType === 'ai') {
      msg.senderAvatarUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&h=150&fit=crop';
    }
  }

  db.messages.push(msg);
  
  // Update lastMessageAt on conversation
  const convIndex = db.conversations.findIndex(c => c.id === msg.conversationId);
  if (convIndex !== -1) {
    db.conversations[convIndex].lastMessageAt = msg.createdAt;
  }
  
  saveDb(db);
  
  if (isPgActive()) {
    pgSaveMessage(msg).catch(err => console.error('Asynchronous pgSaveMessage error:', err));
  }
  
  return msg;
}

export function updateConversationStatus(id: string, status: 'open' | 'pending' | 'closed', rating?: number): Conversation | null {
  const db = getDb();
  const index = db.conversations.findIndex(c => c.id === id);
  if (index !== -1) {
    db.conversations[index].status = status;
    if (rating !== undefined) {
      db.conversations[index].csatScore = rating;
    }
    saveDb(db);
    
    if (isPgActive()) {
      pgUpdateConversationStatus(id, status, rating).catch(err => console.error('Asynchronous pgUpdateConversationStatus error:', err));
    }
    
    return db.conversations[index];
  }
  return null;
}

export function assignConversation(id: string, agentId: string | null): Conversation | null {
  const db = getDb();
  const index = db.conversations.findIndex(c => c.id === id);
  if (index !== -1) {
    db.conversations[index].assignedAgentId = agentId;
    saveDb(db);
    
    if (isPgActive()) {
      pgAssignConversation(id, agentId).catch(err => console.error('Asynchronous pgAssignConversation error:', err));
    }
    
    return db.conversations[index];
  }
  return null;
}

export function getSettings(orgId: string): SupportSettings {
  const db = getDb();
  let set = db.settings.find(s => s.orgId === orgId);
  if (!set) {
    set = {
      orgId,
      slaConfig: { low: 1440, medium: 480, high: 120, urgent: 60 },
      businessHours: { enabled: false, start: '09:00', end: '17:00', timezone: 'UTC' },
      routingRule: 'round-robin'
    };
    db.settings.push(set);
    saveDb(db);
  }
  return set;
}

export function updateSettings(orgId: string, updates: Partial<SupportSettings>): SupportSettings {
  const db = getDb();
  const index = db.settings.findIndex(s => s.orgId === orgId);
  if (index !== -1) {
    db.settings[index] = { ...db.settings[index], ...updates };
  } else {
    const newSettings: SupportSettings = {
      orgId,
      slaConfig: { low: 1440, medium: 480, high: 120, urgent: 60 },
      businessHours: { enabled: false, start: '09:00', end: '17:00', timezone: 'UTC' },
      routingRule: 'round-robin',
      ...updates
    };
    db.settings.push(newSettings);
  }
  saveDb(db);
  
  if (isPgActive()) {
    pgUpdateSettings(orgId, updates).catch(err => console.error('Asynchronous pgUpdateSettings error:', err));
  }
  
  return getSettings(orgId);
}
