import { z } from "zod";

import { EpochMsSchema } from "../api/common";

/** Common document/image MIME types accepted for object uploads. */
export const DocumentMimeTypeSchema = z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/avif"]);

export type DocumentMimeType = z.output<typeof DocumentMimeTypeSchema>;

export const ImageMimeTypeSchema = z.enum(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export type ImageMimeType = z.output<typeof ImageMimeTypeSchema>;

export const StoredObjectScanStatusSchema = z.enum(["SCANNING", "CLEAN", "INFECTED"]);

export type StoredObjectScanStatus = z.output<typeof StoredObjectScanStatusSchema>;

/** Full file lifecycle managed exclusively by the file service. */
export const FileStatusSchema = z.enum(["PENDING", "UPLOADED", "PROCESSING", "SCANNING", "READY", "FAILED", "QUARANTINED", "DELETED"]);

export type FileStatus = z.output<typeof FileStatusSchema>;

export const FileCategorySchema = z.enum(["PRODUCT_IMAGE", "STORE_LOGO", "STORE_BANNER", "USER_AVATAR", "MERCHANT_KYB"]);

export type FileCategory = z.output<typeof FileCategorySchema>;

export const FileVisibilitySchema = z.enum(["PUBLIC", "PRIVATE"]);

export type FileVisibility = z.output<typeof FileVisibilitySchema>;

export const MerchantAssetTypeSchema = z.enum(["LOGO", "BANNER"]);

export type MerchantAssetType = z.output<typeof MerchantAssetTypeSchema>;

export const FileVariantKindSchema = z.enum(["ORIGINAL", "THUMBNAIL", "MEDIUM", "LARGE"]);

export type FileVariantKind = z.output<typeof FileVariantKindSchema>;

/** Reusable upload constraints for file batches. */
export const FileUploadPolicySchema = z
	.object({
		minCount: z.number().int().nonnegative().default(1),
		maxCount: z.number().int().positive(),
		maxBytesPerFile: z.number().int().positive(),
		allowedMimeTypes: z.array(DocumentMimeTypeSchema).min(1),
		emptyFilesMessage: z.string().min(1),
		maxCountMessage: z.string().min(1),
		maxBytesMessage: z.string().min(1),
		invalidMimeMessage: z.string().min(1),
		magicBytesMismatchMessage: z.string().min(1),
	})
	.strict();

export type FileUploadPolicy = z.output<typeof FileUploadPolicySchema>;

export const FileCategoryPolicySchema = z
	.object({
		category: FileCategorySchema,
		visibility: FileVisibilitySchema,
		maxBytes: z.number().int().positive(),
		allowedMimeTypes: z.array(DocumentMimeTypeSchema).min(1),
		requiresScanning: z.boolean(),
		generatesVariants: z.boolean(),
	})
	.strict();

export type FileCategoryPolicy = z.output<typeof FileCategoryPolicySchema>;

export const FILE_CATEGORY_POLICIES: Record<FileCategory, FileCategoryPolicy> = {
	PRODUCT_IMAGE: {
		category: "PRODUCT_IMAGE",
		visibility: "PUBLIC",
		maxBytes: 26_214_400,
		allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
		requiresScanning: true,
		generatesVariants: true,
	},
	STORE_LOGO: {
		category: "STORE_LOGO",
		visibility: "PUBLIC",
		maxBytes: 10_485_760,
		allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
		requiresScanning: true,
		generatesVariants: true,
	},
	STORE_BANNER: {
		category: "STORE_BANNER",
		visibility: "PUBLIC",
		maxBytes: 26_214_400,
		allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
		requiresScanning: true,
		generatesVariants: true,
	},
	USER_AVATAR: {
		category: "USER_AVATAR",
		visibility: "PUBLIC",
		maxBytes: 10_485_760,
		allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
		requiresScanning: true,
		generatesVariants: true,
	},
	MERCHANT_KYB: {
		category: "MERCHANT_KYB",
		visibility: "PRIVATE",
		maxBytes: 26_214_400,
		allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
		requiresScanning: true,
		generatesVariants: false,
	},
};

export function getFileCategoryPolicy(category: FileCategory): FileCategoryPolicy {
	return FILE_CATEGORY_POLICIES[category];
}

export function toFileUploadPolicy(policy: FileCategoryPolicy): FileUploadPolicy {
	return FileUploadPolicySchema.parse({
		minCount: 1,
		maxCount: policy.category === "MERCHANT_KYB" ? 5 : 1,
		maxBytesPerFile: policy.maxBytes,
		allowedMimeTypes: policy.allowedMimeTypes,
		emptyFilesMessage: "At least one file is required.",
		maxCountMessage: "Too many files in this upload.",
		maxBytesMessage: "Each file exceeds the maximum allowed size.",
		invalidMimeMessage: "One or more files use a disallowed type.",
		magicBytesMismatchMessage: "One or more files do not match their declared type.",
	});
}

export const DEFAULT_DOCUMENT_UPLOAD_POLICY: FileUploadPolicy = toFileUploadPolicy(FILE_CATEGORY_POLICIES.MERCHANT_KYB);

export const MERCHANT_KYB_UPLOAD_POLICY: FileUploadPolicy = DEFAULT_DOCUMENT_UPLOAD_POLICY;

export const FileRecordSchema = z
	.object({
		id: z.uuid(),
		category: FileCategorySchema,
		visibility: FileVisibilitySchema,
		originalName: z.string(),
		mimeType: DocumentMimeTypeSchema,
		sizeBytes: z.number().int().nonnegative(),
		status: FileStatusSchema,
		publicUrl: z.string().nullable(),
		uploadedAt: EpochMsSchema,
	})
	.strict();

export type FileRecord = z.output<typeof FileRecordSchema>;

export const FileVariantRecordSchema = z
	.object({
		id: z.uuid(),
		kind: FileVariantKindSchema,
		mimeType: DocumentMimeTypeSchema,
		sizeBytes: z.number().int().nonnegative(),
		publicUrl: z.string().nullable(),
	})
	.strict();

export type FileVariantRecord = z.output<typeof FileVariantRecordSchema>;

export const CreateFileUploadUrlSchema = z
	.object({
		category: FileCategorySchema,
		fileName: z.string().min(1).max(255),
		mimeType: DocumentMimeTypeSchema,
		sizeBytes: z.number().int().positive(),
		checksumSha256: z.string().length(64),
		productId: z.uuid().optional(),
		merchantOrgId: z.uuid().optional(),
		userId: z.uuid().optional(),
		assetType: MerchantAssetTypeSchema.optional(),
	})
	.strict()
	.superRefine((value, ctx) => {
		if (value.category === "PRODUCT_IMAGE" && value.productId === undefined) {
			ctx.addIssue({ code: "custom", message: "productId is required for PRODUCT_IMAGE uploads", path: ["productId"] });
		}
		if ((value.category === "STORE_LOGO" || value.category === "STORE_BANNER") && value.merchantOrgId === undefined) {
			ctx.addIssue({ code: "custom", message: "merchantOrgId is required for store asset uploads", path: ["merchantOrgId"] });
		}
		if ((value.category === "STORE_LOGO" || value.category === "STORE_BANNER") && value.assetType === undefined) {
			ctx.addIssue({ code: "custom", message: "assetType is required for store asset uploads", path: ["assetType"] });
		}
		if (value.category === "USER_AVATAR" && value.userId === undefined) {
			ctx.addIssue({ code: "custom", message: "userId is required for USER_AVATAR uploads", path: ["userId"] });
		}
		if (value.category === "MERCHANT_KYB" && value.merchantOrgId === undefined) {
			ctx.addIssue({ code: "custom", message: "merchantOrgId is required for MERCHANT_KYB uploads", path: ["merchantOrgId"] });
		}
	});

export type CreateFileUploadUrlInput = z.output<typeof CreateFileUploadUrlSchema>;

export const PresignedPostFieldSchema = z.record(z.string(), z.string());

export type PresignedPostField = z.output<typeof PresignedPostFieldSchema>;

export const CreateFileUploadUrlResponseSchema = z
	.object({
		fileId: z.uuid(),
		uploadUrl: z.url(),
		fields: PresignedPostFieldSchema,
		objectKey: z.string().min(1),
		expiresIn: z.number().int().positive(),
	})
	.strict();

export type CreateFileUploadUrlResponse = z.output<typeof CreateFileUploadUrlResponseSchema>;

export const CompleteFileUploadSchema = z
	.object({
		checksumSha256: z.string().length(64),
	})
	.strict();

export type CompleteFileUploadInput = z.output<typeof CompleteFileUploadSchema>;

export const CompleteFileUploadResponseSchema = z
	.object({
		file: FileRecordSchema,
	})
	.strict();

export type CompleteFileUploadResponse = z.output<typeof CompleteFileUploadResponseSchema>;

export const FileDownloadResponseSchema = z
	.object({
		fileId: z.uuid(),
		status: FileStatusSchema,
		downloadUrl: z.string().nullable(),
		expiresAt: EpochMsSchema.nullable(),
	})
	.strict();

export type FileDownloadResponse = z.output<typeof FileDownloadResponseSchema>;

export const FileDownloadDispositionSchema = z.enum(["inline", "attachment"]);

export type FileDownloadDisposition = z.output<typeof FileDownloadDispositionSchema>;

export const FileProcessingResultSchema = z
	.object({
		fileId: z.uuid(),
		status: z.enum(["READY", "FAILED", "QUARANTINED"]),
		/** Set when the scanner Lambda already copied the object to its final flat key. */
		finalStoragePath: z.string().min(1).optional(),
		scanStatus: StoredObjectScanStatusSchema.optional(),
		scanResult: z.string().optional(),
		variants: z.array(FileVariantRecordSchema).optional(),
	})
	.strict();

export type FileProcessingResult = z.output<typeof FileProcessingResultSchema>;

/** Synchronous scanner adapter result (Lambda invoke or ClamAV INSTREAM). */
export const FileScannerResultSchema = z
	.object({
		clean: z.boolean(),
		scanResult: z.string().optional(),
	})
	.strict();

export type FileScannerResult = z.output<typeof FileScannerResultSchema>;

export const FileScannerInvokePayloadSchema = z
	.object({
		bucket: z.string().min(1),
		key: z.string().min(1),
		fileId: z.uuid(),
	})
	.strict();

export type FileScannerInvokePayload = z.output<typeof FileScannerInvokePayloadSchema>;
