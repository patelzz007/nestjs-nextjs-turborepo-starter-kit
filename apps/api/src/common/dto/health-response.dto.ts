import { createZodDto } from "nestjs-zod/dto"
import { HealthResponseSchema } from "@workspace/shared"

/** DTO for health check response — auto-generates OpenAPI schema via nestjs-zod */
export class HealthResponseDto extends createZodDto(HealthResponseSchema) {}
