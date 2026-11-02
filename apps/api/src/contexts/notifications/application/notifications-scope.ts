import type { TransactionalEventCollector } from "../../../platform/application/events/transactional-event-collector";
import type { EmailLogRepository } from "../domain/repositories/email-log.repository";
import type { EmailRequestTransactionalPort } from "./ports/email-request.port";
import type { NotificationAccountStore } from "./ports/notification-account-store.port";
import type { NotificationStore } from "./ports/notification-store.port";
import type { NotifyTransactionalPort } from "./ports/notify.port";
import type { BroadcastStore } from "./ports/broadcast-store.port";

/** Everything one notifications unit of work touches, bound to ONE transaction. */
export interface NotificationsScope {
	readonly emailLogs: EmailLogRepository;
	readonly emailRequests: EmailRequestTransactionalPort;
	readonly notify: NotifyTransactionalPort;
	/** The notification tables (ADR 070), under a `notifications.*` system operation. */
	readonly notificationStore: NotificationStore;
	/** The person's own inbox, preferences and devices, and the admin readers (ADR 070). */
	readonly accountStore: NotificationAccountStore;
	/** Broadcasts, their audiences and reports (ADR 073). */
	readonly broadcasts: BroadcastStore;
	readonly events: TransactionalEventCollector;
}

/** Allowlisted system operation for every `EmailLog` / `EmailDeliveryEvent` write (updates are bypass-only). */
export const EMAIL_LOG_WRITE_OPERATION = "email.log.write";
