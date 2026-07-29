import { createZodDto } from "nestjs-zod";
import { LoginSchema, LoginResponseSchema } from "@workspace/shared";

// zod-to-nestjs bridge: auto-generates Swagger decorators + Zod validation
export class LoginDto extends createZodDto(LoginSchema) {}

/** Response DTO for POST /auth/login */
export class LoginResponseDto extends createZodDto(LoginResponseSchema) {}
