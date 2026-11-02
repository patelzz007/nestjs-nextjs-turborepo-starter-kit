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

// ── Notifications (ADR 070) ─────────────────────────────────────────

/** The signed-in person's own inbox, preferences and devices (every app, filtered by surface). */
export const notificationsRoutes = {
	inbox: "/notifications",
	unreadCount: "/notifications/unread-count",
	/** Server-Sent Events: one frame whenever the caller's inbox on that surface changes. */
	stream: "/notifications/stream",
	read: "/notifications/read",
	archive: "/notifications/archive",
	preferences: "/notifications/preferences",
	consent: "/notifications/consent",
	leaveTenant: "/notifications/leave-tenant",
	pushDevices: "/notifications/push-devices",
	pushDevice: "/notifications/push-devices/:deviceId",
	pushOpened: "/notifications/push-opened",
	/** The web unsubscribe page's call: `{ token }` in the body, no session. */
	unsubscribe: "/notifications/unsubscribe",
	/** RFC 8058 one-click: the `List-Unsubscribe` URL a mail client POSTs to (token in the query; no session). */
	unsubscribeOneClick: "/notifications/unsubscribe/one-click",
	twilioStatus: "/webhooks/twilio/status",
	twilioInbound: "/webhooks/twilio/inbound",
} satisfies Record<string, RouteTree>;

/** Platform staff: the delivery log, catalog, suppressions and providers. */
export const notificationsAdminRoutes = {
	deliveries: "/admin/notifications/deliveries",
	retryDelivery: "/admin/notifications/deliveries/:deliveryId/retry",
	catalog: "/admin/notifications/catalog",
	previewType: "/admin/notifications/catalog/:key/preview",
	sendTest: "/admin/notifications/test",
	suppressions: "/admin/notifications/suppressions",
	liftSuppression: "/admin/notifications/suppressions/:suppressionId/lift",
	providers: "/admin/notifications/providers",
	broadcasts: "/admin/broadcasts",
	broadcast: "/admin/broadcasts/:broadcastId",
	scheduleBroadcast: "/admin/broadcasts/:broadcastId/schedule",
	approveBroadcast: "/admin/broadcasts/:broadcastId/approve",
	cancelBroadcast: "/admin/broadcasts/:broadcastId/cancel",
	broadcastAudiencePreview: "/admin/broadcasts/audience-preview",
	broadcastReports: "/admin/broadcast-reports",
	reviewBroadcastReport: "/admin/broadcast-reports/:reportId/review",
} satisfies Record<string, RouteTree>;

/** A tenant's own deliveries and broadcasts (ADR 073). */
export const tenantNotificationsRoutes = {
	deliveries: "/tenants/:tenantSlug/notifications/deliveries",
	broadcasts: "/tenants/:tenantSlug/broadcasts",
	broadcast: "/tenants/:tenantSlug/broadcasts/:broadcastId",
	scheduleBroadcast: "/tenants/:tenantSlug/broadcasts/:broadcastId/schedule",
	cancelBroadcast: "/tenants/:tenantSlug/broadcasts/:broadcastId/cancel",
	broadcastAudiencePreview: "/tenants/:tenantSlug/broadcasts/audience-preview",
	broadcastAllowance: "/tenants/:tenantSlug/broadcasts/allowance",
	/** The tenant's customers, to pick recipients by hand (one person or a group). */
	broadcastCustomers: "/tenants/:tenantSlug/broadcasts/customers",
} satisfies Record<string, RouteTree>;

/** A recipient reports a broadcast. */
export const broadcastReportRoutes = {
	report: "/broadcasts/:broadcastId/report",
} satisfies Record<string, RouteTree>;
