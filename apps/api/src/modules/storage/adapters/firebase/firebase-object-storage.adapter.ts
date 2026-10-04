import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";

import type { StorageObjectLocator } from "@workspace/shared";
import { applicationDefault, getApps, initializeApp, type App } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

import { TypedConfigService } from "../../../../config/typed-config.service";
import type {
	ObjectStorage,
	StorageBrowserUploadTicketInput,
	StorageBrowserUploadTicketResult,
	StorageHeadObjectResult,
	StorageSignedUrlInput,
	StorageUploadInput,
	StorageUploadResult,
} from "../../domain/object-storage.port";
import type {
	PublicAssetPublicationInput,
	PublicAssetPublicationResult,
	PublicAssetWithdrawalInput,
	PublicAssetWithdrawalResult,
	PublicDelivery,
} from "../../domain/public-delivery.port";

interface GcsObjectMetadata {
	readonly size?: string | number;
	readonly contentType?: string;
	readonly generation?: string | number;
}

interface GcsBucketFile {
	save(data: Buffer, options: { contentType: string; metadata: { metadata: Record<string, string> } }): Promise<void>;
	getMetadata(): Promise<[GcsObjectMetadata]>;
	download(): Promise<[Buffer]>;
	exists(): Promise<[boolean]>;
	createReadStream(): Readable;
	delete(options: { ignoreNotFound: boolean }): Promise<void>;
	copyTo(destination: StorageObjectLocator): Promise<GcsBucketFile>;
	getSignedUrl(config: {
		action: "read" | "write";
		expires: number;
		contentType?: string;
		responseDisposition?: string;
		extensionHeaders?: Record<string, string>;
	}): Promise<[string]>;
	/** A `null` custom-metadata value removes that key. */
	setMetadata(metadata: { metadata?: Record<string, string | null>; contentType?: string; contentDisposition?: string }): Promise<void>;
}

const HTTP_NOT_FOUND = 404;
/** Custom metadata key whose token makes an object readable through the Firebase download URL. */
const FIREBASE_DOWNLOAD_TOKENS_KEY = "firebaseStorageDownloadTokens";

/** Google Cloud Storage reports a missing object as an ApiError with HTTP code 404. */
function isMissingObjectError(error: Error): boolean {
	return "code" in error && error.code === HTTP_NOT_FOUND;
}

export class FirebaseObjectStorageAdapter implements ObjectStorage, PublicDelivery {
	private readonly firebaseApp: App;

	public constructor(private readonly config: TypedConfigService) {
		const projectId = this.config.firebaseProjectId;
		const bucketName = this.config.firebaseStorageBucket ?? this.config.storagePrivateBucket;
		if (projectId === null) {
			throw new Error("FIREBASE_PROJECT_ID is required when STORAGE_PROVIDER=firebase");
		}
		const existingApps = getApps();
		this.firebaseApp =
			existingApps.at(0) ??
			initializeApp({
				projectId,
				storageBucket: bucketName,
				credential: applicationDefault(),
			});
	}

