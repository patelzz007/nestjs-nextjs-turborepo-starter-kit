import { SkipThrottle } from "@nestjs/throttler";

/**
 * Skip every named auth throttler (`strict` + `default`).
 *
 * `@SkipThrottle()` alone only skips `default` in @nestjs/throttler v6+, leaving
 * `strict` (10 req/min/IP) active — too aggressive for session/bootstrap reads
 * like `GET /auth/me`.
 */
export const SkipAuthThrottle = (): ReturnType<typeof SkipThrottle> => SkipThrottle({ strict: true, default: true });
