import { FileBindingTargetMissingError, FileVerdictReached } from "../../../../files/public-api";
import type { DomainEvent } from "../../../../../platform/domain/domain-event";
import type { InTransactionEventHandler } from "../../../../../platform/application/events/in-transaction-event-handler";
import { STORE_ASSET_SLOT_OF, type TenantFileScope } from "../../ports/tenant-file-bindings.port";

/** A READY store logo or banner becomes the tenant's live asset of that slot, in the verdict transaction. */
export class BindStoreAssetOnFileVerdict implements InTransactionEventHandler<FileVerdictReached, TenantFileScope> {
	public accepts(event: DomainEvent): event is FileVerdictReached {
		return event instanceof FileVerdictReached && event.outcome === "READY" && STORE_ASSET_SLOT_OF[event.category] !== undefined;
	}

	public async handle(event: FileVerdictReached, scope: TenantFileScope): Promise<void> {
		const slot = STORE_ASSET_SLOT_OF[event.category];
		if (event.tenantId === null || slot === undefined) {
			throw new FileBindingTargetMissingError(event.fileId, "TENANT_ASSET");
		}
		await scope.tenantFiles.bindStoreAsset(event.tenantId, slot, event.fileId, event.occurredAt);
	}
}
