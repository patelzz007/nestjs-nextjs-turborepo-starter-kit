import { LogoutAllResponseSchema } from "@workspace/shared";
import { createZodDto } from "nestjs-zod";

export class LogoutAllResponseDto extends createZodDto(LogoutAllResponseSchema) {}
