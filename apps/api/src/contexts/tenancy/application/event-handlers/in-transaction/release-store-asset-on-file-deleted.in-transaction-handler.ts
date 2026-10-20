import { FileDeleted } from "../../../../files/public-api";
import type { DomainEvent } from "../../../../../platform/domain/domain-event";
import type { InTransactionEventHandler } from "../../../../../platform/application/events/in-transaction-event-handler";
import { STORE_ASSET_SLOT_OF, type TenantFileScope } from "../../ports/tenant-file-bindings.port";

/** A deleted store logo or banner stops being the tenant's asset, in the deletion transaction. */
export class ReleaseStoreAssetOnFileDeleted implements InTransactionEventHandler<FileDeleted, TenantFileScope> {
	public accepts(event: DomainEvent): event is FileDeleted {
		return event instanceof FileDeleted && STORE_ASSET_SLOT_OF[event.category] !== undefined;
	}

	public async handle(event: FileDeleted, scope: TenantFileScope): Promise<void> {
		await scope.tenantFiles.releaseStoreAsset(event.fileId, event.deletedBy, event.occurredAt);
	}
}
