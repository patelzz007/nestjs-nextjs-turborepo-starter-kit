import { createZodDto } from "nestjs-zod";
import { SessionSchema } from "@workspace/shared";

export class SessionDto extends createZodDto(SessionSchema) {}
