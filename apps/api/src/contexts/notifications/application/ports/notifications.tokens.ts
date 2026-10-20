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
