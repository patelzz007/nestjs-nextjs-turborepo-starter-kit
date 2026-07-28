import { createZodDto } from "nestjs-zod/dto"
import { CreateUserResponseSchema } from "@workspace/shared"

/** DTO for create user response — auto-generates OpenAPI schema via nestjs-zod */
export class CreateUserResponseDto extends createZodDto(CreateUserResponseSchema) {}
