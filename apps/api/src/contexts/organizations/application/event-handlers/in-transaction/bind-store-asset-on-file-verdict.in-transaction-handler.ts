import { FileBindingTargetMissingError, FileVerdictReached } from "../../../../files/public-api";
import type { DomainEvent } from "../../../../../platform/domain/domain-event";
import type { InTransactionEventHandler } from "../../../../../platform/application/events/in-transaction-event-handler";
import { STORE_ASSET_SLOT_OF, type OrganizationFileScope } from "../../ports/organization-file-bindings.port";

/** A READY store logo or banner becomes the organization's live asset of that slot, in the verdict transaction. */
export class BindStoreAssetOnFileVerdict implements InTransactionEventHandler<FileVerdictReached, OrganizationFileScope> {
	public accepts(event: DomainEvent): event is FileVerdictReached {
		return event instanceof FileVerdictReached && event.outcome === "READY" && STORE_ASSET_SLOT_OF[event.category] !== undefined;
	}

	public async handle(event: FileVerdictReached, scope: OrganizationFileScope): Promise<void> {
		const slot = STORE_ASSET_SLOT_OF[event.category];
		if (event.organizationId === null || slot === undefined) {
			throw new FileBindingTargetMissingError(event.fileId, "ORGANIZATION_ASSET");
		}
		await scope.organizationFiles.bindStoreAsset(event.organizationId, slot, event.fileId, event.occurredAt);
	}
}
