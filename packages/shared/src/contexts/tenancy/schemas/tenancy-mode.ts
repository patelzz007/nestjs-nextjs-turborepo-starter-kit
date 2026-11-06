import { z } from "zod";
import { idSchema } from "../../../schemas/api/id";

/**
 * Whether this process serves one tenant or many.
 * `TENANCY_ENABLED=false` is single; `TENANCY_ENABLED=true` is multi.
 */
export const TenancyModeSchema = z.enum(["single", "multi"]);

export type TenancyMode = z.output<typeof TenancyModeSchema>;

/** The id of the one tenant a single-mode deployment serves. */
export const TenantIdSchema = idSchema("Tenant");

export type TenantId = z.output<typeof TenantIdSchema>;
