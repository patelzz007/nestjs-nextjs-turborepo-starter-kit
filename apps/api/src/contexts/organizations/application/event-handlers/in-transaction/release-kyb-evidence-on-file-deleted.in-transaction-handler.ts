import { FileDeleted } from "../../../../files/public-api";
import type { DomainEvent } from "../../../../../platform/domain/domain-event";
import type { InTransactionEventHandler } from "../../../../../platform/application/events/in-transaction-event-handler";
import type { OrganizationFileScope } from "../../ports/organization-file-bindings.port";

/** An unsubmitted KYB upload's links (if any) are retired with it, in the deletion transaction. */
export class ReleaseKybEvidenceOnFileDeleted implements InTransactionEventHandler<FileDeleted, OrganizationFileScope> {
	public accepts(event: DomainEvent): event is FileDeleted {
		return event instanceof FileDeleted && event.category === "MERCHANT_KYB";
	}

	public async handle(event: FileDeleted, scope: OrganizationFileScope): Promise<void> {
		await scope.organizationFiles.releaseKybEvidence(event.fileId, event.deletedBy, event.occurredAt);
	}
}
