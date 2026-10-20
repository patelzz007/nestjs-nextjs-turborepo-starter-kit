import { z } from "zod";

/** Optional store filter for org-scoped operational queries (analytics, redemptions, API keys). */
export const OrganizationLocationFilterSchema = z
	.object({
		locationId: z.uuid().optional(),
	})
	.strict();

export type OrganizationLocationFilter = z.output<typeof OrganizationLocationFilterSchema>;
