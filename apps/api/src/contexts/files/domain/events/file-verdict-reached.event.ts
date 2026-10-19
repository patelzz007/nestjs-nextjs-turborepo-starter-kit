import type { EpochMs, FileCategory } from "@workspace/shared";

import { DomainEvent } from "../../../../platform/domain/domain-event";

/** The verdict a file just received. Every one is final: the file left SCANNING for good. */
export type FileVerdictOutcome = "READY" | "QUARANTINED" | "FAILED";

/**
 * A file left SCANNING for good (mechanism 1, §5.6). In-transaction handlers run
 * inside the `files.scan_verdict.apply` transaction that applied the verdict, so
 * the verdict and every owner's reaction (binding a READY image, re-deriving a KYB
 * review) commit or roll back together. An owner that cannot attach a READY file
 * throws {@link FileBindingTargetMissingError}: the verdict then becomes FAILED.
 */
export class FileVerdictReached extends DomainEvent {
	public readonly eventName = "files.FileVerdictReached";

	public constructor(
		occurredAt: EpochMs,
		public readonly fileId: string,
		public readonly category: FileCategory,
		public readonly organizationId: string | null,
		public readonly uploadedById: string,
		public readonly outcome: FileVerdictOutcome,
		/** The product a PRODUCT_IMAGE was uploaded for; null for every other category. */
		public readonly productId: string | null,
	) {
		super(occurredAt);
	}
}

export function fileVerdictReached(input: {
	readonly fileId: string;
	readonly category: FileCategory;
	readonly organizationId: string | null;
	readonly uploadedById: string;
	readonly outcome: FileVerdictOutcome;
	readonly productId: string | null;
	readonly occurredAt: EpochMs;
}): FileVerdictReached {
	return new FileVerdictReached(input.occurredAt, input.fileId, input.category, input.organizationId, input.uploadedById, input.outcome, input.productId);
}
