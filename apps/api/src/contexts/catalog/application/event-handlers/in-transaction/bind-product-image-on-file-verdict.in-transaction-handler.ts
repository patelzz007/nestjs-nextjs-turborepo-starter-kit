import { FileBindingTargetMissingError, FileVerdictReached } from "../../../../files/public-api";
import type { DomainEvent } from "../../../../../platform/domain/domain-event";
import type { InTransactionEventHandler } from "../../../../../platform/application/events/in-transaction-event-handler";
import type { ProductImageFileScope } from "../../ports/product-image-bindings.port";

/** A READY product image joins its product's gallery in the verdict transaction; a vanished product fails the upload instead. */
export class BindProductImageOnFileVerdict implements InTransactionEventHandler<FileVerdictReached, ProductImageFileScope> {
	public accepts(event: DomainEvent): event is FileVerdictReached {
		return event instanceof FileVerdictReached && event.outcome === "READY" && event.category === "PRODUCT_IMAGE";
	}

	public async handle(event: FileVerdictReached, scope: ProductImageFileScope): Promise<void> {
		if (event.productId === null || !(await scope.productImages.appendToGallery(event.productId, event.fileId))) {
			throw new FileBindingTargetMissingError(event.fileId, "PRODUCT_IMAGE");
		}
	}
}
