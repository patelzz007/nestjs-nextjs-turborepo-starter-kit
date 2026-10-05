import { createHash } from "node:crypto";
import { createReadStream, type Stats } from "node:fs";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Readable } from "node:stream";

import { apiPath, type StorageObjectLocator } from "@workspace/shared";

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
import type { PublicAssetPublicationInput, PublicAssetPublicationResult, PublicAssetWithdrawalResult, PublicDelivery } from "../../domain/public-delivery.port";
import { digestStream } from "../../utils/object-stream.util";
import { resolveLocalObjectPath } from "./local-object-path.util";
import { LocalTransferTokenService } from "./local-transfer-token.service";

/** Directory (under the API's working directory) that holds every local container. */
export const LOCAL_STORAGE_ROOT: string = join(process.cwd(), ".object-storage");

/** Length of the content-derived revision id (hex characters of the SHA-256). */
const REVISION_HEX_LENGTH = 16;
const NOT_FOUND_ERROR_CODE = "ENOENT";

/** Multipart form field names of a local upload ticket. */
export const LOCAL_UPLOAD_KEY_FIELD = "key";
export const LOCAL_UPLOAD_TOKEN_FIELD = "token";
/** Query parameter of a local download URL. */
export const LOCAL_DOWNLOAD_TOKEN_PARAM = "token";

function isNotFoundError(error: Error): boolean {
	return "code" in error && error.code === NOT_FOUND_ERROR_CODE;
}

/** `null` for a missing file; every other filesystem failure propagates. */
async function nullWhenMissing<T>(operation: () => Promise<T>): Promise<T | null> {
	try {
		return await operation();
	} catch (error) {
		if (error instanceof Error && isNotFoundError(error)) {
			return null;
		}
		throw error;
	}
}

/**
 * Development-only object storage on the local disk (production rejects
 * STORAGE_PROVIDER=local). Every path is confined to {@link LOCAL_STORAGE_ROOT}
 * and every upload/download URL carries an expiring, signed capability token
 * (see {@link LocalTransferTokenService}) — the local equivalent of a presigned URL.
 */
export class LocalObjectStorageAdapter implements ObjectStorage, PublicDelivery {
	public constructor(
		private readonly config: TypedConfigService,
		private readonly tokens: LocalTransferTokenService,
		private readonly root: string = LOCAL_STORAGE_ROOT,
	) {}

	public async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
		const absolutePath = this.resolvePath(input.locator);
		await mkdir(dirname(absolutePath), { recursive: true });
		await writeFile(absolutePath, input.buffer);
		const revision = createHash("sha256").update(input.buffer).digest("hex").slice(0, REVISION_HEX_LENGTH);
		return { locator: { ...input.locator, revision }, revision };
	}

	public async getObject(locator: StorageObjectLocator): Promise<Buffer | null> {
		const absolutePath = this.resolvePath(locator);
		return nullWhenMissing(async (): Promise<Buffer> => readFile(absolutePath));
	}

	public async getObjectStream(locator: StorageObjectLocator): Promise<Readable | null> {
		const absolutePath = this.resolvePath(locator);
		const stats = await nullWhenMissing(async (): Promise<Stats> => stat(absolutePath));
		if (stats?.isFile() !== true) {
			return null;
		}
		return createReadStream(absolutePath);
	}

	public async deleteObject(locator: StorageObjectLocator): Promise<void> {
		await rm(this.resolvePath(locator), { force: true });
	}

	public async copyObject(source: StorageObjectLocator, destination: StorageObjectLocator): Promise<StorageUploadResult> {
		const destinationPath = this.resolvePath(destination);
		await mkdir(dirname(destinationPath), { recursive: true });
		await copyFile(this.resolvePath(source), destinationPath);
		const revision = await this.revisionOf(destinationPath);
		return { locator: { ...destination, revision }, revision };
	}

	public getSignedDownloadUrl(input: StorageSignedUrlInput): Promise<string> {
		// Deferred so an invalid locator surfaces as a rejected promise, like every other provider error.
		return Promise.resolve().then((): string => this.signedDownloadUrl(input));
	}

	public createBrowserUploadTicket(input: StorageBrowserUploadTicketInput): Promise<StorageBrowserUploadTicketResult> {
		return Promise.resolve().then((): StorageBrowserUploadTicketResult => this.uploadTicket(input));
	}

	private signedDownloadUrl(input: StorageSignedUrlInput): string {
		this.resolvePath(input.locator);
		const token = this.tokens.signDownload(
			{
				fileId: input.fileId,
				container: input.locator.container,
				path: input.locator.path,
				disposition: input.disposition ?? null,
				fileName: input.fileName ?? null,
			},
			input.expiresInSeconds,
		);
		const query = new URLSearchParams({ [LOCAL_DOWNLOAD_TOKEN_PARAM]: token });
		return `${this.config.http.publicUrl}${apiPath("/files")}/local-download?${query.toString()}`;
	}

	private uploadTicket(input: StorageBrowserUploadTicketInput): StorageBrowserUploadTicketResult {
		const fileId = input.metadata?.fileId;
		if (fileId === undefined) {
			throw new Error("Local upload tickets are bound to a file id (metadata.fileId)");
		}
		this.resolvePath(input.locator);
		const token = this.tokens.signUpload(
			{
				fileId,
				container: input.locator.container,
				path: input.locator.path,
				maxBytes: input.maxBytes,
				mimeType: input.mimeType,
				checksumSha256: input.checksumSha256,
			},
			input.expiresInSeconds,
		);
		return {
			method: "POST_MULTIPART",
			uploadUrl: `${this.config.http.publicUrl}${apiPath("/files")}/${encodeURIComponent(fileId)}/local-upload`,
			fields: {
				[LOCAL_UPLOAD_KEY_FIELD]: input.locator.path,
				[LOCAL_UPLOAD_TOKEN_FIELD]: token,
			},
		};
	}

	public async headObject(locator: StorageObjectLocator): Promise<StorageHeadObjectResult | null> {
		const stream = await this.getObjectStream(locator);
		if (stream === null) {
			return null;
		}
		const digest = await digestStream(stream);
		return {
			sizeBytes: digest.sizeBytes,
			mimeType: null,
			checksumSha256Hex: digest.sha256Hex,
			revision: digest.sha256Hex.slice(0, REVISION_HEX_LENGTH),
		};
	}

	/**
	 * Public assets are served by file id (`GET /files/:fileId/local-public`), which
	 * looks the file up and only serves READY public files — never a raw path.
	 */
	public publishAsset(input: PublicAssetPublicationInput): Promise<PublicAssetPublicationResult> {
		return Promise.resolve({
			publicUrl: `${this.config.http.publicUrl}${apiPath("/files")}/${encodeURIComponent(input.fileId)}/local-public`,
			revision: input.locator.revision ?? null,
		});
	}

	/**
	 * Nothing to withdraw: `local-public` looks the file up on every request and
	 * serves only live READY public files, so a deleted file stops being served
	 * the moment its row changes.
	 */
	public unpublishAsset(): Promise<PublicAssetWithdrawalResult> {
		return Promise.resolve({ cachedObjectKeys: [] });
	}

	private async revisionOf(absolutePath: string): Promise<string> {
		const digest = await digestStream(createReadStream(absolutePath));
		return digest.sha256Hex.slice(0, REVISION_HEX_LENGTH);
	}

	private resolvePath(locator: StorageObjectLocator): string {
		return resolveLocalObjectPath(this.root, locator.container, locator.path);
	}
}
