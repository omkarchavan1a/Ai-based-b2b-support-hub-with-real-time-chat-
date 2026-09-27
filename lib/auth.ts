/**
 * Auth helpers (ported from Express server).
 * Must only run in the Node.js runtime (`export const runtime = 'nodejs'`).
 */
import crypto from 'node:crypto';

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const verifyHash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
  } catch {
    return false;
  }
}

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.trim() === '' || secret === 'fallback-super-secret-key-12345') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET must be set to a strong random value in production.');
    }
    console.warn('WARNING: SESSION_SECRET is not set. Using insecure dev-only fallback.');
    return 'dev-only-insecure-fallback-secret-change-me';
  }
  if (secret.length < 32) {
    console.warn('WARNING: SESSION_SECRET should be at least 32 characters.');
  }
  return secret;
}

export function generateToken(payload: { userId: string; orgId: string }): string {
  const secret = getSessionSecret();
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 24 * 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): { userId: string; orgId: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const secret = getSessionSecret();
    const expectedSignature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp < Date.now()) return null;
    return { userId: payload.userId, orgId: payload.orgId };
  } catch {
    return null;
  }
}

export function signCustomerTicket(customerId: string, conversationId: string): string {
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(`${customerId}.${conversationId}`).digest('base64url');
  return Buffer.from(`${customerId}.${conversationId}.${sig}`).toString('base64url');
}

export function verifyCustomerTicket(ticket: string): { customerId: string; conversationId: string } | null {
  try {
    const decoded = Buffer.from(ticket, 'base64url').toString('utf8');
    const [customerId, conversationId, sig] = decoded.split('.');
    if (!customerId || !conversationId || !sig) return null;
    const expected = crypto.createHmac('sha256', getSessionSecret()).update(`${customerId}.${conversationId}`).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return { customerId, conversationId };
  } catch {
    return null;
  }
}

// --- Rate limiting & lockout (best-effort per instance on serverless) ---
interface LoginTracker {
  failedAttempts: number;
  lastAttemptAt: number;
  lockoutUntil: number;
}

const ipTrackers = new Map<string, { requests: number[]; blockUntil: number }>();
const accountTrackers = new Map<string, LoginTracker>();
const publicTrackers = new Map<string, { requests: number[]; blockUntil: number }>();

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded && forwarded.length > 0) {
    return forwarded.split(',')[0].trim() || '127.0.0.1';
  }
  return '127.0.0.1';
}

function slidingWindow(
  store: Map<string, { requests: number[]; blockUntil: number }>,
  key: string,
  max: number,
  windowMs: number,
): { allowed: boolean; remainingMs?: number } {
  const now = Date.now();
  let tracker = store.get(key);
  if (!tracker) {
    tracker = { requests: [], blockUntil: 0 };
    store.set(key, tracker);
  }
  if (tracker.blockUntil > now) {
    return { allowed: false, remainingMs: tracker.blockUntil - now };
  }
  tracker.requests = tracker.requests.filter((t) => now - t < windowMs);
  if (tracker.requests.length >= max) {
    tracker.blockUntil = now + windowMs;
    return { allowed: false, remainingMs: windowMs };
  }
  tracker.requests.push(now);
  return { allowed: true };
}

export function checkPublicRateLimit(key: string, max = 60, windowMs = 60000) {
  return slidingWindow(publicTrackers, key, max, windowMs);
}

export function checkRateLimit(ip: string) {
  return slidingWindow(ipTrackers, ip, 10, 60000);
}

export function getAccountLockout(email: string): { locked: boolean; remainingMs?: number; failedAttempts: number } {
  const now = Date.now();
  const tracker = accountTrackers.get(email.trim().toLowerCase());
  if (!tracker) return { locked: false, failedAttempts: 0 };
  if (tracker.lockoutUntil > now) {
    return { locked: true, remainingMs: tracker.lockoutUntil - now, failedAttempts: tracker.failedAttempts };
  }
  return { locked: false, failedAttempts: tracker.failedAttempts };
}

export function recordFailedAttempt(email: string) {
  const now = Date.now();
  const key = email.trim().toLowerCase();
  let tracker = accountTrackers.get(key);
  if (!tracker) {
    tracker = { failedAttempts: 0, lastAttemptAt: 0, lockoutUntil: 0 };
    accountTrackers.set(key, tracker);
  }
  tracker.failedAttempts += 1;
  tracker.lastAttemptAt = now;
  if (tracker.failedAttempts >= 5) {
    tracker.lockoutUntil = now + 15 * 60 * 1000;
  }
}

export function resetFailedAttempts(email: string) {
  accountTrackers.delete(email.trim().toLowerCase());
}

export function getProgressiveDelay(failedAttempts: number): number {
  if (failedAttempts === 0) return 0;
  const delays = [0, 1000, 2000, 5000, 15000, 30000];
  // Cap for serverless functions (Vercel hobby limit is ~10s)
  return Math.min(delays[Math.min(failedAttempts, delays.length - 1)], 8000);
}

const DUMMY_SALT = crypto.randomBytes(16).toString('hex');

export function performDummyVerification() {
  crypto.scryptSync('dummy_password_xyz', DUMMY_SALT, 64, { N: 16384, r: 8, p: 1 });
}
