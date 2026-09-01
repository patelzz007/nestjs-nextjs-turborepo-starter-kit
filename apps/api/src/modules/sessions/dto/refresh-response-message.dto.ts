import { RefreshResponseMessageSchema } from "@workspace/shared";
import { createZodDto } from "nestjs-zod";

export class RefreshResponseMessageDto extends createZodDto(RefreshResponseMessageSchema) {}
