import crypto from 'crypto';

export function generateSourcePath(): string {
  return crypto.randomBytes(12).toString('hex');
}