import { SetMetadata } from "@nestjs/common";

import type { SystemOperation } from "../../../../../prisma/system-operation.registry";

/** Metadata key read by `RlsInterceptor` to run a public or pre-authentication handler under one named operation. */
export const PUBLIC_OPERATION_KEY = "publicOperation";

/**
 * Declares the allowlisted system operation a public flow runs under: a route that
 * runs before a principal is known (sign-up, sign-in, password reset), a signed
 * callback, or a token-gated transfer. It replaces the old route-wide bypass: the
 * operation's registry entry lists exactly the tables the flow touches.
 *
 * An admin-console route declares `@PlatformOperation` instead; a route never carries both.
 */
export const PublicOperation = (operation: SystemOperation): ReturnType<typeof SetMetadata> => SetMetadata(PUBLIC_OPERATION_KEY, operation);
