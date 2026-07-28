import { z } from "zod"

/** Full user entity — matches the Prisma model shape */
export const UserSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().min(1).max(100),
    role: z.enum(["admin", "seller", "bank"]),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

/** Payload for creating a user (registration) */
export const CreateUserSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    name: z.string().min(1).max(100),
    role: z.enum(["admin", "seller", "bank"]).default("seller"),
  })
  .strict()

/** Payload for updating a user — all fields optional */
export const UpdateUserSchema = CreateUserSchema.partial().strict()

/** Response returned after creating a user — never exposes password */
export const CreateUserResponseSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    role: z.enum(["admin", "seller", "bank"]),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

/** List users response */
export const UserListSchema = z
  .object({
    data: z.array(UserSchema),
    total: z.number().int().nonnegative(),
  })
  .strict()

// --- Inferred TypeScript types ---
export type User = z.output<typeof UserSchema>
export type CreateUser = z.output<typeof CreateUserSchema>
export type UpdateUser = z.output<typeof UpdateUserSchema>
export type CreateUserResponse = z.output<typeof CreateUserResponseSchema>
export type UserList = z.output<typeof UserListSchema>
