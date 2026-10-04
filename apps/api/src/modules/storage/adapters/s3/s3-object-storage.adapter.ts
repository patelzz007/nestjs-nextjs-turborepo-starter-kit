import { Readable } from "node:stream";

import {
	CopyObjectCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	type S3Client,
	S3ServiceException,
	type GetObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageObjectLocator } from "@workspace/shared";

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
import { sha256Base64ToHex, sha256HexToBase64 } from "../../utils/checksum.util";

const HTTP_NOT_FOUND = 404;
/** Server-side encryption applied to every object the API writes (SSE-S3). */
const SERVER_SIDE_ENCRYPTION = "AES256";
/**
 * Cache policy of published public assets. Keys are unique per file (they
 * embed the file id). A withdrawn asset is invalidated at CloudFront, but
 * browsers that already fetched it keep their copy until this expires, so it
 * is bounded to one day rather than marked immutable.
 */
const PUBLIC_ASSET_CACHE_CONTROL = "public, max-age=86400";

/** S3 reports a missing key as a 404 service exception (NoSuchKey on GET, NotFound on HEAD). */
function isMissingObjectError(error: Error): boolean {
	return error instanceof S3ServiceException && error.$metadata.httpStatusCode === HTTP_NOT_FOUND;
}

/** URL-encodes each key segment, keeping the `/` separators (copy sources and public URLs). */
export function encodeObjectKey(path: string): string {
	return path
		.split("/")
		.map((segment: string): string => encodeURIComponent(segment))
		.join("/");
}

/** `x-amz-copy-source` value: `<bucket>/<url-encoded key>` (S3 rejects or misreads unencoded keys with spaces, `+`, `%` …). */
function copySourceOf(locator: StorageObjectLocator): string {
	return `${locator.container}/${encodeObjectKey(locator.path)}`;
}

function revisionFromEtag(etag: string | undefined): string | null {
	return etag !== undefined ? etag.replaceAll('"', "") : null;
}

/** Where public assets are delivered from: the CloudFront origin bucket and the CDN host in front of it. */
export interface S3PublicDeliverySettings {
	/** Bucket CloudFront reads through Origin Access Control (block-all public access). */
	readonly publicContainer: string;
	/** Bare host name of the CloudFront distribution (or its custom domain). */
	readonly cdnHost: string;
}

/**
 * AWS S3 object storage.
 *
 * Every upload lands in the private container. A READY public asset is then
 * published by copying its final object into the public-origin bucket under
 * the same key, and is served from `https://<cdnHost>/<key>`; withdrawing it
 * deletes that copy. The client is built by {@link createS3Client} and signs
 * with whatever the AWS SDK default credential chain resolves (an IAM role in
 * deployments) — this class never sees a credential.
 */
export class S3ObjectStorageAdapter implements ObjectStorage, PublicDelivery {
	public constructor(
		private readonly client: S3Client,
		private readonly delivery: S3PublicDeliverySettings,
	) {}

