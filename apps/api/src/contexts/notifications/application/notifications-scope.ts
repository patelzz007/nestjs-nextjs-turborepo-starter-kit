import type { TransactionalEventCollector } from "../../../platform/application/events/transactional-event-collector";
import type { EmailLogRepository } from "../domain/repositories/email-log.repository";
import type { EmailRequestTransactionalPort } from "./ports/email-request.port";

/** Everything one notifications unit of work touches, bound to ONE transaction. */
export interface NotificationsScope {
	readonly emailLogs: EmailLogRepository;
	readonly emailRequests: EmailRequestTransactionalPort;
	readonly events: TransactionalEventCollector;
}

/** Allowlisted system operation for every `EmailLog` / `EmailDeliveryEvent` write (updates are bypass-only). */
export const EMAIL_LOG_WRITE_OPERATION = "email.log.write";
