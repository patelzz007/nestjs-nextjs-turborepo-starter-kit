import { createZodDto } from "nestjs-zod/dto"
import { LoginSchema } from "@workspace/shared"

/** DTO for login requests — auto-generates OpenAPI schema via nestjs-zod */
export class LoginRequestDto extends createZodDto(LoginSchema) {}
