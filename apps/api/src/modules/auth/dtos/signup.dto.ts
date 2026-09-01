import { SignupSchema, SignupResponseSchema } from "@workspace/shared";
import { createZodDto } from "nestjs-zod";

// zod-to-nestjs bridge: auto-generates Swagger decorators + Zod validation
export class SignupDto extends createZodDto(SignupSchema) {}

/** Response DTO for POST /auth/signup */
export class SignupResponseDto extends createZodDto(SignupResponseSchema) {}
