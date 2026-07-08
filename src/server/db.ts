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
      name: 'Sarah Connor',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop&crop=faces',
      status: 'online'
    },
    {
      id: 'usr_john',
      orgId: 'org_stellar',
      role: 'agent',
      email: 'stellar-john@b2bhub.ai',
      name: 'John Doe',
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
  customers: [
    {
      id: 'cust_alice',
      orgId: 'org_stellar',
      email: 'alice@tesla.com',
      name: 'Alice Smith',
      companyName: 'Tesla Corp',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=faces',
      createdAt: new Date('2026-02-01T08:00:00Z').toISOString(),
      phone: '+1 (510) 555-0192',
      location: 'Palo Alto, CA (IP: 204.14.12.8)',
      browserInfo: 'Chrome 125.0 on macOS Sonoma',
      notes: 'Key stakeholder for the Tesla Integration pilot project. Frequently inquires about SAML SSO setup and webhooks SLA. Very technical customer.'
    },
    {
      id: 'cust_bob',
      orgId: 'org_stellar',
      email: 'bob@stripe.com',
      name: 'Bob Miller',
      companyName: 'Stripe Inc',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=faces',
      createdAt: new Date('2026-02-05T09:30:00Z').toISOString(),
      phone: '+1 (650) 412-3301',
      location: 'San Francisco, CA (IP: 198.51.100.42)',
      browserInfo: 'Safari 17.4 on iOS 17.4.1',
      notes: 'Testing billing endpoints. Usually friendly but in a rush. Preferred communication channel is live widget chat.'
    },
    {
      id: 'cust_charlie',
      orgId: 'org_stellar',
      email: 'charlie@netflix.com',
      name: 'Charlie Brown',
      companyName: 'Netflix',
      avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&h=150&fit=crop&crop=faces',
      createdAt: new Date('2026-02-10T11:15:00Z').toISOString(),
      phone: '+1 (408) 555-0147',
      location: 'Los Gatos, CA (IP: 172.56.21.99)',
      browserInfo: 'Firefox 126.0 on Windows 11',
      notes: 'Technical lead for Netflix payments API webhook configurations. High SLA priority.'
    }
  ],
  conversations: [
    {
      id: 'conv_1',
      orgId: 'org_stellar',
      customerId: 'cust_alice',
      assignedAgentId: 'usr_john',
      status: 'open',
      channel: 'widget',
      priority: 'urgent',
      tags: ['sso', 'saml', 'production'],
      createdAt: new Date('2026-07-07T08:30:00Z').toISOString(),
      lastMessageAt: new Date('2026-07-07T09:15:00Z').toISOString(),
      slaBreachTime: new Date('2026-07-07T09:30:00Z').toISOString() // Urgent SLA is 1 hour
    },
    {
      id: 'conv_2',
      orgId: 'org_stellar',
      customerId: 'cust_bob',
      assignedAgentId: null,
      status: 'open',
      channel: 'widget',
      priority: 'high',
      tags: ['billing', 'invoice'],
      createdAt: new Date('2026-07-07T09:00:00Z').toISOString(),
      lastMessageAt: new Date('2026-07-07T09:05:00Z').toISOString(),
      slaBreachTime: new Date('2026-07-07T11:00:00Z').toISOString() // High SLA is 2 hours
    },
    {
      id: 'conv_3',
      orgId: 'org_stellar',
      customerId: 'cust_charlie',
      assignedAgentId: 'usr_sarah',
      status: 'closed',
      channel: 'widget',
      priority: 'medium',
      tags: ['api', 'webhooks'],
      createdAt: new Date('2026-07-06T14:00:00Z').toISOString(),
      lastMessageAt: new Date('2026-07-06T15:20:00Z').toISOString(),
      csatScore: 5,
      summary: 'Customer wanted to know the webhook payload schema for payments. Agent provided documentation link and a sample payload. Customer verified it worked and closed the ticket.'
    }
  ],
  messages: [
    // Conversation 1: SAML SSO Error (Open)
    {
      id: 'msg_1_1',
      conversationId: 'conv_1',
      senderType: 'customer',
      senderId: 'cust_alice',
      senderName: 'Alice Smith',
      content: 'Hello, we are attempting to go live with SAML SSO today but our users are getting "InResponseTo field does not match" errors. This is blocking our release.',
      readAt: new Date('2026-07-07T08:31:00Z').toISOString(),
      createdAt: new Date('2026-07-07T08:30:00Z').toISOString()
    },
    {
      id: 'msg_1_2',
      conversationId: 'conv_1',
      senderType: 'agent',
      senderId: 'usr_john',
      senderName: 'John Doe',
      content: 'Hi Alice! Let me look into that for you. That error typically occurs when the SSO token request expires or there is a server clock skew mismatch between our servers and your Identity Provider (IdP). Which IdP are you using?',
      readAt: new Date('2026-07-07T08:36:00Z').toISOString(),
      createdAt: new Date('2026-07-07T08:35:00Z').toISOString()
    },
    {
      id: 'msg_1_3',
      conversationId: 'conv_1',
      senderType: 'customer',
      senderId: 'cust_alice',
      senderName: 'Alice Smith',
      content: 'We are using Okta. I checked our IdP logs and it says the assertion is sent correctly. Can you verify if you accept clock skews up to 5 minutes?',
      readAt: new Date('2026-07-07T09:16:00Z').toISOString(),
      createdAt: new Date('2026-07-07T09:15:00Z').toISOString()
    },

    // Conversation 2: Billing issue (Open/Unassigned)
    {
      id: 'msg_2_1',
      conversationId: 'conv_2',
      senderType: 'customer',
      senderId: 'cust_bob',
      senderName: 'Bob Miller',
      content: 'Hi, we received an invoice that contains charges for 12 unused seats. We deleted those users last month. Can we get this credited?',
      readAt: null,
      createdAt: new Date('2026-07-07T09:00:00Z').toISOString()
    },
    {
      id: 'msg_2_2',
      conversationId: 'conv_2',
      senderType: 'system',
      senderId: 'system',
      senderName: 'System Bot',
      content: 'Thank you for reaching out! Your ticket has been received and added to our billing queue. A support engineer will review and credit eligible unused seats shortly.',
      readAt: null,
      createdAt: new Date('2026-07-07T09:05:00Z').toISOString()
    },

    // Conversation 3: API webhook (Closed)
    {
      id: 'msg_3_1',
      conversationId: 'conv_3',
      senderType: 'customer',
      senderId: 'cust_charlie',
      senderName: 'Charlie Brown',
      content: 'Where can I find the webhook payload JSON schema for the payment.succeeded event?',
      readAt: new Date('2026-07-06T14:02:00Z').toISOString(),
      createdAt: new Date('2026-07-06T14:00:00Z').toISOString()
    },
    {
      id: 'msg_3_2',
      conversationId: 'conv_3',
      senderType: 'agent',
      senderId: 'usr_sarah',
      senderName: 'Sarah Connor',
      content: 'Hi Charlie! You can access the complete JSON schema for all webhook events under Settings > Webhooks > Developer Specs in your dashboard. Here is a direct link: https://docs.stellarb2b.com/api/webhooks',
      readAt: new Date('2026-07-06T14:12:00Z').toISOString(),
      createdAt: new Date('2026-07-06T14:10:00Z').toISOString()
    },
    {
      id: 'msg_3_3',
      conversationId: 'conv_3',
      senderType: 'customer',
      senderId: 'cust_charlie',
      senderName: 'Charlie Brown',
      content: 'Awesome, that is exactly what I was looking for. Perfect response. I will close this ticket now.',
      readAt: new Date('2026-07-06T15:20:00Z').toISOString(),
      createdAt: new Date('2026-07-06T15:18:00Z').toISOString()
    },
    {
      id: 'msg_3_4',
      conversationId: 'conv_3',
      senderType: 'system',
      senderId: 'system',
      senderName: 'System Bot',
      content: 'This conversation was marked as closed. Rate your support experience below.',
      readAt: new Date('2026-07-06T15:21:00Z').toISOString(),
      createdAt: new Date('2026-07-06T15:20:00Z').toISOString()
    }
  ],
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

// Initialize DB file
export function initDb() {
  if (isPgActive()) {
    // If PG is active, initialization is handled in initPgDb asynchronously at startup.
    return;
  }
  getDbLocal();
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
