import { z } from "zod";

/** Optional store filter for tenant-scoped operational queries (analytics, redemptions, API keys). */
export const LocationFilterSchema = z
	.object({
		locationId: z.uuid().optional(),
	})
	.strict();

export type LocationFilter = z.output<typeof LocationFilterSchema>;
