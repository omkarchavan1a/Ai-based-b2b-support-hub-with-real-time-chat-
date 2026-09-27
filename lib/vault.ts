/**
 * AES-256-GCM vault for stored AI provider keys (ported from Express server).
 * Node.js runtime only.
 */
import crypto from 'node:crypto';

function getEncryptionKey(): string {
  const raw = process.env.VAULT_ENC_KEY;
  if (!raw || raw.trim() === '') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('VAULT_ENC_KEY must be set to a 32-byte secret in production.');
    }
    console.warn('WARNING: VAULT_ENC_KEY is not set. Using dev-only fallback.');
    return 'dev-only-insecure-vault-key-32chars!';
  }
  return raw;
}

const IV_LENGTH = 12;

function normalizeKey(): Buffer {
  let key = getEncryptionKey();
  if (key.length < 32) key = key.padEnd(32, '0');
  else if (key.length > 32) key = key.substring(0, 32);
  return Buffer.from(key);
}

export function encrypt(text: string): string {
  const key = normalizeKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${encrypted}:${authTag}`;
}

export function decrypt(text: string): string {
  const parts = text.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted text format');
  const key = normalizeKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(parts[0], 'hex'));
  decipher.setAuthTag(Buffer.from(parts[2], 'hex'));
  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function maskKey(realKey: string): string {
  return realKey && realKey.length > 10
    ? `${realKey.substring(0, 6)}••••••••${realKey.substring(realKey.length - 4)}`
    : '••••••••••••';
}

export function getDecryptedOrRawKey(k: { apiKey?: string; isEncrypted?: boolean }): string {
  if (k.isEncrypted && k.apiKey) {
    try {
      return decrypt(k.apiKey);
    } catch (err) {
      console.error('Decryption failed for display:', err);
    }
  }
  return k.apiKey || '';
}
