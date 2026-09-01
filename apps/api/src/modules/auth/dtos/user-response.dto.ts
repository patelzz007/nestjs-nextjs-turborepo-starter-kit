import { UserResponseSchema } from "@workspace/shared";
import { createZodDto } from "nestjs-zod";

export class UserResponseDto extends createZodDto(UserResponseSchema) {}
