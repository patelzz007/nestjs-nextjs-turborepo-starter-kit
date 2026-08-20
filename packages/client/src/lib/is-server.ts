// ============================================
// lib/is-server.ts - Client/server environment detection
// ============================================
// Single source of truth for the `typeof window === "undefined"` check.
// Import from @workspace/client/lib/is-server instead of repeating the check.

/** `true` when running on the server (Node.js / SSR); `false` in the browser. */
export const isServer: boolean = typeof window === "undefined";
