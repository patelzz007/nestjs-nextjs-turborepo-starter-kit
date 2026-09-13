import { z } from "zod";

/** Signed tenant job context for background workers. */
export const TenantJobContextSchema = z
	.object({
		organizationId: z.uuid(),
		initiatingActorId: z.uuid().nullable(),
		purpose: z.string().min(1).max(120),
		policyVersion: z.number().int().nonnegative(),
		correlationId: z.string().max(64),
		issuedAt: z.number().int().nonnegative(),
		expiresAt: z.number().int().nonnegative(),
		signature: z.string().min(1),
	})
	.strict();

export type TenantJobContext = z.output<typeof TenantJobContextSchema>;

export const SystemOperationContextSchema = z
	.object({
		operation: z.string().min(1).max(120),
		reason: z.string().min(1).max(500),
		correlationId: z.string().max(64),
		actorUserId: z.uuid().nullable(),
	})
	.strict();

export type SystemOperationContext = z.output<typeof SystemOperationContextSchema>;
