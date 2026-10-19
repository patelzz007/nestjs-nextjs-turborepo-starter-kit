import {
	FileCategorySchema,
	FileStatusSchema,
	FileVisibilitySchema,
	type EpochMs,
	type FileCategory,
	type FileStatus,
	type FileVariantKind,
	type FileVisibility,
	type StorageObjectLocator,
	type StoredObjectScanStatus,
} from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import {
	CorruptStoredFileStateError,
	FileChecksumMismatchError,
	FileStateConflictError,
	FileUploadAlreadyCompletedError,
	FileUploadForbiddenError,
} from "../errors/files.errors";
import { FileDeleted, type DeletedFileObject } from "../events/file-deleted.event";
import { FileVerdictReached, type FileVerdictOutcome } from "../events/file-verdict-reached.event";

/** Statuses a file is in while a scan verdict is outstanding (`PROCESSING` is the pre-scanner legacy name). */
export const AWAITING_VERDICT_STATUSES: readonly FileStatus[] = ["SCANNING", "PROCESSING"];

/** One published rendition of an image, as the verdict records it. */
export interface FileRenditionRecord {
	readonly kind: FileVariantKind;
	readonly mimeType: string;
	readonly sizeBytes: number;
	readonly width: number;
	readonly height: number;
	readonly locator: StorageObjectLocator;
	readonly publicPath: string;
	readonly objectRevision: string | null;
}

/** What upload verification read from the stored bytes. */
export interface VerifiedUpload {
	readonly actualChecksum: string;
	readonly objectRevision: string | null;
	/** An image's displayed size; null for a category without pixel rules. */
	readonly imageWidth: number | null;
	readonly imageHeight: number | null;
}

/** Where a READY file's bytes were promoted to, and where its public copy lives. */
export interface PromotedObject {
	readonly storagePath: string;
	readonly objectRevision: string | null;
	readonly publicPath: string | null;
}

/** The facts a verdict records next to its outcome. */
export interface VerdictRecord {
	/** Unset for FAILED: no scanner reported anything. */
	readonly scanStatus: StoredObjectScanStatus | null;
	readonly scannedAt: EpochMs | null;
	readonly scanResult: string;
	/** Only for READY. */
	readonly promoted: PromotedObject | null;
	/** Only for READY images with pixel rules. */
	readonly renditions: readonly FileRenditionRecord[];
}

/** A stored copy that belongs to the file and goes with it on delete. */
export interface StoredFileObject {
	readonly slot: FileVariantKind;
	readonly locator: StorageObjectLocator;
	readonly publicPath: string | null;
}

export interface StoredFileState {
	readonly id: string;
	readonly category: FileCategory;
	readonly visibility: FileVisibility;
	readonly status: FileStatus;
	readonly isDeleted: boolean;
	readonly uploadedById: string;
	readonly organizationId: string | null;
	readonly productId: string | null;
	readonly expectedChecksum: string;
	/** The original upload's current location and public copy. */
	readonly original: StoredFileObject;
	/** Live renditions. Loaded only when the file is locked for deletion; empty otherwise. */
	readonly renditions: readonly StoredFileObject[];
}

/** What a new upload request records. */
export interface RequestedUpload {
	readonly id: string;
	readonly category: FileCategory;
	readonly visibility: FileVisibility;
	readonly uploadedById: string;
	readonly organizationId: string | null;
	readonly productId: string | null;
	readonly expectedChecksum: string;
	readonly original: StoredFileObject;
	readonly upload: UploadDescription;
}

/** What the uploader declared about the bytes (stored with the new row; verified at completion). */
export interface UploadDescription {
	readonly originalName: string;
	readonly mimeType: string;
	readonly sizeBytes: number;
	readonly expectedChecksum: string;
}

/** The one change an aggregate carries until it is saved. */
export type StoredFileChange =
	| { readonly kind: "none" }
	| { readonly kind: "requested"; readonly upload: UploadDescription }
	| { readonly kind: "claimed-for-scan"; readonly verified: VerifiedUpload }
	| { readonly kind: "verdict"; readonly outcome: FileVerdictOutcome; readonly record: VerdictRecord }
	| { readonly kind: "deleted"; readonly deletedBy: string; readonly deletedAt: EpochMs };

type StoredFileEvent = FileVerdictReached | FileDeleted;

/** The facts the completion pre-checks read (an aggregate or a read view). */
export interface CompletableUpload {
	readonly uploadedById: string;
	readonly status: FileStatus;
	readonly expectedChecksum: string;
}

/**
 * The cheap checks before the stored bytes are read: only the uploader
 * completes, only once, and only with the checksum the ticket was issued for.
 */
export function assertUploadCompletable(upload: CompletableUpload, uploaderId: string, checksumSha256: string): void {
	if (upload.uploadedById !== uploaderId) {
		throw new FileUploadForbiddenError();
	}
	if (upload.status !== "PENDING") {
		throw new FileUploadAlreadyCompletedError();
	}
	if (upload.expectedChecksum !== checksumSha256) {
		throw new FileChecksumMismatchError();
	}
}

