import { SessionSchema } from "@workspace/shared";
import { createZodDto } from "nestjs-zod";

export class SessionDto extends createZodDto(SessionSchema) {}
