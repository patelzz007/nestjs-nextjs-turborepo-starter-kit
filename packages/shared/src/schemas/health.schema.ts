import { z } from "zod";

import { DateStringSchema } from "./common";

/** Health check response */
export const HealthResponseSchema = z
	.object({
		status: z.string(),
		db: z.string(),
		timestamp: DateStringSchema,
	})
	.strict();

// --- Inferred TypeScript types ---
export type HealthResponse = z.output<typeof HealthResponseSchema>;
