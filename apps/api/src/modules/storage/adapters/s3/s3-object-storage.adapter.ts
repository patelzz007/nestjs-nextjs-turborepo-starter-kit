import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NodeHttpHandler } from "@smithy/node-http-handler";
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
import { sha256Base64ToHex, sha256HexToBase64 } from "../../utils/checksum.util";

export class S3ObjectStorageAdapter implements ObjectStorage, PublicDelivery {
	private readonly client: S3Client;

	public constructor(private readonly config: TypedConfigService) {
		if (this.config.awsAccessKeyId === null || this.config.awsSecretAccessKey === null) {
			throw new Error(
				"S3 storage is enabled but AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are missing. " +
					"Create a least-privilege IAM user with s3:PutObject, s3:GetObject, s3:DeleteObject, s3:CopyObject, s3:HeadObject.",
			);
		}

		this.client = new S3Client({
			region: this.config.awsRegion,
			credentials: {
				accessKeyId: this.config.awsAccessKeyId,
				secretAccessKey: this.config.awsSecretAccessKey,
			},
			requestHandler: new NodeHttpHandler({
				connectionTimeout: 5_000,
				requestTimeout: 30_000,
			}),
		});
	}

	public async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
		const result = await this.client.send(
			new PutObjectCommand({
				Bucket: input.locator.container,
				Key: input.locator.path,
				Body: input.buffer,
				ContentType: input.mimeType,
				ServerSideEncryption: "AES256",
				Metadata: input.metadata ?? {},
			}),
		);
		const revision = result.ETag !== undefined ? result.ETag.replaceAll('"', "") : null;
		return { locator: { ...input.locator, revision }, revision };
	}

	public async getObject(locator: StorageObjectLocator): Promise<Buffer | null> {
		try {
			const result = await this.client.send(
				new GetObjectCommand({
					Bucket: locator.container,
					Key: locator.path,
				}),
			);
			if (result.Body === undefined) {
				return null;
			}
			const bytes = await result.Body.transformToByteArray();
			return Buffer.from(bytes);
		} catch {
			return null;
		}
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
				CopySource: `${source.container}/${source.path}`,
				ServerSideEncryption: "AES256",
				MetadataDirective: "COPY",
			}),
		);
		const revision = result.CopyObjectResult?.ETag !== undefined ? result.CopyObjectResult.ETag.replaceAll('"', "") : null;
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
				["eq", "$x-amz-server-side-encryption", "AES256"],
			],
			Fields: {
				"Content-Type": input.mimeType,
				"x-amz-checksum-algorithm": "SHA256",
				"x-amz-checksum-sha256": checksumBase64,
				"x-amz-server-side-encryption": "AES256",
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
				}),
			);
			return {
				sizeBytes: result.ContentLength ?? 0,
				mimeType: result.ContentType ?? null,
				checksumSha256Hex: result.ChecksumSHA256 !== undefined ? sha256Base64ToHex(result.ChecksumSHA256) : null,
				revision: result.ETag !== undefined ? result.ETag.replaceAll('"', "") : null,
			};
		} catch {
			return null;
		}
	}

	public publishAsset(input: PublicAssetPublicationInput): Promise<PublicAssetPublicationResult> {
		const cdnDomain = this.config.cloudfrontPublicDomain;
		const publicUrl =
			cdnDomain !== null ? `https://${cdnDomain}/${input.locator.path}` : `https://${input.locator.container}.s3.${this.config.awsRegion}.amazonaws.com/${input.locator.path}`;
		return Promise.resolve({
			publicUrl,
			revision: input.locator.revision ?? null,
		});
	}
}
