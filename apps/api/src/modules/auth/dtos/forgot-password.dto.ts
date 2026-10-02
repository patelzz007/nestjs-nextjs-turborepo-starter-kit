import { ForgotPasswordResponseSchema } from "@workspace/shared";
import { createZodDto } from "nestjs-zod";

/** Response DTO for POST /auth/forgot-password */
export class ForgotPasswordResponseDto extends createZodDto(ForgotPasswordResponseSchema) {}
