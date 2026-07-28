import { z } from "zod"

/** Login request body */
export const LoginRequestSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
  })
  .strict()

/** Login response */
export const LoginResponseSchema = z
  .object({
    accessToken: z.string(),
    tokenType: z.literal("Bearer"),
    expiresIn: z.number().int().positive(),
  })
  .strict()

// --- Inferred TypeScript types ---
export type LoginRequest = z.output<typeof LoginRequestSchema>
export type LoginResponse = z.output<typeof LoginResponseSchema>
