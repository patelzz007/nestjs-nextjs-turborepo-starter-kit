import { SetMetadata } from "@nestjs/common";

/** Metadata key used by AuthGuard to skip authentication for public routes */
export const IS_PUBLIC_KEY = "isPublic";

/**
 * Decorator that marks a route handler as public — no authentication required.
 *
 * Usage:
 * ```typescript
 * @Public()
 * @Post("/login")
 * public async login(...) { ... }
 * ```
 */
export const Public = (): ReturnType<typeof SetMetadata> => SetMetadata(IS_PUBLIC_KEY, true);
