import { AdminUserDetailSchema } from "@workspace/shared";
import { createZodDto } from "nestjs-zod";

/**
 * DTO for admin user detail response — includes internal security fields
 * (failedLoginAttempts, lockedUntil) that are not exposed to regular users.
 */
export class AdminUserDetailDto extends createZodDto(AdminUserDetailSchema) {}