	public async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
		const file = this.bucketFile(input.locator);
		await file.save(input.buffer, {
			contentType: input.mimeType,
			metadata: {
				metadata: input.metadata ?? {},
			},
		});
		const [metadata] = await file.getMetadata();
		const revision = revisionFromMetadata(metadata);
		return { locator: { ...input.locator, revision }, revision };
	}

	public async getObject(locator: StorageObjectLocator): Promise<Buffer | null> {
		try {
			const [buffer] = await this.bucketFile(locator).download();
			return buffer;
		} catch (error) {
			if (error instanceof Error && isMissingObjectError(error)) {
				return null;
			}
			throw error;
		}
	}

	public async getObjectStream(locator: StorageObjectLocator): Promise<Readable | null> {
		const file = this.bucketFile(locator);
		const [exists] = await file.exists();
		if (!exists) {
			return null;
		}
		return file.createReadStream();
	}

	public async deleteObject(locator: StorageObjectLocator): Promise<void> {
		await this.bucketFile(locator).delete({ ignoreNotFound: true });
	}

	public async copyObject(source: StorageObjectLocator, destination: StorageObjectLocator): Promise<StorageUploadResult> {
		const copied = await this.bucketFile(source).copyTo(destination);
		const [metadata] = await copied.getMetadata();
		const revision = revisionFromMetadata(metadata);
		return { locator: { ...destination, revision }, revision };
	}

	public async getSignedDownloadUrl(input: StorageSignedUrlInput): Promise<string> {
		const [url] = await this.bucketFile(input.locator).getSignedUrl({
			action: "read",
			expires: Date.now() + input.expiresInSeconds * 1000,
			...(input.disposition !== undefined && input.fileName !== undefined
				? { responseDisposition: `${input.disposition}; filename="${input.fileName.replaceAll('"', "_")}"` }
				: {}),
		});
		return url;
	}

	public async createBrowserUploadTicket(input: StorageBrowserUploadTicketInput): Promise<StorageBrowserUploadTicketResult> {
		const [url] = await this.bucketFile(input.locator).getSignedUrl({
			action: "write",
			expires: Date.now() + input.expiresInSeconds * 1000,
			contentType: input.mimeType,
			extensionHeaders: {
				"x-goog-meta-file-id": input.metadata?.fileId ?? "",
				"x-goog-meta-category": input.metadata?.category ?? "",
				"x-goog-meta-uploaded-by-id": input.metadata?.uploadedById ?? "",
			},
		});
		return {
			method: "PUT",
			uploadUrl: url,
			headers: {
				"Content-Type": input.mimeType,
			},
		};
	}

	public async headObject(locator: StorageObjectLocator): Promise<StorageHeadObjectResult | null> {
		try {
			const [metadata] = await this.bucketFile(locator).getMetadata();
			return {
				sizeBytes: Number(metadata.size ?? 0),
				mimeType: metadata.contentType ?? null,
				checksumSha256Hex: null,
				revision: revisionFromMetadata(metadata),
			};
		} catch (error) {
			if (error instanceof Error && isMissingObjectError(error)) {
				return null;
			}
			throw error;
		}
	}

	public async publishAsset(input: PublicAssetPublicationInput): Promise<PublicAssetPublicationResult> {
		const downloadToken = randomUUID();
		const file = this.bucketFile(input.locator);
		await file.setMetadata({
			metadata: {
				[FIREBASE_DOWNLOAD_TOKENS_KEY]: downloadToken,
			},
			contentType: input.mimeType,
			contentDisposition: `inline; filename="${input.fileName.replaceAll('"', "_")}"`,
		});
		const bucketName = this.config.firebaseStorageBucket ?? this.config.storagePrivateBucket;
		const encodedPath = encodeURIComponent(input.locator.path);
		return {
			publicUrl: `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`,
			revision: input.locator.revision ?? null,
		};
	}

	/** Revokes the download token, so the published Firebase URL stops working at once (no CDN cache to purge). */
	public async unpublishAsset(input: PublicAssetWithdrawalInput): Promise<PublicAssetWithdrawalResult> {
		try {
			await this.bucketFile(input.locator).setMetadata({ metadata: { [FIREBASE_DOWNLOAD_TOKENS_KEY]: null } });
		} catch (error) {
			if (!(error instanceof Error && isMissingObjectError(error))) {
				throw error;
			}
		}
		return { cachedObjectKeys: [] };
	}

	private bucketFile(locator: StorageObjectLocator): GcsBucketFile {
		return createBucketFileAdapter(this.firebaseApp, locator);
	}
}

function createBucketFileAdapter(app: App, locator: StorageObjectLocator): GcsBucketFile {
	const nativeFile = getStorage(app).bucket(locator.container).file(locator.path);
	return {
		save: async (data, options): Promise<void> => {
			await nativeFile.save(data, options);
		},
		getMetadata: async (): Promise<[GcsObjectMetadata]> => {
			const [metadata] = await nativeFile.getMetadata();
			return [metadata];
		},
		download: (): Promise<[Buffer]> => nativeFile.download(),
		exists: (): Promise<[boolean]> => nativeFile.exists(),
		createReadStream: (): Readable => nativeFile.createReadStream(),
		delete: async (options): Promise<void> => {
			await nativeFile.delete(options);
		},
		copyTo: async (destination): Promise<GcsBucketFile> => {
			const destinationNative = getStorage(app).bucket(destination.container).file(destination.path);
			const [copiedNative] = await nativeFile.copy(destinationNative);
			return createBucketFileAdapter(app, { ...destination, revision: revisionFromMetadata((await copiedNative.getMetadata())[0]) });
		},
		getSignedUrl: (config): Promise<[string]> => nativeFile.getSignedUrl(config),
		setMetadata: async (metadata): Promise<void> => {
			await nativeFile.setMetadata(metadata);
		},
	};
}

function revisionFromMetadata(metadata: GcsObjectMetadata): string | null {
	return metadata.generation !== undefined ? String(metadata.generation) : null;
}
