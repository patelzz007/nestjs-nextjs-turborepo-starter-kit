import { createZodDto } from "nestjs-zod/dto"
import { LoginResponseSchema } from "@workspace/shared"

/** DTO for login response — auto-generates OpenAPI schema via nestjs-zod */
export class LoginResponseDto extends createZodDto(LoginResponseSchema) {}
