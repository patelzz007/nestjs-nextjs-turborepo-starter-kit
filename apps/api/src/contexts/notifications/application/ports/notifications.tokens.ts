import type { SystemOperationName } from "../../../../platform/application/system-operation-names";

/** Injection tokens of the notifications context. */

/** `UnitOfWork<NotificationsScope>`. */
export const NOTIFICATIONS_UNIT_OF_WORK = Symbol("NOTIFICATIONS_UNIT_OF_WORK");
/** {@link EmailDeliveryPort}: one provider call. */
export const EMAIL_DELIVERY = Symbol("EMAIL_DELIVERY");
/** {@link EmailLogReadPort}: the admin email log projection. */
export const EMAIL_LOG_READ = Symbol("EMAIL_LOG_READ");
/** Admin email-log list. `EmailLog` reads are bypass-only, and this operation allows that table alone. */
export const EMAIL_LOG_LIST_OPERATION: SystemOperationName = "notifications.email_log.list";
/** {@link EmailRequestRelayPort}: hands a committed email request to the queue now. */
export const EMAIL_REQUEST_RELAY = Symbol("EMAIL_REQUEST_RELAY");
/** {@link EmailLogSignalPort}: the in-process "email log changed" signal behind the admin SSE stream. */
export const EMAIL_LOG_SIGNAL = Symbol("EMAIL_LOG_SIGNAL");
/** The `EmailRenderContext` (app name, URL, support address) every template renders with. */
export const EMAIL_RENDER_CONTEXT = Symbol("EMAIL_RENDER_CONTEXT");

/** The `queue.email.send` system operation, named once for every route and adapter that runs under it. */
export const QUEUE_EMAIL_SEND_OPERATION: SystemOperationName = "queue.email.send";

// ── Notifications (ADR 070) ──────────────────────────────────────────
export const NOTIFICATION_DISPATCHER = Symbol("NOTIFICATION_DISPATCHER");
export const CHANNEL_DELIVERY = Symbol("CHANNEL_DELIVERY");
export const NOTIFICATIONS_MAINTENANCE = Symbol("NOTIFICATIONS_MAINTENANCE");
export const UNSUBSCRIBE_LINKS = Symbol("UNSUBSCRIBE_LINKS");
export const NOTIFICATION_RENDER_CONTEXT = Symbol("NOTIFICATION_RENDER_CONTEXT");
export const NOTIFICATION_ACCOUNT = Symbol("NOTIFICATION_ACCOUNT");
export const NOTIFICATION_ADMIN = Symbol("NOTIFICATION_ADMIN");
export const BROADCAST_SERVICE = Symbol("BROADCAST_SERVICE");
export const BROADCAST_QUEUE = Symbol("BROADCAST_QUEUE");

// ── Provider callbacks through the shared inbound receiver (ADR 081) ─
/** {@link NotificationWebhookVerifiersPort}: Resend's and Twilio's signature checks, keyed for this deployment. */
export const NOTIFICATION_WEBHOOK_VERIFIERS = Symbol("NOTIFICATION_WEBHOOK_VERIFIERS");
/** {@link NotificationWebhookReception}: Resend's and Twilio's callbacks, verified, claimed once and logged. */
export const NOTIFICATION_WEBHOOK_RECEPTION = Symbol("NOTIFICATION_WEBHOOK_RECEPTION");
