import { z } from "zod";

import { BaseResponseSchema } from "../api/common";

// ── Scope literals ───────────────────────────────────────────────────────

export const API_KEY_SCOPES: ["read", "write", "delete"] = ["read", "write", "delete"];
export const API_KEY_RATE_LIMIT_TIERS: ["standard", "pro", "enterprise"] = ["standard", "pro", "enterprise"];

// ── Input Schemas ────────────────────────────────────────────────────────

export const CreateApiKeySchema = z
	.object({
		name: z.string().min(1).max(100),
		scopes: z.array(z.enum(API_KEY_SCOPES)).min(1).max(3).optional().default(["read", "write"]),
		rateLimitTier: z.enum(API_KEY_RATE_LIMIT_TIERS).optional().default("standard"),
		expiresAt: z
			.string()
			// eslint-disable-next-line @typescript-eslint/no-deprecated -- z.string().datetime() is the only viable option (z.iso.datetime() doesn't exist on string)
			.datetime({ offset: true })
			.transform((val: string) => new Date(val))
			.optional(),
	})
	.strict();

export type CreateApiKeyInput = z.output<typeof CreateApiKeySchema>;

export const UpdateApiKeySchema = z
	.object({
		name: z.string().min(1).max(100).optional(),
		isActive: z.boolean().optional(),
		scopes: z.array(z.enum(API_KEY_SCOPES)).min(1).max(3).optional(),
		expiresAt: z
			.string()
			// eslint-disable-next-line @typescript-eslint/no-deprecated -- z.string().datetime() is the only viable option (z.iso.datetime() doesn't exist on string)
			.datetime({ offset: true })
			.transform((val: string) => new Date(val))
			.optional(),
	})
	.strict();

export type UpdateApiKeyInput = z.output<typeof UpdateApiKeySchema>;

export const ApiKeyQuerySchema = z
	.object({
		search: z.string().optional(),
		isActive: z.coerce.boolean().optional(),
		scope: z.enum(API_KEY_SCOPES).optional(),
		rateLimitTier: z.enum(API_KEY_RATE_LIMIT_TIERS).optional(),
		expired: z.coerce.boolean().optional(),
		page: z.coerce.number().int().min(1).optional().default(1),
		limit: z.coerce.number().int().min(1).max(100).optional().default(20),
	})
	.strict();

export type ApiKeyQueryInput = z.output<typeof ApiKeyQuerySchema>;

export const UsageLogQuerySchema = z
	.object({
		from: z
			.string()
			// eslint-disable-next-line @typescript-eslint/no-deprecated
			.datetime({ offset: true })
			.transform((val: string) => new Date(val))
			.optional(),
		to: z
			.string()
			// eslint-disable-next-line @typescript-eslint/no-deprecated
			.datetime({ offset: true })
			.transform((val: string) => new Date(val))
			.optional(),
		method: z.string().optional(),
		statusCode: z.coerce.number().int().optional(),
		page: z.coerce.number().int().min(1).optional().default(1),
		limit: z.coerce.number().int().min(1).max(200).optional().default(50),
	})
	.strict();

export type UsageLogQueryInput = z.output<typeof UsageLogQuerySchema>;

// ── Response Schemas ─────────────────────────────────────────────────────

export const ApiKeyMessageResponseSchema = z
	.object({
		message: z.string(),
	})
	.strict();

export type ApiKeyMessageResponse = z.output<typeof ApiKeyMessageResponseSchema>;

export const SafeApiKeySchema = BaseResponseSchema.extend({
	id: z.string(),
	name: z.string(),
	keyPrefix: z.string(),
	scopes: z.array(z.string()),
	rateLimitTier: z.string(),
	totalRequests: z.number(),
	isActive: z.boolean(),
	lastUsedAt: z.string().nullable(),
	expiresAt: z.string().nullable(),
});

export type SafeApiKey = z.output<typeof SafeApiKeySchema>;

export const AdminApiKeySchema = SafeApiKeySchema.extend({
	userId: z.string(),
});

export type AdminApiKey = z.output<typeof AdminApiKeySchema>;

export const UsageLogEntrySchema = BaseResponseSchema.extend({
	id: z.string(),
	apiKeyId: z.string(),
	endpoint: z.string(),
	method: z.string(),
	statusCode: z.number(),
	ipAddress: z.string().nullable(),
	userAgent: z.string().nullable(),
	responseTimeMs: z.number().nullable(),
});

export type UsageLogEntry = z.output<typeof UsageLogEntrySchema>;

export const UsageStatsResponseSchema = z.object({
	apiKeyId: z.string(),
	totalRequests: z.number(),
	period: z.object({ from: z.string(), to: z.string() }),
	byMethod: z.array(z.object({ method: z.string(), count: z.number() })),
	byStatusCode: z.array(z.object({ statusCode: z.number(), count: z.number() })),
	byEndpoint: z.array(z.object({ endpoint: z.string(), count: z.number() })),
	byDay: z.array(z.object({ day: z.string(), count: z.number() })),
});

export type UsageStatsResponse = z.output<typeof UsageStatsResponseSchema>;

/** Verified key result returned after API key verification (guard-level). */
export const VerifiedApiKeySchema = z.object({
	apiKeyId: z.string(),
	userId: z.string(),
	scopes: z.array(z.string()),
	rateLimitTier: z.string(),
});

export type VerifiedApiKey = z.output<typeof VerifiedApiKeySchema>;
