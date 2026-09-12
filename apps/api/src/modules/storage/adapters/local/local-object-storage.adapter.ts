import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { StorageObjectLocator } from "@workspace/shared";

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
import type { PublicAssetPublicationInput, PublicAssetPublicationResult, PublicDelivery } from "../../domain/public-delivery.port";

const LOCAL_ROOT = join(process.cwd(), ".object-storage");

export class LocalObjectStorageAdapter implements ObjectStorage, PublicDelivery {
	public constructor(private readonly config: TypedConfigService) {}

	public async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
		const absolutePath = this.resolvePath(input.locator);
		await mkdir(dirname(absolutePath), { recursive: true });
		await writeFile(absolutePath, input.buffer);
		const revision = createHash("sha256").update(input.buffer).digest("hex").slice(0, 16);
		return { locator: { ...input.locator, revision }, revision };
	}

	public async getObject(locator: StorageObjectLocator): Promise<Buffer | null> {
		try {
			return await readFile(this.resolvePath(locator));
		} catch {
			return null;
		}
	}

	public async deleteObject(locator: StorageObjectLocator): Promise<void> {
		await rm(this.resolvePath(locator), { force: true });
	}

	public async copyObject(source: StorageObjectLocator, destination: StorageObjectLocator): Promise<StorageUploadResult> {
		const buffer = await readFile(this.resolvePath(source));
		return this.upload({ locator: destination, buffer, mimeType: "application/pdf" });
	}

	public getSignedDownloadUrl(input: StorageSignedUrlInput): Promise<string> {
		const baseUrl = this.config.apiPublicUrl;
		const encodedPath = encodeURIComponent(input.locator.path);
		return Promise.resolve(`${baseUrl}/api/v1/files/local-download?container=${input.locator.container}&path=${encodedPath}`);
	}

	public createBrowserUploadTicket(input: StorageBrowserUploadTicketInput): Promise<StorageBrowserUploadTicketResult> {
		const baseUrl = this.config.apiPublicUrl;
		const fileId = input.metadata?.fileId ?? "";
		return Promise.resolve({
			method: "POST_MULTIPART",
			uploadUrl: `${baseUrl}/api/v1/files/${fileId}/local-upload`,
			fields: {
				key: input.locator.path,
				"Content-Type": input.mimeType,
				"x-amz-checksum-sha256": input.checksumSha256,
			},
		});
	}

	public async headObject(locator: StorageObjectLocator): Promise<StorageHeadObjectResult | null> {
		try {
			const buffer = await readFile(this.resolvePath(locator));
			const checksumHex = createHash("sha256").update(buffer).digest("hex");
			return {
				sizeBytes: buffer.length,
				mimeType: null,
				checksumSha256Hex: checksumHex,
				revision: createHash("sha256").update(buffer).digest("hex").slice(0, 16),
			};
		} catch {
			return null;
		}
	}

	public publishAsset(input: PublicAssetPublicationInput): Promise<PublicAssetPublicationResult> {
		const baseUrl = this.config.apiPublicUrl;
		const encodedPath = encodeURIComponent(input.locator.path);
		return Promise.resolve({
			publicUrl: `${baseUrl}/api/v1/files/local-download?container=${input.locator.container}&path=${encodedPath}`,
			revision: input.locator.revision ?? null,
		});
	}

	private resolvePath(locator: StorageObjectLocator): string {
		return join(LOCAL_ROOT, locator.container, locator.path);
	}
}