/**
 * The stored-file lifecycle and its invariants:
 * PENDING (ticket issued) → SCANNING (bytes verified, claimed once) →
 * READY | QUARANTINED | FAILED (the verdict, applied once) → DELETED (soft delete).
 *
 * Every transition is saved with a compare-and-set on the status the file was
 * loaded in ({@link concurrencyToken}), so a redelivered job, a replayed
 * callback or a delete racing a scan can never apply a transition twice or
 * resurrect a deleted / quarantined file.
 */
export class StoredFileAggregate extends AggregateRoot<StoredFileEvent> {
	private change: StoredFileChange = { kind: "none" };

	private constructor(
		private state: StoredFileState,
		private readonly loadedStatus: FileStatus | null,
	) {
		super();
	}

	/** A new upload, PENDING until its bytes are verified. */
	public static request(input: RequestedUpload): StoredFileAggregate {
		const { upload, ...facts } = input;
		const aggregate = new StoredFileAggregate({ ...facts, status: "PENDING", isDeleted: false, renditions: [] }, null);
		aggregate.change = { kind: "requested", upload };
		return aggregate;
	}

	/** Used only by the persistence mapper. Rejects any row that breaks an invariant. */
	public static rehydrate(state: StoredFileState): StoredFileAggregate {
		const status = FileStatusSchema.safeParse(state.status);
		const category = FileCategorySchema.safeParse(state.category);
		const visibility = FileVisibilitySchema.safeParse(state.visibility);
		if (!status.success || !category.success || !visibility.success) {
			throw new CorruptStoredFileStateError(state.id);
		}
		// Soft delete always sets both: a live row in DELETED, or a deleted row in any other status, is corrupt.
		if (state.isDeleted !== (status.data === "DELETED")) {
			throw new CorruptStoredFileStateError(state.id);
		}
		return new StoredFileAggregate(state, status.data);
	}

	public get id(): string {
		return this.state.id;
	}

	public get category(): FileCategory {
		return this.state.category;
	}

	public get visibility(): FileVisibility {
		return this.state.visibility;
	}

	public get status(): FileStatus {
		return this.state.status;
	}

	public get uploadedById(): string {
		return this.state.uploadedById;
	}

	public get organizationId(): string | null {
		return this.state.organizationId;
	}

	public get productId(): string | null {
		return this.state.productId;
	}

	public get original(): StoredFileObject {
		return this.state.original;
	}

	/** The status the file was loaded in; `null` for a file that is not persisted yet. */
	public get concurrencyToken(): FileStatus | null {
		return this.loadedStatus;
	}

	public get pendingChange(): StoredFileChange {
		return this.change;
	}

	public get isAwaitingVerdict(): boolean {
		return AWAITING_VERDICT_STATUSES.includes(this.state.status);
	}

	/** See {@link assertUploadCompletable}. */
	public assertCompletableBy(uploaderId: string, checksumSha256: string): void {
		assertUploadCompletable(this.state, uploaderId, checksumSha256);
	}

	/** PENDING → SCANNING with what verification read from the bytes. */
	public claimForScan(uploaderId: string, checksumSha256: string, verified: VerifiedUpload): void {
		this.assertCompletableBy(uploaderId, checksumSha256);
		this.state = { ...this.state, status: "SCANNING" };
		this.change = { kind: "claimed-for-scan", verified };
	}

	/** SCANNING → the verdict. Records {@link FileVerdictReached} for the owners' in-transaction handlers. */
	public reachVerdict(outcome: FileVerdictOutcome, record: VerdictRecord, now: EpochMs): void {
		if (!this.isAwaitingVerdict) {
			throw new FileStateConflictError(`File is ${this.state.status}, not awaiting a processing result`);
		}
		this.state = { ...this.state, status: outcome };
		this.change = { kind: "verdict", outcome, record };
		this.record(new FileVerdictReached(now, this.state.id, this.state.category, this.state.organizationId, this.state.uploadedById, outcome, this.state.productId));
	}

	/**
	 * Soft-deletes the file. Records {@link FileDeleted} with every stored copy
	 * (the original and the renditions loaded with it), so owners release their
	 * rows in the same transaction and the copies are withdrawn and purged after commit.
	 */
	public delete(deletedBy: string, now: EpochMs): void {
		this.state = { ...this.state, status: "DELETED", isDeleted: true };
		this.change = { kind: "deleted", deletedBy, deletedAt: now };
		const objects: DeletedFileObject[] = [this.state.original, ...this.state.renditions].map((object: StoredFileObject): DeletedFileObject => ({
			slot: object.slot,
			locator: object.locator,
			// A private original may carry no public copy; a public file's copy exists once it was published.
			published: object.publicPath !== null && (object.slot !== "ORIGINAL" || this.state.visibility === "PUBLIC"),
		}));
		this.record(new FileDeleted(now, this.state.id, this.state.category, this.state.organizationId, deletedBy, objects));
	}
}
