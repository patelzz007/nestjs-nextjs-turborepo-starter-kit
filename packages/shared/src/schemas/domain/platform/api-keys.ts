import { z } from "zod";

import { BaseResponseSchema, EpochMsSchema } from "../../api/common";
import { StrictMessageResponseSchema } from "../../api/message";

// ── Scope literals ───────────────────────────────────────────────────────

const ApiKeyScopeSchema = z.enum(["read", "write", "delete"]);
const ApiKeyRateLimitTierSchema = z.enum(["standard", "pro", "enterprise"]);

export const API_KEY_SCOPES: readonly z.output<typeof ApiKeyScopeSchema>[] = ApiKeyScopeSchema.options;
export const API_KEY_RATE_LIMIT_TIERS: readonly z.output<typeof ApiKeyRateLimitTierSchema>[] = ApiKeyRateLimitTierSchema.options;

// ── Input Schemas ────────────────────────────────────────────────────────

export const CreateApiKeySchema = z
	.object({
		name: z.string().min(1).max(100),
		scopes: z.array(ApiKeyScopeSchema).min(1).max(3).optional().default(["read", "write"]),
		rateLimitTier: ApiKeyRateLimitTierSchema.optional().default("standard"),
		expiresAt: EpochMsSchema.optional(),
	})
	.strict();

export type CreateApiKeyInput = z.output<typeof CreateApiKeySchema>;

export const UpdateApiKeySchema = z
	.object({
		name: z.string().min(1).max(100).optional(),
		isActive: z.boolean().optional(),
		scopes: z.array(ApiKeyScopeSchema).min(1).max(3).optional(),
		expiresAt: EpochMsSchema.optional(),
	})
	.strict();

export type UpdateApiKeyInput = z.output<typeof UpdateApiKeySchema>;

export const ApiKeyQuerySchema = z
	.object({
		search: z.string().optional(),
		isActive: z.coerce.boolean().optional(),
		scope: ApiKeyScopeSchema.optional(),
		rateLimitTier: ApiKeyRateLimitTierSchema.optional(),
		expired: z.coerce.boolean().optional(),
		page: z.coerce.number().int().min(1).optional().default(1),
		limit: z.coerce.number().int().min(1).max(100).optional().default(20),
	})
	.strict();

export type ApiKeyQueryInput = z.output<typeof ApiKeyQuerySchema>;

export const UsageLogQuerySchema = z
	.object({
		from: EpochMsSchema.optional(),
		to: EpochMsSchema.optional(),
		method: z.string().optional(),
		statusCode: z.coerce.number().int().optional(),
		page: z.coerce.number().int().min(1).optional().default(1),
		limit: z.coerce.number().int().min(1).max(200).optional().default(50),
	})
	.strict();

export type UsageLogQueryInput = z.output<typeof UsageLogQuerySchema>;

// ── Response Schemas ─────────────────────────────────────────────────────

export const ApiKeyMessageResponseSchema = StrictMessageResponseSchema;

export type ApiKeyMessageResponse = z.output<typeof ApiKeyMessageResponseSchema>;

export const SafeApiKeySchema = BaseResponseSchema.extend({
	id: z.string(),
	name: z.string(),
	keyPrefix: z.string(),
	scopes: z.array(z.string()),
	rateLimitTier: z.string(),
	totalRequests: z.number(),
	isActive: z.boolean(),
	lastUsedAt: EpochMsSchema.nullable(),
	expiresAt: EpochMsSchema.nullable(),
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
	period: z.object({ from: EpochMsSchema, to: EpochMsSchema }),
	byMethod: z.array(z.object({ method: z.string(), count: z.number() })),
	byStatusCode: z.array(z.object({ statusCode: z.number(), count: z.number() })),
	byEndpoint: z.array(z.object({ endpoint: z.string(), count: z.number() })),
	byDay: z.array(z.object({ day: EpochMsSchema, count: z.number() })),
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
