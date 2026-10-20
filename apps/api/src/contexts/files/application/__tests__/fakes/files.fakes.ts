// TEST-ONLY real implementations of the files ports (no vi.fn stubs of the subject).
import type {
	CreateFileUploadUrlInput,
	CreateFileUploadUrlResponse,
	EpochMs,
	FileCategory,
	FileDownloadDisposition,
	FileDownloadResponse,
	FileStatus,
	FileVariantKind,
	StorageCdnInvalidationJob,
	StorageDeleteJob,
	StorageObjectLocator,
} from "@workspace/shared";
import { epochMs } from "@workspace/shared";

import { ActorContextSchema, actingUserId, systemActor, type ActorContext } from "../../../../../platform/application/actor-context";
import { TransactionalEventCollector } from "../../../../../platform/application/events/transactional-event-collector";
import { StoredFileAggregate, type StoredFileState, type VerifiedUpload } from "../../../domain/aggregates/stored-file.aggregate";
import type { StoredFileRepository, StoredFileSaveOutcome } from "../../../domain/repositories/stored-file.repository";
import type { FilesScope } from "../../files-scope";
import type { FileAccessAction, FileAccessSubject, FileActor, FileCategoryAccessRule } from "../../ports/file-category-access.port";
import type { FileObjectStoragePort, UploadTicketRequest } from "../../ports/file-object-storage.port";
import type { FileReferenceBlock, FileReferenceSubject } from "../../ports/file-reference.port";
import type { StoredFileReadPort, StoredFileView } from "../../ports/stored-file-read.port";
import { StorageTaskDispatcher } from "../../ports/storage-task-dispatcher.port";

export const FILE_ID = "0b7c2a5e-6f1d-4c2e-9d3a-1f2e3d4c5b6a";
export const OTHER_FILE_ID = "1c8d3b6f-7a2e-4d3f-8e4b-2a3f4e5d6c7b";
export const UPLOADER_ID = "11111111-1111-4111-8111-111111111111";
export const OTHER_USER_ID = "33333333-3333-4333-8333-333333333333";
export const ORG_ID = "22222222-2222-4222-8222-222222222222";
export const CHECKSUM = "a".repeat(64);
export const NOW: EpochMs = epochMs(1_800_000_000_000);
const CONTAINER = "local-private-bucket";

export function locator(path: string): StorageObjectLocator {
	return { provider: "local", container: CONTAINER, path, revision: null };
}

export function storedFileState(overrides: Partial<StoredFileState> = {}): StoredFileState {
	return {
		id: FILE_ID,
		category: "MERCHANT_KYB",
		visibility: "PRIVATE",
		status: "PENDING",
		isDeleted: false,
		uploadedById: UPLOADER_ID,
		tenantId: ORG_ID,
		productId: null,
		expectedChecksum: CHECKSUM,
		original: { slot: "ORIGINAL", locator: locator(`staging/kyb/${ORG_ID}/${FILE_ID}-licence.pdf`), publicPath: null },
		renditions: [],
		...overrides,
	};
}

export function viewOf(state: StoredFileState): StoredFileView {
	return {
		id: state.id,
		category: state.category,
		visibility: state.visibility,
		status: state.status,
		uploadedById: state.uploadedById,
		tenantId: state.tenantId,
		productId: state.productId,
		originalName: "licence.pdf",
		mimeType: "application/pdf",
		sizeBytes: 22,
		expectedChecksum: state.expectedChecksum,
		locator: state.original.locator,
		publicPath: state.original.publicPath,
		updatedAt: NOW,
		record: {
			id: state.id,
			category: state.category,
			visibility: state.visibility,
			originalName: "licence.pdf",
			mimeType: "application/pdf",
			sizeBytes: 22,
			status: state.status,
			scanStatus: null,
			publicUrl: null,
			uploadedAt: NOW,
		},
	};
}

/** Stored files with the repository's compare-and-set semantics on the status the aggregate was loaded in. */
export class InMemoryStoredFiles implements StoredFileRepository {
	public readonly rows = new Map<string, StoredFileState>();
	public readonly added: StoredFileAggregate[] = [];
	public readonly verified: VerifiedUpload[] = [];
	public readonly deletedBy: string[] = [];
	public readonly locked: string[] = [];
	/** A concurrent writer changes the row between load and save. */
	public raceOnNextSave = false;

	public constructor(...states: StoredFileState[]) {
		for (const state of states) {
			this.rows.set(state.id, state);
		}
	}

