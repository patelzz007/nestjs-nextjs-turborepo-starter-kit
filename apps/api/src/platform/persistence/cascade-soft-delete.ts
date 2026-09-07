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

/** Hooks that soft-delete or restore dependent rows when a parent is deleted or restored. */
export interface CascadeSoftDeletePorts {
	readonly softDeleteChildren: (args: CascadeSoftDeleteMutationArgs) => Promise<void>;
	readonly restoreChildren: (args: CascadeSoftDeleteMutationArgs) => Promise<void>;
	readonly softDeleteParent: (args: CascadeSoftDeleteMutationArgs) => Promise<void>;
	readonly restoreParent: (args: CascadeRestoreParentArgs) => Promise<void>;
}
