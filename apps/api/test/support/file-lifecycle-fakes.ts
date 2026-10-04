// TEST-ONLY in-memory collaborators for the file lifecycle specs. They extend
// or implement the real classes/ports, so specs stay fully type-checked.
import { Readable } from "node:stream";

import type { Prisma, StoredFile } from "@prisma/client";
import type { FileCategory, FileStatus, StorageObjectLocator } from "@workspace/shared";

import { createTestPrisma } from "./test-service-graph";
import type {
	ObjectStorage,
	StorageBrowserUploadTicketInput,
	StorageBrowserUploadTicketResult,
	StorageHeadObjectResult,
	StorageSignedUrlInput,
	StorageUploadInput,
	StorageUploadResult,
} from "../../src/modules/storage/domain/object-storage.port";
import type {
	PublicAssetPublicationInput,
	PublicAssetPublicationResult,
	PublicAssetWithdrawalInput,
	PublicAssetWithdrawalResult,
	PublicDelivery,
} from "../../src/modules/storage/domain/public-delivery.port";
import {
	StoredFileRepository,
	type StoredFileBinding,
	type StoredFileDbClient,
	type StoredFileStatusFields,
} from "../../src/modules/files/repositories/stored-file.repository";
import { RequestContextService } from "../../src/common/context/request-context";
import { FileLifecycleListener, type FileVerdictEvent } from "../../src/modules/files/lifecycle/file-lifecycle-listener";
import { FileLifecycleListenerRegistry } from "../../src/modules/files/lifecycle/file-lifecycle-listener.registry";
import { TenantTransactionService } from "../../src/prisma/tenant-transaction.service";
import type { SystemDatabaseContext } from "../../src/prisma/tenant-context";

export const FILE_ID = "0b7c2a5e-6f1d-4c2e-9d3a-1f2e3d4c5b6a";
export const UPLOADER_ID = "11111111-1111-4111-8111-111111111111";
export const ORG_ID = "22222222-2222-4222-8222-222222222222";
export const PDF_BYTES: Buffer = Buffer.from("%PDF-1.7 test document");

export function storedFile(overrides: Partial<StoredFile> = {}): StoredFile {
	return {
		id: FILE_ID,
		category: "MERCHANT_KYB",
		visibility: "PRIVATE",
		originalName: "licence.pdf",
		mimeType: "application/pdf",
		sizeBytes: PDF_BYTES.length,
		expectedChecksum: "0".repeat(64),
		actualChecksum: null,
		storageProvider: "local",
		storageContainer: "local-private-bucket",
		objectRevision: null,
		storageBucket: "local-private-bucket",
		storagePath: `staging/kyb/${ORG_ID}/${FILE_ID}-licence.pdf`,
		publicPath: null,
		objectGeneration: null,
		status: "SCANNING",
		scanStatus: "SCANNING",
		scannedAt: null,
		scanResult: null,
		uploadedById: UPLOADER_ID,
		organizationId: ORG_ID,
		productId: null,
		isDeleted: false,
		deletedAt: null,
		deletedBy: null,
		createdAt: BigInt(1_700_000_000_000),
		updatedAt: BigInt(1_700_000_000_000),
		...overrides,
	};
}

/** One row store with the repository's conditional-transition semantics. */
export class InMemoryStoredFileRepository extends StoredFileRepository {
	public readonly rows: Map<string, StoredFile> = new Map<string, StoredFile>();
	public readonly bindings: StoredFileBinding[] = [];
	public readonly softDeletedBy: string[] = [];
	public kybSubmitted = false;

	public constructor(...files: StoredFile[]) {
		super(createTestPrisma());
		for (const file of files) {
			this.rows.set(file.id, file);
		}
	}

	public override findById(id: string): Promise<StoredFile | null> {
		const row = this.rows.get(id);
		return Promise.resolve(row === undefined || row.isDeleted ? null : row);
	}

	public override claimPendingForScan(id: string, uploadedById: string, fields: StoredFileStatusFields): Promise<boolean> {
		const row = this.rows.get(id);
		if (row?.status !== "PENDING" || row.uploadedById !== uploadedById || row.isDeleted) {
			return Promise.resolve(false);
		}
		this.apply(row, "SCANNING", { ...fields, scanStatus: "SCANNING" });
		return Promise.resolve(true);
	}

	public override transitionStatus(id: string, from: readonly FileStatus[], to: FileStatus, fields: StoredFileStatusFields = {}): Promise<boolean> {
		const row = this.rows.get(id);
		if (row === undefined || row.isDeleted || !from.includes(row.status)) {
			return Promise.resolve(false);
		}
		this.apply(row, to, fields);
		return Promise.resolve(true);
	}

	public override bindInTx(_tx: StoredFileDbClient, _fileId: string, binding: StoredFileBinding): Promise<void> {
		if (binding.kind !== "NONE") {
			this.bindings.push(binding);
		}
		return Promise.resolve();
	}

	public override softDeleteWithReferences(id: string, deletedBy: string): Promise<boolean> {
		const row = this.rows.get(id);
		if (row === undefined || row.isDeleted) {
			return Promise.resolve(false);
		}
		this.rows.set(id, { ...row, status: "DELETED", isDeleted: true, deletedBy });
		this.softDeletedBy.push(deletedBy);
		return Promise.resolve(true);
	}

	public override hasKybSubmissionReference(): Promise<boolean> {
		return Promise.resolve(this.kybSubmitted);
	}

