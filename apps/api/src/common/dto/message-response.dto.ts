import { createZodDto } from "nestjs-zod";
import { MessageResponseSchema } from "@workspace/shared";

/**
 * Generic message response DTO — used for endpoints that return only a message string.
 * Auto-generates Swagger schema via nestjs-zod.
 */
export class MessageResponseDto extends createZodDto(MessageResponseSchema) {}
