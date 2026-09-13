// ============================================
// lib/session-status-badge.ts - Session badge stream pipeline
// ============================================

import { z } from "zod";

import { SessionStatusSchema } from "@workspace/shared";

export const SessionStateSchema = z.discriminatedUnion("status", [
	z.object({ status: z.literal("loading") }),
	z.object({ status: z.literal("error"), errorMessage: z.string(), retryable: z.boolean() }),
	z.object({ status: z.literal("ready"), session: SessionStatusSchema }),
]);

export type SessionState = z.output<typeof SessionStateSchema>;

export {
	didTokenRotate,
	fetchSessionState,
	fetchSessionStateWithRetry,
	isDocumentVisible,
	isExpiredSessionError,
	resolvePollMs,
	sameSessionState,
	secondsUntil,
	toSessionErrorMessage,
} from "./status-badge-helpers";

export { buildSessionBadgeStreams, type SessionBadgeStreamParams, type SessionBadgeStreams } from "./status-badge-stream";
