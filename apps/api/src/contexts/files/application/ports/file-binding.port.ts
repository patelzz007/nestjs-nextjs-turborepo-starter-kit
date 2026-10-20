import type { FileCategory, FileStatus } from "@workspace/shared";

/** Which files an owner is about to bind, and whose they must be. */
export interface FileBindingRequest {
	readonly category: FileCategory;
	readonly tenantId: string | null;
	/** When set, only files this user uploaded qualify. */
	readonly uploadedById: string | null;
	readonly fileIds: readonly string[];
}

/** One live file an owner may bind (no storage internals). */
export interface BindableFile {
	readonly id: string;
	readonly category: FileCategory;
	readonly status: FileStatus;
	readonly tenantId: string | null;
	readonly uploadedById: string;
	readonly originalName: string;
}

/**
 * `FileReferencePort` (§6.3): "is this file live and owned by X", with the
 * rows locked `FOR UPDATE` in the owner's transaction so a concurrent delete
 * waits until the binding commits. Obtained through
 * `createFilesTransactionalPorts(db)` with the owner's own transaction client.
 */
export interface FileReferencePort {
	/** The live files among `fileIds` that match the request, locked, in `fileIds` order. Missing ids are simply absent. */
	lockForBinding(request: FileBindingRequest): Promise<readonly BindableFile[]>;
}

/** Everything files exposes to another context's transaction. */
export interface FilesTransactionalPorts {
	readonly fileReferences: FileReferencePort;
}
