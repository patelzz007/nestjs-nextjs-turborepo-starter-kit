import { z } from "zod";

import { assertNever } from "../../../lib/assert-never";
import { EpochMsSchema } from "../../../schemas/api/common";

/** Common document/image MIME types accepted for object uploads. */
export const DocumentMimeTypeSchema = z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/avif"]);

export type DocumentMimeType = z.output<typeof DocumentMimeTypeSchema>;

export const ImageMimeTypeSchema = z.enum(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export type ImageMimeType = z.output<typeof ImageMimeTypeSchema>;

/**
 * Malware-scan state recorded on a stored file:
 * - `SCANNING`    — waiting for a verdict.
 * - `CLEAN`       — a scanner examined it and found nothing.
 * - `INFECTED`    — a scanner flagged it (the file is QUARANTINED).
 * - `NOT_SCANNED` — no scanner is configured (`MALWARE_SCANNER=none`); the file
 *                   passed the byte checks only. Never presented as CLEAN.
 */
export const StoredObjectScanStatusSchema = z.enum(["SCANNING", "CLEAN", "INFECTED", "NOT_SCANNED"]);

export type StoredObjectScanStatus = z.output<typeof StoredObjectScanStatusSchema>;

/** Full file lifecycle managed exclusively by the file service. */
export const FileStatusSchema = z.enum(["PENDING", "UPLOADED", "PROCESSING", "SCANNING", "READY", "FAILED", "QUARANTINED", "DELETED"]);

export type FileStatus = z.output<typeof FileStatusSchema>;

/**
 * What a stored file is for. `REWARD_IMAGE` is one of the (1–10) images a
 * merchant shows on a reward: uploaded to the tenant first, then named
 * in the reward's `imageFileIds` (the first is the cover). `GITHUB_COMMENT_IMAGE`
 * is a picture an admin attaches to a GitHub comment from the app (ADR 052):
 * GitHub has no API for its own uploads, so it is uploaded here first — checked
 * like any upload — and committed to the repository only when a comment that
 * links it is posted; this copy is then deleted. One no comment used is
 * deleted once its `stagingRetentionMs` has passed.
 */
export const FileCategorySchema = z.enum(["PRODUCT_IMAGE", "STORE_LOGO", "STORE_BANNER", "USER_AVATAR", "MERCHANT_KYB", "REWARD_IMAGE", "GITHUB_COMMENT_IMAGE"]);

export type FileCategory = z.output<typeof FileCategorySchema>;

export const FileVisibilitySchema = z.enum(["PUBLIC", "PRIVATE"]);

export type FileVisibility = z.output<typeof FileVisibilitySchema>;

export const MerchantAssetTypeSchema = z.enum(["LOGO", "BANNER"]);

export type MerchantAssetType = z.output<typeof MerchantAssetTypeSchema>;

/** Renditions of an image, smallest to largest (`ORIGINAL` is the upload itself). */
export const FileVariantKindSchema = z.enum(["ORIGINAL", "THUMBNAIL", "MEDIUM", "LARGE", "XLARGE", "UHD"]);

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

/**
 * One served size of an image, for `srcset`: its width in pixels and its http(s)
 * URL (rendered straight into `<img srcset>`). Lists of them run smallest to
 * largest, so each screen downloads only the size it needs.
 */
export const ImageSourceSchema = z.object({ width: z.number().int().positive(), url: z.url({ protocol: /^https?$/ }) });

export type ImageSource = z.output<typeof ImageSourceSchema>;

/** One published rendition of an image: its kind and its width in pixels (height follows the aspect ratio). */
export const ImageVariantSpecSchema = z.object({ kind: FileVariantKindSchema, width: z.number().int().positive() }).strict();

export type ImageVariantSpec = z.output<typeof ImageVariantSpecSchema>;

/**
 * The pixel rules of an image category: the exact aspect ratio, the smallest
 * accepted size, and the renditions the server publishes (ascending width), so
 * each screen downloads the resolution it needs. Checked in the browser before
 * uploading (UX) and by the API on the stored bytes (authoritative).
 */
export const ImageRulesSchema = z
	.object({
		aspectWidth: z.number().int().positive(),
		aspectHeight: z.number().int().positive(),
		minWidth: z.number().int().positive(),
		minHeight: z.number().int().positive(),
		variants: z.array(ImageVariantSpecSchema).min(1),
	})
	.strict();

export type ImageRules = z.output<typeof ImageRulesSchema>;

export const FileCategoryPolicySchema = z
	.object({
		category: FileCategorySchema,
		visibility: FileVisibilitySchema,
		maxBytes: z.number().int().positive(),
		allowedMimeTypes: z.array(DocumentMimeTypeSchema).min(1),
		generatesVariants: z.boolean(),
		/** Pixel rules every image of the category must meet (absent: any size). */
		imageRules: ImageRulesSchema.optional(),
		/**
		 * For a staging category — a copy a later step consumes, then deletes — how long a READY
		 * file is kept after upload; the hourly storage sweep deletes it then. Absent: kept until deleted.
		 */
		stagingRetentionMs: z.number().int().positive().optional(),
	})
	.strict();

export type FileCategoryPolicy = z.output<typeof FileCategoryPolicySchema>;

export const FILE_CATEGORY_POLICIES: Record<FileCategory, FileCategoryPolicy> = {
	PRODUCT_IMAGE: {
		category: "PRODUCT_IMAGE",
		visibility: "PUBLIC",
		maxBytes: 26_214_400,
		allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
		generatesVariants: true,
	},
	STORE_LOGO: {
		category: "STORE_LOGO",
		visibility: "PUBLIC",
		maxBytes: 10_485_760,
		allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
		generatesVariants: true,
		imageRules: {
			// Square, shown as a tile or a circle; the browser zooms a wordmark out to fit whole.
			aspectWidth: 1,
			aspectHeight: 1,
			minWidth: 256,
			minHeight: 256,
			variants: [
				{ kind: "THUMBNAIL", width: 128 },
				{ kind: "MEDIUM", width: 256 },
				{ kind: "LARGE", width: 512 },
				{ kind: "XLARGE", width: 1024 },
			],
		},
	},
	STORE_BANNER: {
		category: "STORE_BANNER",
		visibility: "PUBLIC",
		maxBytes: 26_214_400,
		allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
		generatesVariants: true,
	},
	USER_AVATAR: {
		category: "USER_AVATAR",
		visibility: "PUBLIC",
		maxBytes: 10_485_760,
		allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
		generatesVariants: true,
		imageRules: {
			// Square, shown in a circle: sharp up to a large profile header.
			aspectWidth: 1,
			aspectHeight: 1,
			minWidth: 256,
			minHeight: 256,
			variants: [
				{ kind: "THUMBNAIL", width: 128 },
				{ kind: "MEDIUM", width: 256 },
				{ kind: "LARGE", width: 512 },
			],
		},
	},
	REWARD_IMAGE: {
		category: "REWARD_IMAGE",
		visibility: "PUBLIC",
		// At most 10 MiB, so the single-shot signed upload stays within rules/20 (multipart above ~10 MB);
		// the browser re-encodes a picked photo to WebP, at most 4K wide (a few MB), before uploading.
		maxBytes: 10_485_760,
		allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
		generatesVariants: true,
		imageRules: {
			aspectWidth: 16,
			aspectHeight: 9,
			// Full HD at least: sharp on a laptop or phone. Larger photos keep their extra detail, up to 4K.
			minWidth: 1920,
			minHeight: 1080,
			variants: [
				{ kind: "THUMBNAIL", width: 640 },
				{ kind: "MEDIUM", width: 1280 },
				{ kind: "LARGE", width: 1920 },
				{ kind: "XLARGE", width: 2560 },
				{ kind: "UHD", width: 3840 },
			],
		},
	},
	GITHUB_COMMENT_IMAGE: {
		category: "GITHUB_COMMENT_IMAGE",
		// Private: only a staging copy — the picture lives in the repository, where GitHub decides who sees it.
		visibility: "PRIVATE",
		// GitHub's own limit for an image in a comment, and within rules/20's single-shot upload size.
		maxBytes: 10_485_760,
		allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
		// Never served from here; GitHub serves the committed copy.
		generatesVariants: false,
		// A day: the comment it was attached for is written in one sitting (the app keeps no drafts).
		stagingRetentionMs: 86_400_000,
	},
	MERCHANT_KYB: {
		category: "MERCHANT_KYB",
		visibility: "PRIVATE",
		maxBytes: 26_214_400,
		allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
		generatesVariants: false,
	},
};

/** How far an image's width/height may stray from the exact ratio (0.5%) — absorbs a pixel of rounding from a crop. */
export const IMAGE_ASPECT_TOLERANCE = 0.005;

/** Why an image does not meet its category's pixel rules. */
export type ImageDimensionProblem = "aspect_ratio" | "too_small";

/** The first rule a `width` × `height` image breaks, or `null` when it meets them all. */
export function findImageDimensionProblem(width: number, height: number, rules: ImageRules): ImageDimensionProblem | null {
	const expected = rules.aspectWidth / rules.aspectHeight;
	if (height <= 0 || Math.abs(width / height - expected) / expected > IMAGE_ASPECT_TOLERANCE) {
		return "aspect_ratio";
	}
	if (width < rules.minWidth || height < rules.minHeight) {
		return "too_small";
	}
	return null;
}

/**
 * The renditions an image `width` pixels wide yields: those no wider than it,
 * so none is upscaled (a 1920-wide upload stops at LARGE; a 4K one gets all).
 */
export function renditionsForWidth(width: number, rules: ImageRules): ImageVariantSpec[] {
	return rules.variants.filter((variant) => variant.width <= width);
}

/** The widest rendition the rules publish — the most detail any screen is served, so the most worth uploading. */
export function largestRenditionWidth(rules: ImageRules): number {
	return Math.max(...rules.variants.map((variant) => variant.width));
}

/** The shape an aspect ratio makes, in the uploader's words. */
function imageShapeName(rules: Pick<ImageRules, "aspectWidth" | "aspectHeight">): string {
	if (rules.aspectWidth === rules.aspectHeight) {
		return "square";
	}
	return rules.aspectWidth > rules.aspectHeight ? "landscape" : "portrait";
}

/** What to tell the uploader about a dimension problem — the same words in the browser and from the API. */
export function describeImageDimensionProblem(problem: ImageDimensionProblem, rules: ImageRules): string {
	switch (problem) {
		case "aspect_ratio":
			return `Images must be ${String(rules.aspectWidth)}:${String(rules.aspectHeight)} (${imageShapeName(rules)}).`;
		case "too_small":
			return `Images must be at least ${String(rules.minWidth)} × ${String(rules.minHeight)} pixels so they stay sharp on every screen.`;
		default:
			return assertNever(problem, "image dimension problem");
	}
}

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

export const FileRecordSchema = z.object({
	id: z.uuid(),
	category: FileCategorySchema,
	visibility: FileVisibilitySchema,
	originalName: z.string(),
	mimeType: DocumentMimeTypeSchema,
	sizeBytes: z.number().int().nonnegative(),
	status: FileStatusSchema,
	/** `null` until the bytes are verified (PENDING). */
	scanStatus: StoredObjectScanStatusSchema.nullable(),
	publicUrl: z.string().nullable(),
	uploadedAt: EpochMsSchema,
});

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

/** Categories a signed-in person uploads for themselves or the platform (`POST /files/upload-url`). */
export const PlatformFileCategorySchema = FileCategorySchema.extract(["PRODUCT_IMAGE", "USER_AVATAR", "GITHUB_COMMENT_IMAGE"]);

export type PlatformFileCategory = z.output<typeof PlatformFileCategorySchema>;

/** Categories a tenant owns (`POST /tenants/:tenantSlug/files/upload-url`): the tenant comes from the route, never the body. */
export const TenantFileCategorySchema = FileCategorySchema.extract(["STORE_LOGO", "STORE_BANNER", "REWARD_IMAGE", "MERCHANT_KYB"]);

export type TenantFileCategory = z.output<typeof TenantFileCategorySchema>;

/** The bytes an upload ticket is for: the same four fields on every upload route. */
const UPLOAD_FILE_FIELDS = {
	fileName: z.string().min(1).max(255),
	mimeType: DocumentMimeTypeSchema,
	sizeBytes: z.number().int().positive(),
	checksumSha256: z.string().length(64),
};

/** `POST /files/upload-url`: a product image, the caller's avatar or a GitHub comment image. No tenant: those uploads go through the tenant route. */
export const CreateFileUploadUrlSchema = z
	.object({
		category: PlatformFileCategorySchema,
		...UPLOAD_FILE_FIELDS,
		productId: z.uuid().optional(),
		userId: z.uuid().optional(),
	})
	.strict()
	.superRefine((value, ctx) => {
		if (value.category === "PRODUCT_IMAGE" && value.productId === undefined) {
			ctx.addIssue({ code: "custom", message: "productId is required for PRODUCT_IMAGE uploads", path: ["productId"] });
		}
		if ((value.category === "USER_AVATAR" || value.category === "GITHUB_COMMENT_IMAGE") && value.userId === undefined) {
			ctx.addIssue({ code: "custom", message: `userId is required for ${value.category} uploads`, path: ["userId"] });
		}
	});

export type CreateFileUploadUrlInput = z.output<typeof CreateFileUploadUrlSchema>;

/** `POST /tenants/:tenantSlug/files/upload-url` body: a store logo or banner, a reward image or KYB evidence of the route's tenant. */
export const CreateTenantFileUploadUrlSchema = z
	.object({
		category: TenantFileCategorySchema,
		...UPLOAD_FILE_FIELDS,
		assetType: MerchantAssetTypeSchema.optional(),
	})
	.strict()
	.superRefine((value, ctx) => {
		// The category decides what the file becomes (`LOGO` / `BANNER`); a label saying otherwise is refused, never ignored.
		const expectedAssetType = value.category === "STORE_LOGO" ? "LOGO" : value.category === "STORE_BANNER" ? "BANNER" : undefined;
		if (expectedAssetType !== undefined && value.assetType === undefined) {
			ctx.addIssue({ code: "custom", message: "assetType is required for store asset uploads", path: ["assetType"] });
		}
		if (expectedAssetType !== undefined && value.assetType !== undefined && value.assetType !== expectedAssetType) {
			ctx.addIssue({ code: "custom", message: `assetType must be ${expectedAssetType} for ${value.category} uploads`, path: ["assetType"] });
		}
		if (expectedAssetType === undefined && value.assetType !== undefined) {
			ctx.addIssue({ code: "custom", message: "assetType is only for store logo and banner uploads", path: ["assetType"] });
		}
	});

export type CreateTenantFileUploadUrlInput = z.output<typeof CreateTenantFileUploadUrlSchema>;

/**
 * One upload as the API handles it, whichever route it came from: the platform route's body as it
 * is, or the tenant route's body with the tenant the route resolved (`tenantId`, set server-side,
 * never read from a request body).
 */
export interface FileUploadRequest {
	readonly category: FileCategory;
	readonly fileName: string;
	readonly mimeType: DocumentMimeType;
	readonly sizeBytes: number;
	readonly checksumSha256: string;
	readonly productId?: string | undefined;
	readonly userId?: string | undefined;
	readonly tenantId?: string | undefined;
	readonly assetType?: MerchantAssetType | undefined;
}

/** Validates a server-built upload request with the schema of the route it stands for (the tenant route when it names a tenant). */
export function parseFileUploadRequest(request: FileUploadRequest): FileUploadRequest {
	const { tenantId, ...upload } = request;
	if (tenantId === undefined) {
		return CreateFileUploadUrlSchema.parse(upload);
	}
	return { ...CreateTenantFileUploadUrlSchema.parse(upload), tenantId: z.uuid().parse(tenantId) };
}

/** Active object-storage backend for a deployment or stored file row. */
export const StorageProviderSchema = z.enum(["local", "s3", "firebase"]);

export type StorageProvider = z.output<typeof StorageProviderSchema>;

/** Provider-neutral pointer to a stored object. */
export const StorageObjectLocatorSchema = z
	.object({
		provider: StorageProviderSchema,
		container: z.string().min(1),
		path: z.string().min(1),
		revision: z.string().nullable().optional(),
	})
	.strict();

export type StorageObjectLocator = z.output<typeof StorageObjectLocatorSchema>;

/** Browser upload transport supported by upload tickets. */
export const BrowserUploadMethodSchema = z.enum(["POST_MULTIPART", "PUT"]);

export type BrowserUploadMethod = z.output<typeof BrowserUploadMethodSchema>;

export const BrowserUploadTicketFieldsSchema = z.record(z.string(), z.string());

export type BrowserUploadTicketFields = z.output<typeof BrowserUploadTicketFieldsSchema>;

export const BrowserUploadTicketHeadersSchema = z.record(z.string(), z.string());

export type BrowserUploadTicketHeaders = z.output<typeof BrowserUploadTicketHeadersSchema>;

/** API-issued upload ticket consumed by the browser before `/files/:id/complete`. */
export const BrowserUploadTicketSchema = z.object({
	fileId: z.uuid(),
	objectPath: z.string().min(1),
	expiresIn: z.number().int().positive(),
	method: BrowserUploadMethodSchema,
	uploadUrl: z.url(),
	fields: BrowserUploadTicketFieldsSchema.optional(),
	headers: BrowserUploadTicketHeadersSchema.optional(),
});

export type BrowserUploadTicket = z.output<typeof BrowserUploadTicketSchema>;

export const CreateFileUploadUrlResponseSchema = BrowserUploadTicketSchema;

export type CreateFileUploadUrlResponse = BrowserUploadTicket;

export const CompleteFileUploadSchema = z
	.object({
		checksumSha256: z.string().length(64),
	})
	.strict();

export type CompleteFileUploadInput = z.output<typeof CompleteFileUploadSchema>;

export const CompleteFileUploadResponseSchema = z.object({
	file: FileRecordSchema,
});

export type CompleteFileUploadResponse = z.output<typeof CompleteFileUploadResponseSchema>;

export const FileDownloadResponseSchema = z.object({
	fileId: z.uuid(),
	status: FileStatusSchema,
	downloadUrl: z.string().nullable(),
	expiresAt: EpochMsSchema.nullable(),
});

export type FileDownloadResponse = z.output<typeof FileDownloadResponseSchema>;

export const FileDownloadDispositionSchema = z.enum(["inline", "attachment"]);

export type FileDownloadDisposition = z.output<typeof FileDownloadDispositionSchema>;

export const FileProcessingResultSchema = z
	.object({
		fileId: z.uuid(),
		status: z.enum(["READY", "FAILED", "QUARANTINED"]),
		/** Set when an external worker already copied the object to its final flat key. */
		finalStoragePath: z.string().min(1).optional(),
		scanStatus: StoredObjectScanStatusSchema.optional(),
		scanResult: z.string().optional(),
		variants: z.array(FileVariantRecordSchema).optional(),
	})
	.strict();

export type FileProcessingResult = z.output<typeof FileProcessingResultSchema>;

/** `GET /files/:fileId` payload. */
export const FileDetailResponseSchema = z.object({
	file: FileRecordSchema,
});

export type FileDetailResponse = z.output<typeof FileDetailResponseSchema>;
