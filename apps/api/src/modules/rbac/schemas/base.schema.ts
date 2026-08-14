import { BaseResponseSchema } from "@workspace/shared";

/**
 * Base schema extended by all response schemas.
 * Provides consistent timestamp and soft-delete fields.
 *
 * Re-exported from `@workspace/shared` — all timestamps are epoch
 * milliseconds (the single time representation across DB, API, and UI).
 */
export { BaseResponseSchema };
