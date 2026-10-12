import { ImageMimeTypeSchema, type DocumentMimeType, type FileCategoryPolicy, type ImageMimeType } from "@workspace/shared";

// ============================================
// lib/storage/image-file-rules.ts — what an image upload may be, checked before uploading
// ============================================
// The limits come from the shared file-category contract (`FILE_CATEGORY_POLICIES`)
// — the same ones the API enforces. Checking them first is UX only: the API
// re-checks size, type and magic bytes.

/** Bytes per mebibyte — for the human-readable size limit. */
const BYTES_PER_MEBIBYTE = 1_048_576;

export type ImageFileRejection = "unsupported_type" | "too_large" | "empty";

/** The picked file is not an image this category accepts — rejected before anything is uploaded. */
export class ImageFileRejectedError extends Error {
	public readonly reason: ImageFileRejection;

	public constructor(reason: ImageFileRejection, message: string) {
		super(message);
		this.name = "ImageFileRejectedError";
		this.reason = reason;
	}
}

export interface ImageFileRules {
	/** The `accept` attribute of the file input. */
	readonly accept: string;
	/** The largest image, in whole MiB, for messages. */
	readonly maxMebibytes: number;
}

/** The file-input facts of a category's image policy. */
export function imageFileRules(policy: FileCategoryPolicy): ImageFileRules {
	return { accept: policy.allowedMimeTypes.join(","), maxMebibytes: Math.floor(policy.maxBytes / BYTES_PER_MEBIBYTE) };
}

function isAllowedType(policy: FileCategoryPolicy, mimeType: ImageMimeType): boolean {
	return policy.allowedMimeTypes.some((allowed: DocumentMimeType): boolean => allowed === mimeType);
}

/** Checks a picked file against an image category's policy; throws {@link ImageFileRejectedError}. */
export function assertImageFileAllowed(file: File, policy: FileCategoryPolicy): void {
	const type = ImageMimeTypeSchema.safeParse(file.type);
	if (!type.success || !isAllowedType(policy, type.data)) {
		throw new ImageFileRejectedError("unsupported_type", "Choose a JPEG, PNG, WebP or AVIF image.");
	}
	if (file.size === 0) {
		throw new ImageFileRejectedError("empty", "The chosen file is empty.");
	}
	if (file.size > policy.maxBytes) {
		throw new ImageFileRejectedError("too_large", `The image must be at most ${String(imageFileRules(policy).maxMebibytes)} MB.`);
	}
}
