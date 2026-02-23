import { SignJWT, jwtVerify } from 'jose';

export interface UserPayload {
  sub: string;       // Google ID
  email: string;
  name: string;
  picture: string;
}

const getSecret = () => new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me');

export async function createToken(user: UserPayload): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<UserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as UserPayload;
  } catch {
    return null;
  }
}
