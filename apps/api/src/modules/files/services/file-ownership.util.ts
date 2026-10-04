import type { StoredFile } from "@prisma/client";
import type { CreateFileUploadUrlInput, FileCategory } from "@workspace/shared";

/** The resource an upload's object keys are namespaced under could not be determined. */
export class FileOwnerUnresolvedError extends Error {
	public constructor(public readonly category: FileCategory) {
		super(`Missing resource binding for a ${category} upload`);
		this.name = "FileOwnerUnresolvedError";
	}
}

interface OwnerFields {
	readonly category: FileCategory;
	readonly productId: string | null;
	readonly organizationId: string | null;
	readonly userId: string | null;
}

/** Object keys are namespaced by the resource that owns the file: product, organization, or (avatar) user. */
function resolveOwner(fields: OwnerFields): string {
	const owner = fields.category === "PRODUCT_IMAGE" ? fields.productId : fields.category === "USER_AVATAR" ? fields.userId : fields.organizationId;
	if (owner === null) {
		throw new FileOwnerUnresolvedError(fields.category);
	}
	return owner;
}

/** Owner namespace for a new upload request. */
export function resolveUploadOwnerId(input: CreateFileUploadUrlInput): string {
	return resolveOwner({
		category: input.category,
		productId: input.productId ?? null,
		organizationId: input.organizationId ?? null,
		userId: input.userId ?? null,
	});
}

/** Owner namespace of a stored file (from persisted columns — never parsed back out of its object key). */
export function resolveStorageOwnerId(file: StoredFile): string {
	return resolveOwner({
		category: file.category,
		productId: file.productId,
		organizationId: file.organizationId,
		userId: file.uploadedById,
	});
}
