/** Injection tokens of the notifications context. */

/** `UnitOfWork<NotificationsScope>`. */
export const NOTIFICATIONS_UNIT_OF_WORK = Symbol("NOTIFICATIONS_UNIT_OF_WORK");
/** {@link EmailDeliveryPort}: one provider call. */
export const EMAIL_DELIVERY = Symbol("EMAIL_DELIVERY");
/** {@link EmailLogReadPort}: the admin email log projection. */
export const EMAIL_LOG_READ = Symbol("EMAIL_LOG_READ");
/** {@link EmailRequestRelayPort}: hands a committed email request to the queue now. */
export const EMAIL_REQUEST_RELAY = Symbol("EMAIL_REQUEST_RELAY");
/** {@link EmailLogSignalPort}: the in-process "email log changed" signal behind the admin SSE stream. */
export const EMAIL_LOG_SIGNAL = Symbol("EMAIL_LOG_SIGNAL");
/** The `EmailRenderContext` (app name, URL, support address) every template renders with. */
export const EMAIL_RENDER_CONTEXT = Symbol("EMAIL_RENDER_CONTEXT");
