import { createZodDto } from "nestjs-zod";
import { RefreshResponseMessageSchema } from "@workspace/shared";

export class RefreshResponseMessageDto extends createZodDto(RefreshResponseMessageSchema) {}