	public add(file: StoredFileAggregate): Promise<void> {
		this.added.push(file);
		this.rows.set(file.id, {
			id: file.id,
			category: file.category,
			visibility: file.visibility,
			status: "PENDING",
			isDeleted: false,
			uploadedById: file.uploadedById,
			tenantId: file.tenantId,
			productId: file.productId,
			expectedChecksum: CHECKSUM,
			original: file.original,
			renditions: [],
		});
		return Promise.resolve();
	}

	public findLive(fileId: string): Promise<StoredFileAggregate | null> {
		const row = this.rows.get(fileId);
		return Promise.resolve(row === undefined || row.isDeleted ? null : StoredFileAggregate.rehydrate({ ...row, renditions: [] }));
	}

	public lockForDeletion(fileId: string): Promise<StoredFileAggregate | null> {
		this.locked.push(fileId);
		const row = this.rows.get(fileId);
		return Promise.resolve(row === undefined || row.isDeleted ? null : StoredFileAggregate.rehydrate(row));
	}

	public save(file: StoredFileAggregate): Promise<StoredFileSaveOutcome> {
		const row = this.rows.get(file.id);
		if (this.raceOnNextSave || row === undefined || row.isDeleted || row.status !== file.concurrencyToken) {
			this.raceOnNextSave = false;
			return Promise.resolve("lost-race");
		}
		const change = file.pendingChange;
		if (change.kind === "claimed-for-scan") {
			this.verified.push(change.verified);
		}
		if (change.kind === "deleted") {
			this.deletedBy.push(change.deletedBy);
		}
		this.rows.set(file.id, { ...row, status: file.status, isDeleted: file.status === "DELETED" });
		return Promise.resolve("applied");
	}

	public status(fileId: string): FileStatus | undefined {
		return this.rows.get(fileId)?.status;
	}
}

/** Reads over the same in-memory rows; a file the actor "cannot see" is listed in `hiddenFrom`. */
export class InMemoryStoredFileReads implements StoredFileReadPort {
	public stalePending: StoredFileView[] = [];
	public staleAwaitingVerdict: StoredFileView[] = [];
	public readonly expiredStaging = new Map<FileCategory, StoredFileView[]>();
	public readonly hidden = new Set<string>();

	public constructor(private readonly files: InMemoryStoredFiles) {}

	public findLive(_actor: ActorContext, fileId: string): Promise<StoredFileView | null> {
		const row = this.files.rows.get(fileId);
		return Promise.resolve(row === undefined || row.isDeleted || this.hidden.has(fileId) ? null : viewOf(row));
	}

	/** The actor's own upload, seen or not by its RLS scope (only the uploader's id decides). */
	public findOwnUpload(actor: ActorContext, fileId: string): Promise<StoredFileView | null> {
		const row = this.files.rows.get(fileId);
		return Promise.resolve(row === undefined || row.isDeleted || row.uploadedById !== actingUserId(actor) ? null : viewOf(row));
	}

	public listStalePending(): Promise<readonly StoredFileView[]> {
		return Promise.resolve(this.stalePending);
	}

	public listStaleAwaitingVerdict(): Promise<readonly StoredFileView[]> {
		return Promise.resolve(this.staleAwaitingVerdict);
	}

	public listExpiredStaging(_actor: ActorContext, category: FileCategory): Promise<readonly StoredFileView[]> {
		return Promise.resolve(this.expiredStaging.get(category) ?? []);
	}
}

/** Records every dispatch instead of running it. */
export class RecordingStorageTaskDispatcher extends StorageTaskDispatcher {
	public readonly scans: string[] = [];
	public readonly redispatched: string[] = [];
	public readonly deletes: { readonly job: StorageDeleteJob; readonly slot: FileVariantKind }[] = [];
	public readonly cdnInvalidations: StorageCdnInvalidationJob[] = [];
	public failRedispatchFor: string | null = null;

	public dispatchScan(fileId: string): Promise<void> {
		this.scans.push(fileId);
		return Promise.resolve();
	}

	public redispatchScan(fileId: string): Promise<void> {
		if (fileId === this.failRedispatchFor) {
			return Promise.reject(new Error("queue down"));
		}
		this.redispatched.push(fileId);
		return Promise.resolve();
	}

	public dispatchPhysicalDelete(job: StorageDeleteJob, slot: FileVariantKind): Promise<void> {
		this.deletes.push({ job, slot });
		return Promise.resolve();
	}

	public dispatchCdnInvalidation(job: StorageCdnInvalidationJob): Promise<void> {
		this.cdnInvalidations.push(job);
		return Promise.resolve();
	}
}

