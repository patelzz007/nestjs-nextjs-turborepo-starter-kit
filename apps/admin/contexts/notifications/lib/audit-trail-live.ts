// ============================================
// lib/notifications/audit-trail-live.ts - live audit log updates (SSE)
// ============================================
"use client";

import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { apiRoutes } from "@workspace/shared";

import { liveEventsUrl, useLiveQueryInvalidation } from "@/contexts/notifications/lib/live-query-invalidation";
import type { LiveState } from "@/contexts/notifications/lib/reconnecting-event-stream";

/** The audit trail SSE endpoint (`GET /admin/audit-trail/events`, LIST AUDIT_LOG). */
export function auditTrailEventsUrl(): string {
	return liveEventsUrl(apiRoutes.auditTrail.events);
}

/** Every cached audit-log page — a stable key, so the subscription stays open. */
const AUDIT_TRAIL_SCOPE = apiRouter.auditTrail.list.scopeKey(undefined);

/**
 * Subscribes to the audit trail's SSE stream: the database signals every new
 * entry (requests and background writes alike), and each frame refetches the
 * audit log the page shows — no manual refresh.
 *
 * @returns The connection state for the "Live" pill.
 */
export function useAuditTrailLive(): LiveState {
	return useLiveQueryInvalidation({ url: auditTrailEventsUrl(), queryKey: AUDIT_TRAIL_SCOPE });
}
