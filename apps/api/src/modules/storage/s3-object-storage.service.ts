import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { Injectable } from "@nestjs/common";

import { TypedConfigService } from "../../config/typed-config.service";
import { sha256HexToBase64 } from "./utils/checksum.util";

import type {
	ObjectStorageService,
	StorageHeadObjectInput,
	StorageHeadObjectResult,
	StoragePresignedPostInput,
	StoragePresignedPostResult,
	StorageSignedUrlInput,
	StorageUploadInput,
	StorageUploadResult,
} from "./storage.types";

@Injectable()
export class S3ObjectStorageService implements ObjectStorageService {
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
				Bucket: input.bucket,
				Key: input.path,
				Body: input.buffer,
				ContentType: input.mimeType,
				ServerSideEncryption: "AES256",
				Metadata: input.metadata ?? {},
			}),
		);
		return {
			bucket: input.bucket,
			path: input.path,
			generation: result.ETag !== undefined ? result.ETag.replaceAll('"', "") : null,
		};
	}

	public async getObject(input: StorageHeadObjectInput): Promise<Buffer | null> {
		try {
			const result = await this.client.send(
				new GetObjectCommand({
					Bucket: input.bucket,
					Key: input.path,
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

	public async deleteObject(bucket: string, path: string): Promise<void> {
		await this.client.send(
			new DeleteObjectCommand({
				Bucket: bucket,
				Key: path,
			}),
		);
	}

	public async copyObject(sourceBucket: string, sourcePath: string, destBucket: string, destPath: string): Promise<StorageUploadResult> {
		const result = await this.client.send(
			new CopyObjectCommand({
				Bucket: destBucket,
				Key: destPath,
				CopySource: `${sourceBucket}/${sourcePath}`,
				ServerSideEncryption: "AES256",
				MetadataDirective: "COPY",
			}),
		);
		return {
			bucket: destBucket,
			path: destPath,
			generation: result.CopyObjectResult?.ETag !== undefined ? result.CopyObjectResult.ETag.replaceAll('"', "") : null,
		};
	}

	public async getSignedDownloadUrl(input: StorageSignedUrlInput): Promise<string> {
		const responseContentDisposition =
			input.disposition !== undefined && input.fileName !== undefined ? `${input.disposition}; filename="${input.fileName.replaceAll('"', "_")}"` : undefined;
		const command = new GetObjectCommand({
			Bucket: input.bucket,
			Key: input.path,
			ResponseContentDisposition: responseContentDisposition,
		});
		return getSignedUrl(this.client, command, { expiresIn: input.expiresInSeconds });
	}

	public async createPresignedPost(input: StoragePresignedPostInput): Promise<StoragePresignedPostResult> {
		const checksumBase64 = sha256HexToBase64(input.checksumSha256);
		const result = await createPresignedPost(this.client, {
			Bucket: input.bucket,
			Key: input.path,
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
		return { url: result.url, fields: result.fields };
	}

	public async headObject(input: StorageHeadObjectInput): Promise<StorageHeadObjectResult | null> {
		try {
			const result = await this.client.send(
				new HeadObjectCommand({
					Bucket: input.bucket,
					Key: input.path,
				}),
			);
			return {
				sizeBytes: result.ContentLength ?? 0,
				mimeType: result.ContentType ?? null,
				checksumSha256: result.ChecksumSHA256 ?? null,
				etag: result.ETag !== undefined ? result.ETag.replaceAll('"', "") : null,
			};
		} catch {
			return null;
		}
	}
}
