import { getFileCategoryPolicy, type CreateFileUploadUrlInput, type FileCategory, type FileCategoryPolicy } from "@workspace/shared";

import { FileMimeTypeNotAllowedError, FileOwnerUnresolvedError, FileTooLargeError, FileUploadForbiddenError } from "../errors/files.errors";

/** The columns that decide which resource namespaces a file's object keys. */
export interface FileOwnerFields {
	readonly category: FileCategory;
	readonly productId: string | null;
	readonly organizationId: string | null;
	readonly userId: string | null;
}

/** Categories whose files belong to a person (their avatar, the pictures they attach to GitHub comments), not to an organization. */
const USER_OWNED_CATEGORIES: ReadonlySet<FileCategory> = new Set<FileCategory>(["USER_AVATAR", "GITHUB_COMMENT_IMAGE"]);

/**
 * The category rules every upload request must meet before a row or a ticket
 * exists: size and MIME type from the shared `FILE_CATEGORY_POLICIES` (the same
 * table the browser checks for UX — this is the authoritative check).
 * Who may upload is decided by the category owner's access rule, not here.
 */
export function assertUploadWithinCategoryPolicy(input: Pick<CreateFileUploadUrlInput, "category" | "sizeBytes" | "mimeType">): FileCategoryPolicy {
	const policy = getFileCategoryPolicy(input.category);
	if (input.sizeBytes > policy.maxBytes) {
		throw new FileTooLargeError();
	}
	if (!policy.allowedMimeTypes.includes(input.mimeType)) {
		throw new FileMimeTypeNotAllowedError();
	}
	return policy;
}

/** Object keys are namespaced by the resource that owns the file: product, organization, or user. */
export function resolveFileOwnerId(fields: FileOwnerFields): string {
	const owner = fields.category === "PRODUCT_IMAGE" ? fields.productId : USER_OWNED_CATEGORIES.has(fields.category) ? fields.userId : fields.organizationId;
	if (owner === null) {
		throw new FileOwnerUnresolvedError(fields.category);
	}
	return owner;
}

/** Owner namespace of a new upload request. */
export function resolveUploadOwnerId(input: Pick<CreateFileUploadUrlInput, "category" | "productId" | "organizationId" | "userId">): string {
	return resolveFileOwnerId({
		category: input.category,
		productId: input.productId ?? null,
		organizationId: input.organizationId ?? null,
		userId: input.userId ?? null,
	});
}

/** A person-owned upload (avatar, GitHub comment picture) may only be requested by that person. */
export function isOwnPersonalUpload(actorUserId: string, input: Pick<CreateFileUploadUrlInput, "userId">): boolean {
	return input.userId === actorUserId;
}

/**
 * An avatar is always the uploader's own — whoever asks, a platform SuperAdmin
 * included (the object key and the binding both follow the uploader).
 */
export function assertAvatarIsUploadersOwn(uploaderId: string, input: Pick<CreateFileUploadUrlInput, "category" | "userId">): void {
	if (input.category === "USER_AVATAR" && !isOwnPersonalUpload(uploaderId, input)) {
		throw new FileUploadForbiddenError("Cannot upload avatar for another user");
	}
}
