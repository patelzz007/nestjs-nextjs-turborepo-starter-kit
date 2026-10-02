import { ResetPasswordResponseSchema } from "@workspace/shared";
import { createZodDto } from "nestjs-zod";

/** Response DTO for POST /auth/reset-password */
export class ResetPasswordResponseDto extends createZodDto(ResetPasswordResponseSchema) {}
