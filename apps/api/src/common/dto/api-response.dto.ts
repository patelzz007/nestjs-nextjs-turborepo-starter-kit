import { createZodDto } from "nestjs-zod";
import { ApiSuccessResponseSchema, ApiErrorResponseSchema } from "@workspace/shared";

/**
 * Wraps any successful response in the standard `{ success, data, meta }` envelope.
 * The `data` field is `z.unknown()` so Swagger shows a generic "object" type —
 * the endpoint-specific DTOs describe the actual data shape.
 *
 * Used in `@ApiOkResponse({ type: ApiSuccessResponseDto })` decorators to match
 * what the ResponseInterceptor actually returns.
 */
export class ApiSuccessResponseDto extends createZodDto(ApiSuccessResponseSchema) {}

/**
 * Wraps any error response in the `{ success: false, error, meta }` envelope.
 * Used in `@ApiResponse({ status: 4xx, type: ApiErrorResponseDto })` decorators.
 */
export class ApiErrorResponseDto extends createZodDto(ApiErrorResponseSchema) {}
