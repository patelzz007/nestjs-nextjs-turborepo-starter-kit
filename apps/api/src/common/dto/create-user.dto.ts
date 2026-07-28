import { createZodDto } from "nestjs-zod/dto"
import { CreateUserSchema } from "@workspace/shared"

/** DTO for creating a user — auto-generates OpenAPI schema via nestjs-zod */
export class CreateUserDto extends createZodDto(CreateUserSchema) {}
