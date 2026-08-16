// ============================================
// lib/config.ts - Runtime configuration
// ============================================
// Everything that can be configured via environment variables lives here so the
// shared client package has zero hardcoded URLs. Next.js inlines `NEXT_PUBLIC_*`
// vars at build time, so each app (web/admin) resolves its own value from its own
// `.env` file. The localhost fallback only applies during local development when
// no `.env` has been created yet.

const DEFAULT_API_BASE_URL = "http://localhost:8080";

/**
 * Base URL of the NestJS API, read from `NEXT_PUBLIC_API_URL`.
 *
 * Set `NEXT_PUBLIC_API_URL` in `apps/web/.env` / `apps/admin/.env` when
 * deploying (e.g. `NEXT_PUBLIC_API_URL=https://api.example.com`).
 */
export const API_BASE_URL: string = process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_BASE_URL;

/**
 * Versioned path prefix for every API route. The API serves all endpoints
 * under `/api/v1/<path>` (Nest URI versioning with v1 as the default; a
 * future v2 controller lands at `/api/v2/<path>`). Prepend this to a route
 * path when building an API URL — keep it in ONE place so bumping the version
 * is a single-line change here.
 */
export const API_URL_PREFIX = "/api/v1";
