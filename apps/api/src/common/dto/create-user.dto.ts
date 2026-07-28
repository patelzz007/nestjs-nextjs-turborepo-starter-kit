import { createZodDto } from "nestjs-zod/dto"
import { SignupSchema } from "@workspace/shared"

/** DTO for creating a user — auto-generates OpenAPI schema via nestjs-zod */
export class CreateUserDto extends createZodDto(SignupSchema) {}