/** Object storage as the use cases see it. Verification answers with `verification` (or throws `verificationError`). */
export class FakeFileObjectStorage implements FileObjectStoragePort {
	public readonly tickets: UploadTicketRequest[] = [];
	public readonly verifiedChecksums: string[] = [];
	public readonly withdrawn: string[] = [];
	public readonly deleted: string[] = [];
	public verification: VerifiedUpload = { actualChecksum: CHECKSUM, objectRevision: "rev-1", imageWidth: null, imageHeight: null };
	public verificationError: Error | null = null;
	/** CDN keys a withdrawal reports per path (S3 + CloudFront behaviour). */
	public readonly cachedKeys = new Map<string, readonly string[]>();
	public failWithdrawal = false;

	public stagingLocator(input: CreateFileUploadUrlInput, fileId: string, ownerId: string): StorageObjectLocator {
		return locator(`staging/${input.category.toLowerCase()}/${ownerId}/${fileId}-${input.fileName}`);
	}

	public issueUploadTicket(request: UploadTicketRequest): Promise<CreateFileUploadUrlResponse> {
		this.tickets.push(request);
		return Promise.resolve({
			fileId: request.fileId,
			objectPath: request.locator.path,
			expiresIn: 300,
			method: "PUT",
			uploadUrl: `https://storage.test/${request.locator.path}`,
		});
	}

	public verifyUpload(_file: StoredFileView, checksumSha256: string): Promise<VerifiedUpload> {
		this.verifiedChecksums.push(checksumSha256);
		return this.verificationError === null ? Promise.resolve(this.verification) : Promise.reject(this.verificationError);
	}

	public createDownloadUrl(file: StoredFileView, _disposition: FileDownloadDisposition): Promise<FileDownloadResponse> {
		return Promise.resolve(
			file.status === "READY"
				? { fileId: file.id, status: file.status, downloadUrl: `https://storage.test/${file.id}`, expiresAt: NOW }
				: { fileId: file.id, status: file.status, downloadUrl: null, expiresAt: null },
		);
	}

	public withdrawPublicCopy(_fileId: string, copy: StorageObjectLocator): Promise<readonly string[]> {
		if (this.failWithdrawal) {
			return Promise.reject(new Error("CDN origin unavailable"));
		}
		this.withdrawn.push(copy.path);
		return Promise.resolve(this.cachedKeys.get(copy.path) ?? []);
	}

	public deleteObject(copy: StorageObjectLocator): Promise<void> {
		this.deleted.push(copy.path);
		return Promise.resolve();
	}
}

/** An owner's access rule that allows, or denies with the given error, and records what it was asked. */
export class RecordingAccessRule implements FileCategoryAccessRule {
	public readonly uploads: { readonly actor: FileActor; readonly request: CreateFileUploadUrlInput }[] = [];
	public readonly acts: { readonly actor: FileActor; readonly file: FileAccessSubject; readonly action: FileAccessAction }[] = [];
	public denial: Error | null = null;

	public constructor(public readonly categories: readonly FileCategory[]) {}

	public assertCanUpload(actor: FileActor, request: CreateFileUploadUrlInput): Promise<void> {
		this.uploads.push({ actor, request });
		return this.denial === null ? Promise.resolve() : Promise.reject(this.denial);
	}

	public assertCanAct(actor: FileActor, file: FileAccessSubject, action: FileAccessAction): Promise<void> {
		this.acts.push({ actor, file, action });
		return this.denial === null ? Promise.resolve() : Promise.reject(this.denial);
	}
}

/** A files scope over the in-memory rows; `blocks` answers the owners' reference guards per file id. */
export function filesScope(files: InMemoryStoredFiles, blocks: ReadonlyMap<string, FileReferenceBlock> = new Map()): FilesScope {
	return {
		storedFiles: files,
		references: { blockDelete: (subject: FileReferenceSubject): Promise<FileReferenceBlock | null> => Promise.resolve(blocks.get(subject.fileId) ?? null) },
		events: new TransactionalEventCollector(),
	};
}

export function userActor(userId: string = UPLOADER_ID, isSuperAdmin = false): ActorContext {
	return ActorContextSchema.parse({
		kind: "user",
		userId,
		sessionId: "session-1",
		tenantId: null,
		isSuperAdmin,
		accessScope: "tenant",
		impersonatorUserId: null,
		request: { requestId: "request-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null },
	});
}

export function cleanupActor(): ActorContext {
	return systemActor("queue.storage.cleanup", "job", null, "test sweep", null);
}
