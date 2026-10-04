import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { FileCategory } from "@workspace/shared";

import { FileLifecycleListener, type FileVerdictEvent } from "../../files/lifecycle/file-lifecycle-listener";
import { MerchantKybDocumentService } from "../services/merchant-kyb-document.service";

/**
 * Keeps the KYB review status in step with the scan verdicts of its evidence.
 * Documents are usually still SCANNING when they are submitted; when a verdict
 * lands later, this re-derives the review status in the verdict's own
 * transaction (infected or unscannable evidence → ACTION_REQUIRED; all clean
 * again → back to PENDING). Discovered by the files module's listener registry.
 */
@Injectable()
export class KybFileVerdictListener extends FileLifecycleListener {
	public readonly categories: readonly FileCategory[] = ["MERCHANT_KYB"];

	public constructor(private readonly kybDocuments: MerchantKybDocumentService) {
		super();
	}

	public async onVerdict(tx: Prisma.TransactionClient, event: FileVerdictEvent): Promise<void> {
		if (event.organizationId === null) {
			return;
		}
		await this.kybDocuments.reconcileOrgKybStatusInTx(tx, event.organizationId);
	}
}
