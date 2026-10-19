import { FileDeleted } from "../../../../files/public-api";
import type { DomainEvent } from "../../../../../platform/domain/domain-event";
import type { InTransactionEventHandler } from "../../../../../platform/application/events/in-transaction-event-handler";
import { STORE_ASSET_SLOT_OF, type OrganizationFileScope } from "../../ports/organization-file-bindings.port";

/** A deleted store logo or banner stops being the organization's asset, in the deletion transaction. */
export class ReleaseStoreAssetOnFileDeleted implements InTransactionEventHandler<FileDeleted, OrganizationFileScope> {
	public accepts(event: DomainEvent): event is FileDeleted {
		return event instanceof FileDeleted && STORE_ASSET_SLOT_OF[event.category] !== undefined;
	}

	public async handle(event: FileDeleted, scope: OrganizationFileScope): Promise<void> {
		await scope.organizationFiles.releaseStoreAsset(event.fileId, event.deletedBy, event.occurredAt);
	}
}
