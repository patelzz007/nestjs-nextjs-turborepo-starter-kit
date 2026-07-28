import { z } from "zod"

/** Health check response */
export const HealthResponseSchema = z
  .object({
    status: z.string(),
    db: z.string(),
    timestamp: z.string().datetime(),
  })
  .strict()

// --- Inferred TypeScript types ---
export type HealthResponse = z.output<typeof HealthResponseSchema>
