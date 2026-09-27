import { json, err } from '@/lib/api';
import { getUserByEmail, createOrgWithOwner } from '@/lib/db';
import { hashPassword, generateToken } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { email, password, name, companyName, avatarUrl } = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return err('Invalid email address format.', 400);
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return err('Password must be at least 8 characters long.', 400);
    }
    if (password.length > 128) {
      return err('Password must not exceed 128 characters.', 400);
    }
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[@$!%*?&]/.test(password);
    if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
      return err('Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character (@$!%*?&).', 400);
    }
    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 50) {
      return err('Name must be between 2 and 50 characters.', 400);
    }
    if (!companyName || typeof companyName !== 'string' || companyName.trim().length < 2 || companyName.trim().length > 50) {
      return err('Company name must be between 2 and 50 characters.', 400);
    }

    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedName = name.trim().replace(/[<>]/g, '');
    const sanitizedCompany = companyName.trim().replace(/[<>]/g, '');

    if (await getUserByEmail(sanitizedEmail)) {
      return err('This email address is already registered.', 400);
    }

    const orgId = `org_${Date.now()}`;
    const newOrg = { id: orgId, name: sanitizedCompany, createdAt: new Date().toISOString() };
    const { hash, salt } = hashPassword(password);
    const userId = `usr_${Date.now()}`;
    const newUser = {
      id: userId, orgId, role: 'owner' as const, email: sanitizedEmail, name: sanitizedName,
      avatarUrl: avatarUrl && typeof avatarUrl === 'string' ? avatarUrl : `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 1000000)}?w=150&h=150&fit=crop&crop=faces`,
      status: 'online' as const, passwordHash: hash, passwordSalt: salt,
    };

    await createOrgWithOwner(newOrg, newUser, {
      orgId,
      slaConfig: { low: 1440, medium: 480, high: 120, urgent: 60 },
      businessHours: { enabled: false, start: '09:00', end: '17:00', timezone: 'UTC' },
      routingRule: 'round-robin',
      apiKeys: [],
    });

    const token = generateToken({ userId, orgId });
    const { passwordHash: _h, passwordSalt: _s, ...userResponse } = newUser;
    return json({ token, user: userResponse, org: newOrg }, 201);
  } catch (e: any) {
    console.error('Signup error:', e);
    const detail = process.env.NODE_ENV === 'production' ? '' : ` (${e?.message ?? e})`;
    return err(`An unexpected database error occurred${detail}. Check /api/db-status for diagnostics.`, 500);
  }
}
