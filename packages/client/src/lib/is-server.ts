// ============================================
// lib/is-server.ts - Client/server environment detection
// ============================================
// Single source of truth for the browser vs SSR check (rules/28-runtime-validation.md).
// Import from @workspace/client/lib/is-server instead of repeating the check.

import { isBrowserRuntime } from "@workspace/shared";

/** `true` when running on the server (Node.js / SSR); `false` in the browser. */
export const isServer = !isBrowserRuntime();
