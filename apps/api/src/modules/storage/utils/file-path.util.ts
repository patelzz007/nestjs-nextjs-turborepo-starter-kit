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

interface CategoryKeyLayout {
	/** First key segment, before the owner id. */
	readonly root: string;
	/** Segment after the owner id (`null`: files sit directly under the owner). */
	readonly folder: string | null;
	/** Variants replace `folder` (`products/<id>/thumbnail/…`) instead of nesting under it. */
	readonly variantsReplaceFolder: boolean;
}

/**
 * Where each category's objects live, keyed by the owner the file belongs to
 * (`file-ownership.util`). Exhaustive on purpose: a new category must say where
 * its files go instead of falling through into another category's folder.
 */
const CATEGORY_KEY_LAYOUT: Readonly<Record<FileCategory, CategoryKeyLayout>> = {
	PRODUCT_IMAGE: { root: "products", folder: "original", variantsReplaceFolder: true },
	STORE_LOGO: { root: "stores", folder: "logo", variantsReplaceFolder: false },
	STORE_BANNER: { root: "stores", folder: "banner", variantsReplaceFolder: false },
	USER_AVATAR: { root: "users", folder: "avatar", variantsReplaceFolder: false },
	MERCHANT_KYB: { root: "kyb", folder: null, variantsReplaceFolder: false },
	REWARD_COVER: { root: "stores", folder: "reward-covers", variantsReplaceFolder: false },
};

/** `<root>/<ownerId>[/<folder>]` — the directory a category's original files live in. */
function categoryDirectory(category: FileCategory, ownerId: string): string {
	const { root, folder } = CATEGORY_KEY_LAYOUT[category];
	return folder === null ? `${root}/${ownerId}` : `${root}/${ownerId}/${folder}`;
}

/**
 * Ephemeral object key for browser direct uploads.
 * Bytes live here only until upload completion promotes a copy to the final path.
 */
export function buildStagingPath(input: BuildFileObjectPathInput): string {
	const baseName = stripFileExtension(sanitizeFileName(input.fileName));
	const extension = extensionForMimeType(input.mimeType);
	return `${STAGING_PREFIX}/${categoryDirectory(input.category, input.ownerId)}/${input.fileId}-${baseName}.${extension}`;
}

/**
 * Flat durable object key written after upload completion.
 * No quarantine/clean lifecycle segments — final keys are stable and easy to browse.
 */
export function buildFinalStoragePath(input: BuildFileObjectPathInput): string {
	const extension = extensionForMimeType(input.mimeType);
	return `${categoryDirectory(input.category, input.ownerId)}/${input.fileId}.${extension}`;
}

export function isStagingPath(storagePath: string): boolean {
	return storagePath.startsWith(`${STAGING_PREFIX}/`);
}

export function buildPublicVariantPath(input: BuildFileObjectPathInput): string {
	const variant = (input.variant ?? "ORIGINAL").toLowerCase();
	const extension = extensionForMimeType(input.mimeType);
	const { root, variantsReplaceFolder } = CATEGORY_KEY_LAYOUT[input.category];
	const directory = variantsReplaceFolder ? `${root}/${input.ownerId}/${variant}` : `${categoryDirectory(input.category, input.ownerId)}/${variant}`;
	return `${directory}/${input.fileId}.${extension}`;
}
