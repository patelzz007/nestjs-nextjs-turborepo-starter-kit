import { z } from "zod";

import { EpochMsSchema } from "./common";

/** Health check response */
export const HealthResponseSchema = z
	.object({
		status: z.string(),
		db: z.string(),
		timestamp: EpochMsSchema,
	})
	.strict();

// --- Inferred TypeScript types ---
export type HealthResponse = z.output<typeof HealthResponseSchema>;
