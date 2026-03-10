import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';
import { config } from '../config/index.js';
import { UserPayload } from '../types/index.js';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: UserPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): UserPayload | null {
  try {
    return jwt.verify(token, config.jwt.secret) as UserPayload;
  } catch {
    return null;
  }
}

function getCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [rawName, ...rawValueParts] = cookie.trim().split('=');
    if (rawName !== name) {
      continue;
    }

    const rawValue = rawValueParts.join('=');
    if (!rawValue) {
      return null;
    }

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return null;
}

export function extractTokenFromRequest(req: Pick<Request, 'headers'>): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim() || null;
  }

  return getCookieValue(req.headers.cookie, config.auth.cookieName);
}

export function extractTokenFromCookieHeader(cookieHeader: string | undefined): string | null {
  return getCookieValue(cookieHeader, config.auth.cookieName);
}

export function generateRandomPassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
