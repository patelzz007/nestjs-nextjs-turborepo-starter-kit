import { FileDeleted } from "../../../../files/public-api";
import type { DomainEvent } from "../../../../../platform/domain/domain-event";
import type { InTransactionEventHandler } from "../../../../../platform/application/events/in-transaction-event-handler";
import type { TenantFileScope } from "../../ports/tenant-file-bindings.port";

/** An unsubmitted KYB upload's links (if any) are retired with it, in the deletion transaction. */
export class ReleaseKybEvidenceOnFileDeleted implements InTransactionEventHandler<FileDeleted, TenantFileScope> {
	public accepts(event: DomainEvent): event is FileDeleted {
		return event instanceof FileDeleted && event.category === "MERCHANT_KYB";
	}

	public async handle(event: FileDeleted, scope: TenantFileScope): Promise<void> {
		await scope.tenantFiles.releaseKybEvidence(event.fileId, event.deletedBy, event.occurredAt);
	}
}
