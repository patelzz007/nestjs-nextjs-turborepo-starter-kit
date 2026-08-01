import { ResetPasswordSchema, ResetPasswordResponseSchema } from "@workspace/shared";
import { createZodDto } from "nestjs-zod";

/** Request DTO for POST /auth/reset-password */
export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}

/** Response DTO for POST /auth/reset-password */
export class ResetPasswordResponseDto extends createZodDto(ResetPasswordResponseSchema) {}
