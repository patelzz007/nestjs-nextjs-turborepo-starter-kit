import { ForgotPasswordSchema, ForgotPasswordResponseSchema } from "@workspace/shared";
import { createZodDto } from "nestjs-zod";

/** Request DTO for POST /auth/forgot-password */
export class ForgotPasswordDto extends createZodDto(ForgotPasswordSchema) {}

/** Response DTO for POST /auth/forgot-password */
export class ForgotPasswordResponseDto extends createZodDto(ForgotPasswordResponseSchema) {}
