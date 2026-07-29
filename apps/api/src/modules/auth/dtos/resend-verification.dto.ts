import { createZodDto } from "nestjs-zod";
import { ResendVerificationSchema, ResendVerificationResponseSchema } from "@workspace/shared";

/** Request DTO for POST /auth/resend-verification */
export class ResendVerificationDto extends createZodDto(ResendVerificationSchema) {}

/** Response DTO for POST /auth/resend-verification */
export class ResendVerificationResponseDto extends createZodDto(ResendVerificationResponseSchema) {}
