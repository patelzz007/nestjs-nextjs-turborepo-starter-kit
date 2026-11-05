import type { Prisma } from "@prisma/client";

import type { ScopeFactory } from "../../../../platform/application/events/in-transaction-event-handler";
import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import type { PaymentsScope } from "../../application/payments-scope";
import { PrismaPaymentIntentRepository } from "./prisma-payment-intent.repository";

/** Builds the payments repositories bound to the unit-of-work transaction. Never cached. */
export class PaymentsScopeFactory implements ScopeFactory<PaymentsScope, Prisma.TransactionClient> {
	public create(db: Prisma.TransactionClient, events: TransactionalEventCollector): PaymentsScope {
		return { payments: new PrismaPaymentIntentRepository(db), events };
	}
}