	private apply(row: StoredFile, status: FileStatus, fields: StoredFileStatusFields): void {
		this.rows.set(row.id, {
			...row,
			status,
			actualChecksum: fields.actualChecksum ?? row.actualChecksum,
			objectGeneration: fields.objectGeneration === undefined ? row.objectGeneration : fields.objectGeneration,
			objectRevision: fields.objectRevision === undefined ? row.objectRevision : fields.objectRevision,
			storagePath: fields.storagePath ?? row.storagePath,
			publicPath: fields.publicPath === undefined ? row.publicPath : fields.publicPath,
			scanStatus: fields.scanStatus ?? row.scanStatus,
			scannedAt: fields.scannedAt ?? row.scannedAt,
			scanResult: fields.scanResult ?? row.scanResult,
		});
	}
}

/** Object store keyed by `container/path`. */
export class InMemoryObjectStorage implements ObjectStorage, PublicDelivery {
	public readonly objects: Map<string, Buffer> = new Map<string, Buffer>();
	public readonly deleted: string[] = [];
	public readonly streamed: string[] = [];
	/** File ids currently published to the public delivery origin. */
	public readonly published: Set<string> = new Set<string>();
	/** File ids withdrawn from public delivery, in order. */
	public readonly unpublished: string[] = [];
	/** Behave like S3 + CloudFront: a withdrawal reports the key as possibly cached at the CDN. */
	public servesThroughCdn = false;

	public put(locator: Pick<StorageObjectLocator, "container" | "path">, bytes: Buffer): void {
		this.objects.set(this.key(locator), bytes);
	}

	public has(container: string, path: string): boolean {
		return this.objects.has(`${container}/${path}`);
	}

	public upload(input: StorageUploadInput): Promise<StorageUploadResult> {
		this.put(input.locator, input.buffer);
		return Promise.resolve({ locator: { ...input.locator, revision: "rev" }, revision: "rev" });
	}

	public getObject(locator: StorageObjectLocator): Promise<Buffer | null> {
		return Promise.resolve(this.objects.get(this.key(locator)) ?? null);
	}

	public getObjectStream(locator: StorageObjectLocator): Promise<Readable | null> {
		const bytes = this.objects.get(this.key(locator));
		this.streamed.push(this.key(locator));
		return Promise.resolve(bytes === undefined ? null : Readable.from([bytes]));
	}

	public deleteObject(locator: StorageObjectLocator): Promise<void> {
		this.objects.delete(this.key(locator));
		this.deleted.push(this.key(locator));
		return Promise.resolve();
	}

	public copyObject(source: StorageObjectLocator, destination: StorageObjectLocator): Promise<StorageUploadResult> {
		const bytes = this.objects.get(this.key(source));
		if (bytes === undefined) {
			return Promise.reject(new Error(`missing source ${this.key(source)}`));
		}
		this.put(destination, bytes);
		return Promise.resolve({ locator: { ...destination, revision: "copied" }, revision: "copied" });
	}

	public getSignedDownloadUrl(input: StorageSignedUrlInput): Promise<string> {
		return Promise.resolve(`https://storage.test/${input.fileId}`);
	}

	public createBrowserUploadTicket(input: StorageBrowserUploadTicketInput): Promise<StorageBrowserUploadTicketResult> {
		return Promise.resolve({ method: "PUT", uploadUrl: `https://storage.test/upload/${input.locator.path}` });
	}

	public headObject(locator: StorageObjectLocator): Promise<StorageHeadObjectResult | null> {
		const bytes = this.objects.get(this.key(locator));
		return Promise.resolve(bytes === undefined ? null : { sizeBytes: bytes.length, mimeType: null, checksumSha256Hex: null, revision: "head" });
	}

	public publishAsset(input: PublicAssetPublicationInput): Promise<PublicAssetPublicationResult> {
		this.published.add(input.fileId);
		return Promise.resolve({ publicUrl: `https://cdn.test/${input.fileId}`, revision: null });
	}

	public unpublishAsset(input: PublicAssetWithdrawalInput): Promise<PublicAssetWithdrawalResult> {
		this.published.delete(input.fileId);
		this.unpublished.push(input.fileId);
		return Promise.resolve({ cachedObjectKeys: this.servesThroughCdn ? [input.locator.path] : [] });
	}

	private key(locator: Pick<StorageObjectLocator, "container" | "path">): string {
		return `${locator.container}/${locator.path}`;
	}
}

/**
 * Runs system-operation work directly on a connection-less client and records
 * which operations were opened. The in-memory repository ignores the client;
 * a handler that throws propagates (as a real rollback would).
 */
export class ImmediateTransactions extends TenantTransactionService {
	public readonly operations: string[] = [];
	private readonly client: Prisma.TransactionClient = createTestPrisma();

	public constructor() {
		super(createTestPrisma(), new RequestContextService());
	}

	public override withSystemOperation<T>(context: SystemDatabaseContext, handler: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
		this.operations.push(context.operation);
		return handler(this.client);
	}
}

/** Records every verdict delivered for its categories. */
export class RecordingFileListener extends FileLifecycleListener {
	public readonly received: FileVerdictEvent[] = [];

	public constructor(public readonly categories: readonly FileCategory[]) {
		super();
	}

	public onVerdict(_tx: Prisma.TransactionClient, event: FileVerdictEvent): Promise<void> {
		this.received.push(event);
		return Promise.resolve();
	}
}

export function listenerRegistry(...listeners: FileLifecycleListener[]): FileLifecycleListenerRegistry {
	return new FileLifecycleListenerRegistry({ getProviders: () => listeners.map((instance: FileLifecycleListener) => ({ instance })) });
}
