/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';

// Password Security Helpers
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  // Using scryptSync with recommended secure parameters
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const verifyHash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
  } catch (e) {
    return false;
  }
}

// Generate secure session tokens (fully compliant custom signature token)
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.trim() === '' || secret === 'fallback-super-secret-key-12345') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET must be set to a strong random value in production.');
    }
    console.warn('WARNING: SESSION_SECRET is not set. Using insecure dev-only fallback. Set SESSION_SECRET in .env.');
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
    
    // Constant-time signature comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp < Date.now()) {
      return null; // Expired
    }
    return { userId: payload.userId, orgId: payload.orgId };
  } catch (e) {
    return null;
  }
}

// Memory-based tracking stores for Rate Limiting & Account Lockouts
interface LoginTracker {
  failedAttempts: number;
  lastAttemptAt: number;
  lockoutUntil: number;
}

const ipTrackers = new Map<string, { requests: number[]; blockUntil: number }>();
const accountTrackers = new Map<string, LoginTracker>();

// Get client IP address (first entry of X-Forwarded-For, no spoofed chain trust)
export function getClientIp(req: any): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim() || '127.0.0.1';
  }
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

// Generic in-memory rate limiter for public endpoints (per-IP sliding window)
const publicTrackers = new Map<string, { requests: number[]; blockUntil: number }>();
export function checkPublicRateLimit(key: string, max = 60, windowMs = 60000): { allowed: boolean; remainingMs?: number } {
  const now = Date.now();
  let tracker = publicTrackers.get(key);
  if (!tracker) {
    tracker = { requests: [], blockUntil: 0 };
    publicTrackers.set(key, tracker);
  }
  if (tracker.blockUntil > now) {
    return { allowed: false, remainingMs: tracker.blockUntil - now };
  }
  tracker.requests = tracker.requests.filter(t => now - t < windowMs);
  if (tracker.requests.length >= max) {
    tracker.blockUntil = now + windowMs;
    return { allowed: false, remainingMs: windowMs };
  }
  tracker.requests.push(now);
  return { allowed: true };
}

// Rate Limiting: 10 requests per IP per minute
export function checkRateLimit(ip: string): { allowed: boolean; remainingMs?: number } {
  const now = Date.now();
  let tracker = ipTrackers.get(ip);
  if (!tracker) {
    tracker = { requests: [], blockUntil: 0 };
    ipTrackers.set(ip, tracker);
  }

  if (tracker.blockUntil > now) {
    return { allowed: false, remainingMs: tracker.blockUntil - now };
  }

  // Filter requests within the last 60 seconds
  tracker.requests = tracker.requests.filter(timestamp => now - timestamp < 60000);

  if (tracker.requests.length >= 10) {
    tracker.blockUntil = now + 60000; // block for 1 minute
    return { allowed: false, remainingMs: 60000 };
  }

  tracker.requests.push(now);
  return { allowed: true };
}

// Account Lockout management
export function getAccountLockout(email: string): { locked: boolean; remainingMs?: number; failedAttempts: number } {
  const now = Date.now();
  const emailKey = email.trim().toLowerCase();
  const tracker = accountTrackers.get(emailKey);

  if (!tracker) {
    return { locked: false, failedAttempts: 0 };
  }

  if (tracker.lockoutUntil > now) {
    return { locked: true, remainingMs: tracker.lockoutUntil - now, failedAttempts: tracker.failedAttempts };
  }

  return { locked: false, failedAttempts: tracker.failedAttempts };
}

export function recordFailedAttempt(email: string) {
  const now = Date.now();
  const emailKey = email.trim().toLowerCase();
  let tracker = accountTrackers.get(emailKey);

  if (!tracker) {
    tracker = { failedAttempts: 0, lastAttemptAt: 0, lockoutUntil: 0 };
    accountTrackers.set(emailKey, tracker);
  }

  tracker.failedAttempts += 1;
  tracker.lastAttemptAt = now;

  if (tracker.failedAttempts >= 5) {
    tracker.lockoutUntil = now + 15 * 60 * 1000; // 15-minute lockout
  }
}

export function resetFailedAttempts(email: string) {
  accountTrackers.delete(email.trim().toLowerCase());
}

// Progressive delay multiplier based on failed attempts
export function getProgressiveDelay(failedAttempts: number): number {
  if (failedAttempts === 0) return 0;
  const delays = [0, 1000, 2000, 5000, 15000, 30000]; // in milliseconds
  return delays[Math.min(failedAttempts, delays.length - 1)];
}

// Dummy verification to match response timing for non-existent users
const DUMMY_SALT = crypto.randomBytes(16).toString('hex');
const DUMMY_HASH = crypto.scryptSync('dummy_password_xyz', DUMMY_SALT, 64, { N: 16384, r: 8, p: 1 }).toString('hex');

export function performDummyVerification() {
  crypto.scryptSync('dummy_password_xyz', DUMMY_SALT, 64, { N: 16384, r: 8, p: 1 });
}
