import { SetMetadata } from "@nestjs/common";

import type { SystemOperation } from "../../../../../prisma/system-operation.registry";

/** Metadata key read by `RlsInterceptor` to run the handler under one named platform operation. */
export const PLATFORM_OPERATION_KEY = "platformOperation";

/**
 * Declares the allowlisted system operation an admin-console route runs under.
 * The interceptor uses this instead of the superadmin bypass.
 */
export const PlatformOperation = (operation: SystemOperation): ReturnType<typeof SetMetadata> => SetMetadata(PLATFORM_OPERATION_KEY, operation);
