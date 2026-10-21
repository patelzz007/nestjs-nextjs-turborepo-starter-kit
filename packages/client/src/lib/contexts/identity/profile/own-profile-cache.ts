// ============================================
// lib/contexts/identity/profile/own-profile-cache.ts — cache effects of a profile edit
// ============================================
// Defined once in `@workspace/api-client/react`, shared with the mobile app; this is the web
// apps' stable entry for it and adds nothing of its own.

export { applyOwnProfileUpdated, applyOwnProfileUpdateFailed, isStaleProfileVersionError } from "@workspace/api-client/react";
