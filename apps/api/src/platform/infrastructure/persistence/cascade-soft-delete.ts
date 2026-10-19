import type { Prisma } from "@prisma/client";

/** Arguments shared by cascade soft-delete / restore mutations inside a transaction. */
export interface CascadeSoftDeleteMutationArgs {
	readonly parentId: string;
	readonly deletedAt: number;
	readonly transaction: Prisma.TransactionClient;
}

/** Arguments for restoring a soft-deleted parent row. */
export interface CascadeRestoreParentArgs {
	readonly parentId: string;
	readonly transaction: Prisma.TransactionClient;
}

/**
 * Hooks that soft-delete or restore dependent rows when a parent is deleted or
 * restored. They always run inside one transaction opened by the base repository.
 */
export interface CascadeSoftDeletePorts {
	readonly softDeleteChildren: (args: CascadeSoftDeleteMutationArgs) => Promise<void>;
	readonly restoreChildren: (args: CascadeSoftDeleteMutationArgs) => Promise<void>;
	/**
	 * Soft-deletes the parent ONLY while it is still live — a conditional
	 * `updateMany` (`where: { id, deletedAt: null }`) — and returns the number
	 * of rows it changed. `0` means the parent is missing or already deleted:
	 * the repository answers 404 and rolls the transaction back, so children
	 * are never touched for a parent another request deleted first.
	 */
	readonly softDeleteParent: (args: CascadeSoftDeleteMutationArgs) => Promise<number>;
	readonly restoreParent: (args: CascadeRestoreParentArgs) => Promise<void>;
}
