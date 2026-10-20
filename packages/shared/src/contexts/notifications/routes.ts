// API path templates owned by the `notifications` context. Composed into `apiRoutes`
// (`src/api-routes.ts`) with identical keys and values.

import type { RouteTree } from "../../route-tree";

// ── Email ───────────────────────────────────────────────────────────

/** Path templates composed into `apiRoutes.email`. */
export const emailRoutes = {
	previewList: "/notifications/email-preview",
	previewDetail: "/notifications/email-preview/:key",
	previewSend: "/notifications/email-preview/:key/send",
	logList: "/notifications/email-log",
	/** Server-Sent Events stream of email-log changes (`@Sse("events")` on the email-log controller). */
	logEvents: "/notifications/email-log/events",
} satisfies Record<string, RouteTree>;

/** Path templates composed into `apiRoutes.rewardsAdmin` (invitesPreviewEmail). */
export const merchantInviteEmailPreviewRoutes = {
	invitesPreviewEmail: "/admin/invites/preview-email",
} satisfies Record<string, RouteTree>;
