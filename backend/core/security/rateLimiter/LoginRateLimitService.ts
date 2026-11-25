import { db } from '../../../infrastructure/firebase';
import { logger } from '../../logger';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export class LoginRateLimitService {
  private static getClientIp(req: any): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }

  private static getDocKey(clientIp: string): string {
    const sanitizedIp = clientIp.replace(/[^a-zA-Z0-9_.-]/g, '_');
    return `ip_${sanitizedIp}`;
  }

  /**
   * Check if the incoming client IP is currently locked out.
   */
  static async checkLockout(req: any): Promise<{ isLocked: boolean; minutesRemaining?: number }> {
    try {
      const clientIp = this.getClientIp(req);
      const docKey = this.getDocKey(clientIp);
      const doc = await db.collection('login_rate_limits').doc(docKey).get();

      if (!doc.exists) {
        return { isLocked: false };
      }

      const data = doc.data() as any;
      const now = Date.now();

      // Check if active lockout exists
      if (data.lockedUntil && now < data.lockedUntil) {
        const minutesRemaining = Math.max(1, Math.ceil((data.lockedUntil - now) / 60000));
        return { isLocked: true, minutesRemaining };
      }

      // If lockout or window has expired, reset
      if (data.lastAttempt && now - data.lastAttempt > LOCKOUT_WINDOW_MS) {
        await doc.ref.delete().catch(() => {});
        return { isLocked: false };
      }

      return { isLocked: false };
    } catch (err) {
      logger.warn('[LoginRateLimitService] checkLockout error (fail-open):', err);
      return { isLocked: false };
    }
  }

  /**
   * Record a failed login attempt. Locks the IP if failed attempts reach MAX_FAILED_ATTEMPTS.
   */
  static async recordFailedAttempt(req: any): Promise<{ isNowLocked: boolean; failedCount: number }> {
    try {
      const clientIp = this.getClientIp(req);
      const docKey = this.getDocKey(clientIp);
      const docRef = db.collection('login_rate_limits').doc(docKey);
      const doc = await docRef.get();

      const now = Date.now();
      let failedCount = 1;

      if (doc.exists) {
        const data = doc.data() as any;
        if (data.lastAttempt && now - data.lastAttempt <= LOCKOUT_WINDOW_MS) {
          failedCount = (data.failedCount || 0) + 1;
        }
      }

      const isNowLocked = failedCount >= MAX_FAILED_ATTEMPTS;
      const lockedUntil = isNowLocked ? now + LOCKOUT_WINDOW_MS : null;

      await docRef.set({
        clientIp,
        failedCount,
        lastAttempt: now,
        lockedUntil,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      return { isNowLocked, failedCount };
    } catch (err) {
      logger.warn('[LoginRateLimitService] recordFailedAttempt error:', err);
      return { isNowLocked: false, failedCount: 1 };
    }
  }

  /**
   * Reset failed attempt counter upon successful login.
   */
  static async recordSuccessfulLogin(req: any): Promise<void> {
    try {
      const clientIp = this.getClientIp(req);
      const docKey = this.getDocKey(clientIp);
      await db.collection('login_rate_limits').doc(docKey).delete().catch(() => {});
    } catch (err) {
      logger.warn('[LoginRateLimitService] recordSuccessfulLogin error (non-fatal):', err);
    }
  }
}
