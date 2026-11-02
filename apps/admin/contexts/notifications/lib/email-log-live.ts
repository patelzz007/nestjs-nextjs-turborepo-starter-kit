// ============================================
// lib/notifications/email-log-live.ts - live EmailLog updates (SSE)
// ============================================
"use client";

import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { liveEventsUrl, useLiveQueryInvalidation } from "@workspace/client/lib/features/live-updates/live-query-invalidation";
import type { LiveState } from "@workspace/client/lib/features/live-updates/reconnecting-event-stream";
import { apiRoutes, AuthClientTypeSchema } from "@workspace/shared";

/** The email-log SSE endpoint (`GET /notifications/email-log/events`, LIST EMAIL). */
export function emailLogEventsUrl(): string {
	return liveEventsUrl(apiRoutes.email.logEvents, AuthClientTypeSchema.enum.admin);
}

/** Every cached email-log page — a stable key, so the subscription stays open. */
const EMAIL_LOG_SCOPE = apiRouter.email.logList.scopeKey(undefined);

/**
 * Subscribes to the EmailLog SSE stream: every frame refetches the email-log
 * list, so rows update the instant a webhook flips a status.
 *
 * @returns The connection state for the "Live" pill.
 */
export function useEmailLogLive(): LiveState {
	return useLiveQueryInvalidation({ url: emailLogEventsUrl(), queryKey: EMAIL_LOG_SCOPE });
}