	public async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
		const result = await this.client.send(
			new PutObjectCommand({
				Bucket: input.locator.container,
				Key: input.locator.path,
				Body: input.buffer,
				ContentType: input.mimeType,
				ServerSideEncryption: SERVER_SIDE_ENCRYPTION,
				Metadata: input.metadata ?? {},
			}),
		);
		const revision = revisionFromEtag(result.ETag);
		return { locator: { ...input.locator, revision }, revision };
	}

	public async getObject(locator: StorageObjectLocator): Promise<Buffer | null> {
		const result = await this.sendGetObject(locator);
		if (result?.Body === undefined) {
			return null;
		}
		const bytes = await result.Body.transformToByteArray();
		return Buffer.from(bytes);
	}

	public async getObjectStream(locator: StorageObjectLocator): Promise<Readable | null> {
		const result = await this.sendGetObject(locator);
		if (result?.Body === undefined) {
			return null;
		}
		// In Node.js the SDK returns the HTTP response body as a Readable.
		if (!(result.Body instanceof Readable)) {
			throw new Error(`S3 GetObject for ${locator.path} did not return a Node.js stream`);
		}
		return result.Body;
	}

	public async deleteObject(locator: StorageObjectLocator): Promise<void> {
		await this.client.send(
			new DeleteObjectCommand({
				Bucket: locator.container,
				Key: locator.path,
			}),
		);
	}

	public async copyObject(source: StorageObjectLocator, destination: StorageObjectLocator): Promise<StorageUploadResult> {
		const result = await this.client.send(
			new CopyObjectCommand({
				Bucket: destination.container,
				Key: destination.path,
				CopySource: copySourceOf(source),
				ServerSideEncryption: SERVER_SIDE_ENCRYPTION,
				MetadataDirective: "COPY",
			}),
		);
		const revision = revisionFromEtag(result.CopyObjectResult?.ETag);
		return { locator: { ...destination, revision }, revision };
	}

	public async getSignedDownloadUrl(input: StorageSignedUrlInput): Promise<string> {
		const responseContentDisposition =
			input.disposition !== undefined && input.fileName !== undefined ? `${input.disposition}; filename="${input.fileName.replaceAll('"', "_")}"` : undefined;
		const command = new GetObjectCommand({
			Bucket: input.locator.container,
			Key: input.locator.path,
			ResponseContentDisposition: responseContentDisposition,
		});
		return getSignedUrl(this.client, command, { expiresIn: input.expiresInSeconds });
	}

	public async createBrowserUploadTicket(input: StorageBrowserUploadTicketInput): Promise<StorageBrowserUploadTicketResult> {
		const checksumBase64 = sha256HexToBase64(input.checksumSha256);
		const result = await createPresignedPost(this.client, {
			Bucket: input.locator.container,
			Key: input.locator.path,
			Conditions: [
				["content-length-range", 1, input.maxBytes],
				["eq", "$Content-Type", input.mimeType],
				["eq", "$x-amz-checksum-algorithm", "SHA256"],
				["eq", "$x-amz-checksum-sha256", checksumBase64],
				["eq", "$x-amz-server-side-encryption", SERVER_SIDE_ENCRYPTION],
			],
			Fields: {
				"Content-Type": input.mimeType,
				"x-amz-checksum-algorithm": "SHA256",
				"x-amz-checksum-sha256": checksumBase64,
				"x-amz-server-side-encryption": SERVER_SIDE_ENCRYPTION,
				"x-amz-meta-file-id": input.metadata?.fileId ?? "",
				"x-amz-meta-category": input.metadata?.category ?? "",
				"x-amz-meta-uploaded-by-id": input.metadata?.uploadedById ?? "",
			},
			Expires: input.expiresInSeconds,
		});
		return { method: "POST_MULTIPART", uploadUrl: result.url, fields: result.fields };
	}

	public async headObject(locator: StorageObjectLocator): Promise<StorageHeadObjectResult | null> {
		try {
			const result = await this.client.send(
				new HeadObjectCommand({
					Bucket: locator.container,
					Key: locator.path,
					ChecksumMode: "ENABLED",
				}),
			);
			return {
				sizeBytes: result.ContentLength ?? 0,
				mimeType: result.ContentType ?? null,
				checksumSha256Hex: result.ChecksumSHA256 !== undefined ? sha256Base64ToHex(result.ChecksumSHA256) : null,
				revision: revisionFromEtag(result.ETag),
			};
		} catch (error) {
			if (error instanceof Error && isMissingObjectError(error)) {
				return null;
			}
			throw error;
		}
	}

	private async sendGetObject(locator: StorageObjectLocator): Promise<GetObjectCommandOutput | null> {
		try {
			return await this.client.send(new GetObjectCommand({ Bucket: locator.container, Key: locator.path }));
		} catch (error) {
			if (error instanceof Error && isMissingObjectError(error)) {
				return null;
			}
			throw error;
		}
	}

	/**
	 * Copies the promoted private object into the CloudFront origin bucket
	 * (same key) with the asset's content type and cache policy, and returns its
	 * CDN URL. Re-publishing overwrites the copy, so a retried promotion is safe.
	 */
	public async publishAsset(input: PublicAssetPublicationInput): Promise<PublicAssetPublicationResult> {
		const result = await this.client.send(
			new CopyObjectCommand({
				Bucket: this.delivery.publicContainer,
				Key: input.locator.path,
				CopySource: copySourceOf(input.locator),
				MetadataDirective: "REPLACE",
				ContentType: input.mimeType,
				ContentDisposition: "inline",
				CacheControl: PUBLIC_ASSET_CACHE_CONTROL,
				Metadata: { "file-id": input.fileId },
				ServerSideEncryption: SERVER_SIDE_ENCRYPTION,
			}),
		);
		return {
			publicUrl: `https://${this.delivery.cdnHost}/${encodeObjectKey(input.locator.path)}`,
			revision: revisionFromEtag(result.CopyObjectResult?.ETag),
		};
	}

	/**
	 * Deletes the public-origin copy (S3 deletes are idempotent) and reports its
	 * key, which CloudFront may still hold at the edge, for invalidation.
	 */
	public async unpublishAsset(input: PublicAssetWithdrawalInput): Promise<PublicAssetWithdrawalResult> {
		await this.client.send(
			new DeleteObjectCommand({
				Bucket: this.delivery.publicContainer,
				Key: input.locator.path,
			}),
		);
		return { cachedObjectKeys: [input.locator.path] };
	}
}
