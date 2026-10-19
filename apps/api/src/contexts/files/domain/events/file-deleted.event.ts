import type { EpochMs, FileCategory, FileVariantKind, StorageObjectLocator } from "@workspace/shared";

import { DomainEvent } from "../../../../platform/domain/domain-event";

/** One stored copy of a deleted file: the original (`ORIGINAL`) or one rendition. */
export interface DeletedFileObject {
	readonly slot: FileVariantKind;
	readonly locator: StorageObjectLocator;
	/** The copy was published to the public delivery origin and must be withdrawn. */
	readonly published: boolean;
}

/**
 * A file was soft-deleted. In-transaction handlers (mechanism 1) let owners
 * release the rows that point at it in the same transaction. After commit
 * (mechanism 2) the files context withdraws its public copies and enqueues the
 * existing physical-delete and CDN-invalidation jobs (their job ids dedupe a
 * repeated dispatch).
 */
export class FileDeleted extends DomainEvent {
	public readonly eventName = "files.FileDeleted";

	public constructor(
		occurredAt: EpochMs,
		public readonly fileId: string,
		public readonly category: FileCategory,
		public readonly organizationId: string | null,
		/** User id, or a `system:` marker for background cleanup. Written to every released row's `deletedBy`. */
		public readonly deletedBy: string,
		public readonly objects: readonly DeletedFileObject[],
	) {
		super(occurredAt);
	}
}
