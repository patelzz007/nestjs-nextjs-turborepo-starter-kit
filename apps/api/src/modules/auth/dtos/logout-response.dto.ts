import { LogoutResponseSchema } from "@workspace/shared";
import { createZodDto } from "nestjs-zod";

export class LogoutResponseDto extends createZodDto(LogoutResponseSchema) {}
