import type { TransactionalEventCollector } from "../../../platform/application/events/transactional-event-collector";

import type { ProductRepository } from "../domain/repositories/product.repository";
import type { SampleCategoryRepository } from "../domain/repositories/sample-category.repository";

/** Everything one catalog transaction can touch. Repositories are bound to that transaction. */
export interface CatalogScope {
	readonly products: ProductRepository;
	readonly sampleCategories: SampleCategoryRepository;
	readonly events: TransactionalEventCollector;
}
