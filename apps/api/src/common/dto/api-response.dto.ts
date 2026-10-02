import { ApiErrorResponseSchema } from "@workspace/shared";
import { createZodDto } from "nestjs-zod";

/**
 * Swagger component for the `{ success: false, error, meta }` error envelope
 * (ADR 016). Every response decorator (`@ZodResponse` & co., ADR 022)
 * documents `4XX` / `5XX` with it; add a specific
 * `@ApiResponse({ status: 409, type: ApiErrorResponseDto, description })`
 * where a particular failure deserves its own description.
 *
 * Success responses are NOT documented with DTO classes: they come from the
 * shared zod schema of each handler's response decorator.
 */
export class ApiErrorResponseDto extends createZodDto(ApiErrorResponseSchema) {}
