import { createHmac } from 'crypto';

export interface UserPayload {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

const getSecret = () => process.env.JWT_SECRET || 'dev-secret-change-me';

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64url');
}

function base64urlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf-8');
}

export async function createToken(user: UserPayload): Promise<string> {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    ...user,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  }));
  const signature = createHmac('sha256', getSecret())
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export async function verifyToken(token: string): Promise<UserPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const expected = createHmac('sha256', getSecret())
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (signature !== expected) return null;

    const data = JSON.parse(base64urlDecode(payload));

    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;

    return { sub: data.sub, email: data.email, name: data.name, picture: data.picture };
  } catch {
    return null;
  }
}
