import type { TransactionalEventCollector } from "../../../platform/application/events/transactional-event-collector";

import type { PaymentIntentRepository } from "../domain/repositories/payment-intent.repository";

/** Everything one payments transaction can touch. Repositories are bound to that transaction. */
export interface PaymentsScope {
	readonly payments: PaymentIntentRepository;
	readonly events: TransactionalEventCollector;
}
