import type { Prisma } from "@prisma/client";

import type { ScopeFactory } from "../../../../platform/application/events/in-transaction-event-handler";
import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import { transactionRepositoryDb } from "../../../../platform/infrastructure/persistence/types";
import type { CatalogScope } from "../../application/catalog-scope";
import { PrismaProductRepository } from "./prisma-product.repository";
import { PrismaSampleCategoryRepository } from "./prisma-sample-category.repository";

/** Builds catalog repositories bound to the unit-of-work transaction. Never cached. */
export class CatalogScopeFactory implements ScopeFactory<CatalogScope, Prisma.TransactionClient> {
	public create(db: Prisma.TransactionClient, events: TransactionalEventCollector): CatalogScope {
		return {
			products: new PrismaProductRepository(transactionRepositoryDb(db)),
			sampleCategories: new PrismaSampleCategoryRepository(transactionRepositoryDb(db)),
			events,
		};
	}
}
