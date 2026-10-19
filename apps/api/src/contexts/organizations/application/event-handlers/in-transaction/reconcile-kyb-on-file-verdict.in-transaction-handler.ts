import { FileVerdictReached } from "../../../../files/public-api";
import type { DomainEvent } from "../../../../../platform/domain/domain-event";
import type { InTransactionEventHandler } from "../../../../../platform/application/events/in-transaction-event-handler";
import type { OrganizationsScope } from "../../organizations-scope";

/**
 * Keeps the KYB review in step with the scan verdicts of its evidence, in the
 * verdict's own transaction (mechanism 1). Documents are usually still
 * SCANNING when submitted; when a verdict lands the review status is
 * re-derived under the merchant profile's lock (infected or unscannable
 * evidence → ACTION_REQUIRED; all clean again → PENDING). A failure rolls the
 * verdict back.
 */
export class ReconcileKybOnFileVerdict implements InTransactionEventHandler<FileVerdictReached, OrganizationsScope> {
	public accepts(event: DomainEvent): event is FileVerdictReached {
		return event instanceof FileVerdictReached && event.category === "MERCHANT_KYB";
	}

	public async handle(event: FileVerdictReached, scope: OrganizationsScope): Promise<void> {
		if (event.organizationId === null) {
			return;
		}
		const verification = await scope.merchantVerifications.getForUpdate(event.organizationId);
		if (verification === null) {
			return;
		}
		const fileIds = await scope.merchantVerifications.activeEvidenceFileIds(event.organizationId);
		const files = await scope.kybFiles.describe(fileIds);
		const evidence = fileIds.flatMap((fileId) => files.filter((file) => file.id === fileId));
		verification.reconcile(evidence, event.occurredAt);
		await scope.merchantVerifications.save(verification);
		scope.events.collectFrom(verification);
	}
}
