import type { FileCategory, FileVariantKind } from "@workspace/shared";

import { sanitizeFileName } from "./sanitize-file-name.util";

/** Remove a trailing file extension so MIME-derived extensions are not duplicated. */
export function stripFileExtension(fileName: string): string {
	const lastDot = fileName.lastIndexOf(".");
	if (lastDot <= 0) {
		return fileName;
	}
	const extension = fileName.slice(lastDot + 1).toLowerCase();
	if (!/^[a-z0-9]{1,5}$/.test(extension)) {
		return fileName;
	}
	return fileName.slice(0, lastDot);
}

function extensionForMimeType(mimeType: string): string {
	if (mimeType === "image/jpeg") {
		return "jpg";
	}
	if (mimeType === "image/png") {
		return "png";
	}
	if (mimeType === "image/webp") {
		return "webp";
	}
	if (mimeType === "image/avif") {
		return "avif";
	}
	if (mimeType === "application/pdf") {
		return "pdf";
	}
	return "bin";
}

export interface BuildFileObjectPathInput {
	readonly category: FileCategory;
	readonly ownerId: string;
	readonly fileId: string;
	readonly fileName: string;
	readonly mimeType: string;
	readonly variant?: FileVariantKind;
}

const STAGING_PREFIX = "staging";

/**
 * Ephemeral object key for browser direct uploads.
 * Bytes live here only until the scanner promotes a clean copy to the final path.
 */
export function buildStagingPath(input: BuildFileObjectPathInput): string {
	const baseName = stripFileExtension(sanitizeFileName(input.fileName));
	const extension = extensionForMimeType(input.mimeType);
	const fileSegment = `${input.fileId}-${baseName}.${extension}`;

	if (input.category === "PRODUCT_IMAGE") {
		return `${STAGING_PREFIX}/products/${input.ownerId}/original/${fileSegment}`;
	}
	if (input.category === "STORE_LOGO") {
		return `${STAGING_PREFIX}/stores/${input.ownerId}/logo/${fileSegment}`;
	}
	if (input.category === "STORE_BANNER") {
		return `${STAGING_PREFIX}/stores/${input.ownerId}/banner/${fileSegment}`;
	}
	if (input.category === "USER_AVATAR") {
		return `${STAGING_PREFIX}/users/${input.ownerId}/avatar/${fileSegment}`;
	}
	return `${STAGING_PREFIX}/kyb/${input.ownerId}/${fileSegment}`;
}

/**
 * Flat durable object key written only after a clean scan.
 * No quarantine/clean lifecycle segments — final keys are stable and easy to browse.
 */
export function buildFinalStoragePath(input: BuildFileObjectPathInput): string {
	const extension = extensionForMimeType(input.mimeType);
	const fileSegment = `${input.fileId}.${extension}`;

	if (input.category === "PRODUCT_IMAGE") {
		return `products/${input.ownerId}/original/${fileSegment}`;
	}
	if (input.category === "STORE_LOGO") {
		return `stores/${input.ownerId}/logo/${fileSegment}`;
	}
	if (input.category === "STORE_BANNER") {
		return `stores/${input.ownerId}/banner/${fileSegment}`;
	}
	if (input.category === "USER_AVATAR") {
		return `users/${input.ownerId}/avatar/${fileSegment}`;
	}
	return `kyb/${input.ownerId}/${fileSegment}`;
}

export function isStagingPath(storagePath: string): boolean {
	return storagePath.startsWith(`${STAGING_PREFIX}/`);
}

export function buildPublicVariantPath(input: BuildFileObjectPathInput): string {
	const variant = input.variant ?? "ORIGINAL";
	const extension = extensionForMimeType(input.mimeType);
	const fileSegment = `${input.fileId}.${extension}`;

	if (input.category === "PRODUCT_IMAGE") {
		return `products/${input.ownerId}/${variant.toLowerCase()}/${fileSegment}`;
	}
	if (input.category === "STORE_LOGO") {
		return `stores/${input.ownerId}/logo/${variant.toLowerCase()}/${fileSegment}`;
	}
	if (input.category === "STORE_BANNER") {
		return `stores/${input.ownerId}/banner/${variant.toLowerCase()}/${fileSegment}`;
	}
	return `users/${input.ownerId}/avatar/${variant.toLowerCase()}/${fileSegment}`;
}
