import { json, requireAuth, isAuthError } from '@/lib/api';
import { upsertCustomer, createConversation, saveMessage, nid } from '@/lib/db';
import type { Conversation, Message } from '@/src/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SIMULATED_PROFILES = [
  {
    name: 'Enterprise Partner', email: 'client@enterprise.io', companyName: 'Enterprise SaaS Corp',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=faces',
    phone: '+1 (202) 555-0143', location: 'Washington, DC (IP: 108.162.21.7)',
    browserInfo: 'Firefox Developer Edition 127.0 on macOS Sonoma',
    notes: 'Enterprise account. Working on critical systems migration.',
    problems: [{ text: 'Hello, we are seeing random 502 Bad Gateway errors when uploading large binary files (around 45MB) to your `/api/v2/deploy` endpoint. Is there a payload limit or connection timeout on your load balancer?', priority: 'high', tags: ['api', 'network'] }],
  },
  {
    name: 'Business Partner', email: 'contact@partner-labs.com', companyName: 'Bell Labs Support',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=faces',
    phone: '+1 (908) 555-0176', location: 'Murray Hill, NJ (IP: 198.51.100.82)',
    browserInfo: 'Safari 17.5 on macOS', notes: 'Technical partner. Custom database schema exporter integration.',
    problems: [{ text: 'Hi there, we need to export our database schemas in Drizzle or standard SQL. Is there an automated tool in the Settings panel, or do we have to pull them via the REST admin API?', priority: 'medium', tags: ['database', 'export'] }],
  },
  {
    name: 'System Integrator', email: 'integrations@analytical-engine.org', companyName: 'Analytical Systems',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=faces',
    phone: '+1 (718) 555-0111', location: 'London, UK (IP: 82.165.101.44)',
    browserInfo: 'Chrome 126.0 on Windows 11', notes: 'SAML SSO integration architect.',
    problems: [{ text: 'URGENT: Our team SAML SSO login is failing for all users with "Signature verification failed". We updated our Okta certificate this morning. Where can we paste our new X.509 public certificate?', priority: 'urgent', tags: ['sso', 'security'] }],
  },
  {
    name: 'SaaS Developer', email: 'dev@kernel-systems.org', companyName: 'Kernel Corp',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=faces',
    phone: '+1 (503) 555-0129', location: 'Portland, OR (IP: 50.116.32.9)',
    browserInfo: 'Linux x86_64, Chromium 125.0', notes: 'SaaS integrator. Direct and values rapid resolutions.',
    problems: [{ text: 'Can we configure multiple webhook destination URLs for the same event type? Right now, when a seat is assigned, we want to notify both our Slack bridge and our internal telemetry microservice.', priority: 'low', tags: ['webhooks', 'integration'] }],
  },
  {
    name: 'Technical Contact', email: 'support-liaison@python.org', companyName: 'Python Systems',
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop&crop=faces',
    phone: '+1 (408) 555-0158', location: 'Silicon Valley, CA (IP: 172.56.33.20)',
    browserInfo: 'Chrome 125.0 on macOS', notes: 'Loves clean architecture, simple integration scripts.',
    problems: [{ text: 'Hi support team, is there a rate-limiting policy on the search endpoint? We are getting sporadic 429 status codes during our high-concurrency CI/CD pipeline runs.', priority: 'medium', tags: ['api', 'limits'] }],
  },
  {
    name: 'Operations Manager', email: 'operations@apollo-guidance.gov', companyName: 'NASA AGC',
    avatarUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&h=150&fit=crop&crop=faces',
    phone: '+1 (617) 555-0182', location: 'Boston, MA (IP: 18.9.22.1)',
    browserInfo: 'Chrome 126.0 on macOS', notes: 'Operations specialist managing account-level billing structure.',
    problems: [{ text: 'Our analytics dashboard is showing a discrepancy between seat usage and the billing invoice total. It lists 14 active seats but we were charged for 18. Can someone audit our account records?', priority: 'high', tags: ['billing', 'audit'] }],
  },
];

export async function POST(req: Request) {
  const auth = requireAuth(req);
  if (isAuthError(auth)) return auth;
  const orgId = auth.orgId;
  const randomProfile = SIMULATED_PROFILES[Math.floor(Math.random() * SIMULATED_PROFILES.length)];
  const randomProblem = randomProfile.problems[Math.floor(Math.random() * randomProfile.problems.length)];

  const customerId = nid('cust_sim');
  const customer = {
    id: customerId, orgId, name: randomProfile.name, email: randomProfile.email,
    companyName: randomProfile.companyName, avatarUrl: randomProfile.avatarUrl,
    createdAt: new Date().toISOString(), phone: randomProfile.phone,
    location: randomProfile.location, browserInfo: randomProfile.browserInfo, notes: randomProfile.notes,
  };
  await upsertCustomer(customer);

  const convId = nid('conv_sim');
  const newConv: Conversation = {
    id: convId, orgId, customerId, assignedAgentId: null, status: 'open', channel: 'widget',
    priority: randomProblem.priority as 'low' | 'medium' | 'high' | 'urgent', tags: randomProblem.tags,
    createdAt: new Date().toISOString(), lastMessageAt: new Date().toISOString(),
    slaBreachTime: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
    problemDescription: randomProblem.text, resolutionNotes: '',
  };
  await createConversation(newConv);

  const userMsg: Message = {
    id: nid('msg_sim_u'), conversationId: convId, senderType: 'customer', senderId: customerId,
    senderName: randomProfile.name, content: randomProblem.text, readAt: null, createdAt: new Date().toISOString(),
  };
  await saveMessage(userMsg);
  const sysMsg: Message = {
    id: nid('msg_sim_s'), conversationId: convId, senderType: 'system', senderId: 'system',
    senderName: 'System Bot',
    content: 'Thank you for reaching out! Your ticket has been received and added to our support queue. A support engineer will review and respond shortly.',
    readAt: null, createdAt: new Date(Date.now() + 10).toISOString(),
  };
  await saveMessage(sysMsg);

  return json({ success: true, conversation: { ...newConv, isCustomerOnline: false }, customer, messages: [userMsg, sysMsg] });
}
