import { FileDeleted } from "../../../../files/public-api";
import type { DomainEvent } from "../../../../../platform/domain/domain-event";
import type { InTransactionEventHandler } from "../../../../../platform/application/events/in-transaction-event-handler";
import type { ProductImageFileScope } from "../../ports/product-image-bindings.port";

/** A deleted product image leaves every gallery in the deletion transaction. */
export class ReleaseProductImagesOnFileDeleted implements InTransactionEventHandler<FileDeleted, ProductImageFileScope> {
	public accepts(event: DomainEvent): event is FileDeleted {
		return event instanceof FileDeleted && event.category === "PRODUCT_IMAGE";
	}

	public async handle(event: FileDeleted, scope: ProductImageFileScope): Promise<void> {
		await scope.productImages.releaseFile(event.fileId, event.deletedBy, event.occurredAt);
	}
}
