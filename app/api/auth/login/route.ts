import { json, err } from '@/lib/api';
import { getUserByEmail } from '@/lib/db';
import {
  getClientIp, checkRateLimit, getAccountLockout, recordFailedAttempt,
  resetFailedAttempts, getProgressiveDelay, performDummyVerification,
  verifyPassword, generateToken,
} from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req.headers);
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return err(`Too many login attempts from this IP address. Please try again in ${Math.ceil((rateCheck.remainingMs || 60000) / 1000)} seconds.`, 429);
    }

    const { email, password } = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return err('Incorrect email or password.', 400);
    }
    const sanitizedEmail = email.trim().toLowerCase();
    const lockout = getAccountLockout(sanitizedEmail);
    if (lockout.locked) {
      return err(`This account has been temporarily locked due to 5 consecutive failed login attempts. Please try again in ${Math.ceil((lockout.remainingMs || 900000) / 1000 / 60)} minutes.`, 423);
    }

    const user = await getUserByEmail(sanitizedEmail);
    const delayMs = getProgressiveDelay(lockout.failedAttempts);
    if (!user || !user.passwordHash || !user.passwordSalt) {
      performDummyVerification();
      recordFailedAttempt(sanitizedEmail);
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      return err('Incorrect email or password.', 401);
    }

    const isPasswordCorrect = verifyPassword(password, user.passwordHash, user.passwordSalt);
    if (!isPasswordCorrect) {
      recordFailedAttempt(sanitizedEmail);
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      return err('Incorrect email or password.', 401);
    }

    resetFailedAttempts(sanitizedEmail);
    const token = generateToken({ userId: user.id, orgId: user.orgId });
    const { passwordHash: _h, passwordSalt: _s, ...userResponse } = user;
    const { getOrgById } = await import('@/lib/db');
    const org = await getOrgById(user.orgId);
    return json({ token, user: userResponse, org });
  } catch (e: any) {
    console.error('Login error:', e);
    const detail = process.env.NODE_ENV === 'production' ? '' : ` (${e?.message ?? e})`;
    return err(`An unexpected database error occurred${detail}. Check /api/db-status for diagnostics.`, 500);
  }
}
