import type { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.js';

interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  message: string;
}

interface Entry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, Entry>>();
const lastSweepAt = new Map<string, number>();

function buildClientKey(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const ip = forwardedValue?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || 'unknown';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  return email ? `${ip}:${email}` : ip;
}

export function createRateLimitMiddleware(options: RateLimitOptions) {
  const storeKey = `${options.maxRequests}:${options.windowMs}:${options.message}`;
  let store = stores.get(storeKey);
  if (!store) {
    store = new Map<string, Entry>();
    stores.set(storeKey, store);
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const clientKey = buildClientKey(req);
    const lastSweep = lastSweepAt.get(storeKey) ?? 0;

    if (now - lastSweep >= options.windowMs) {
      for (const [key, entry] of store!.entries()) {
        if (entry.resetAt <= now) {
          store!.delete(key);
        }
      }
      lastSweepAt.set(storeKey, now);
    }

    const current = store!.get(clientKey);

    if (!current || current.resetAt <= now) {
      store!.set(clientKey, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      next();
      return;
    }

    if (current.count >= options.maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      sendError(res, options.message, 429);
      return;
    }

    current.count += 1;
    store!.set(clientKey, current);
    next();
  };
}
