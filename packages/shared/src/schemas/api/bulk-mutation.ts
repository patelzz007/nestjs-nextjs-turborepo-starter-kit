import { z } from "zod";

/** Maximum rows accepted by generated bulk create / bulk delete endpoints. */
export const BULK_MUTATION_MAX_ITEMS = 100;

/** Shared request body for bulk soft-delete endpoints. */
export const BulkDeleteIdsSchema = z
	.object({
		ids: z.array(z.uuid()).min(1).max(BULK_MUTATION_MAX_ITEMS),
	})
	.strict();

export type BulkDeleteIdsInput = z.output<typeof BulkDeleteIdsSchema>;

/** Shared response payload for bulk soft-delete endpoints. */
export const BulkDeleteResultSchema = z
	.object({
		deletedCount: z.number().int().nonnegative(),
	})
	.strict();

export type BulkDeleteResult = z.output<typeof BulkDeleteResultSchema>;
