// TEST-ONLY in-memory collaborators for the file lifecycle specs. They extend
// or implement the real classes/ports, so specs stay fully type-checked.
import { Readable } from "node:stream";

import type { StoredFile } from "@prisma/client";
import type { StorageObjectLocator } from "@workspace/shared";

import type {
	ObjectStorage,
	StorageBrowserUploadTicketInput,
	StorageBrowserUploadTicketResult,
	StorageHeadObjectResult,
	StorageSignedUrlInput,
	StorageStreamUploadInput,
	StorageStreamUploadResult,
	StorageUploadInput,
	StorageUploadResult,
} from "../../src/platform/infrastructure/storage/domain/object-storage.port";
import type {
	PublicAssetPublicationInput,
	PublicAssetPublicationResult,
	PublicAssetWithdrawalInput,
	PublicAssetWithdrawalResult,
	PublicDelivery,
} from "../../src/platform/infrastructure/storage/domain/public-delivery.port";
import { ImageRenditionService } from "../../src/contexts/files/infrastructure/adapters/image-rendition.service";
import { ImageProcessor, UnreadableImageError, type ImageDimensions, type RenderedImage } from "../../src/platform/infrastructure/storage/domain/image-processor.port";
import { LIVE_ROW_FIELDS } from "../../src/platform/infrastructure/persistence/__tests__/base-row-fields";

export const FILE_ID = "0b7c2a5e-6f1d-4c2e-9d3a-1f2e3d4c5b6a";
export const UPLOADER_ID = "11111111-1111-4111-8111-111111111111";
export const ORG_ID = "22222222-2222-4222-8222-222222222222";
export const PDF_BYTES: Buffer = Buffer.from("%PDF-1.7 test document");

export function storedFile(overrides: Partial<StoredFile> = {}): StoredFile {
	return {
		...LIVE_ROW_FIELDS,
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
		imageWidth: null,
		imageHeight: null,
		status: "SCANNING",
		scanStatus: "SCANNING",
		scannedAt: null,
		scanResult: null,
		uploadedById: UPLOADER_ID,
		tenantId: ORG_ID,
		productId: null,
		isDeleted: false,
		deletedAt: null,
		deletedBy: null,
		createdAt: BigInt(1_700_000_000_000),
		updatedAt: BigInt(1_700_000_000_000),
		...overrides,
	};
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

	/** Reads the whole stream into memory (a test fake: the objects are small). */
	public async uploadStream(input: StorageStreamUploadInput): Promise<StorageStreamUploadResult> {
		const chunks: Buffer[] = [];
		for await (const chunk of input.stream) {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
		}
		const bytes: Buffer = Buffer.concat(chunks);
		this.put(input.locator, bytes);
		return { locator: { ...input.locator, revision: "rev" }, revision: "rev", sizeBytes: bytes.length };
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
 * Stands in for sharp: reports the size a test sets and "renders" a tiny
 * buffer per rendition, recording every request — so the image pipeline runs
 * for real against in-memory storage without decoding pixels.
 */
export class FakeImageProcessor extends ImageProcessor {
	public dimensions: ImageDimensions = { width: 3840, height: 2160 };
	public unreadable = false;
	public readonly rendered: ImageDimensions[] = [];

	public inspect(): Promise<ImageDimensions> {
		return this.unreadable ? Promise.reject(new UnreadableImageError({ cause: new Error("fake") })) : Promise.resolve(this.dimensions);
	}

	public render(_bytes: Buffer, width: number, height: number): Promise<RenderedImage> {
		this.rendered.push({ width, height });
		return Promise.resolve({ bytes: Buffer.from(`webp-${String(width)}x${String(height)}`), width, height, mimeType: "image/webp" });
	}
}

/** The real rendition service over in-memory storage and a fake processor. */
export function imageRenditionsFor(storage: InMemoryObjectStorage, processor: ImageProcessor = new FakeImageProcessor()): ImageRenditionService {
	return new ImageRenditionService(storage, storage, processor);
}
