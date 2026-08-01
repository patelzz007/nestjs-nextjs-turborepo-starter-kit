import { VerifyEmailResponseSchema } from "@workspace/shared";
import { createZodDto } from "nestjs-zod";

export class VerifyEmailResponseDto extends createZodDto(VerifyEmailResponseSchema) {}
