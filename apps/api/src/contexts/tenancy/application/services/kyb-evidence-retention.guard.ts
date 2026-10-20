import type { FileCategory } from "@workspace/shared";

import type { FileDeletionScope, FileReferenceBlock, FileReferenceGuard, FileReferenceSubject } from "../../../files/public-api";
import type { TenantFileScope } from "../ports/tenant-file-bindings.port";

/** Evidence ever submitted for review is retained (it is the review history) and is never user-deletable. */
export class KybEvidenceRetentionGuard implements FileReferenceGuard<TenantFileScope> {
	public readonly categories: readonly FileCategory[] = ["MERCHANT_KYB"];
	public readonly deletionScope: FileDeletionScope = "actor";

	public async blockDelete(subject: FileReferenceSubject, scope: TenantFileScope): Promise<FileReferenceBlock | null> {
		return (await scope.tenantFiles.isKybEvidence(subject.fileId)) ? "KYB_EVIDENCE" : null;
	}
}
