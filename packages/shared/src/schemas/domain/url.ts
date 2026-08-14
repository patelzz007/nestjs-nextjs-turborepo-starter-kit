import { z } from "zod";

import { BaseResponseSchema, EpochMsSchema } from "../api/common";
import { PaginationSchema } from "../api/pagination";

// ── Input Schemas ────────────────────────────────────────────────────────

export const CreateUrlSchema = z
	.object({
		originalUrl: z.url("originalUrl must be a valid URL").max(2048),
		title: z.string().max(255).optional(),
		customAlias: z
			.string()
			.min(3)
			.max(64)
			.regex(/^[a-zA-Z0-9_-]+$/, "customAlias may only contain letters, numbers, hyphens, and underscores")
			.optional(),
		redirectType: z.enum(["PERMANENT", "TEMPORARY"]).optional().default("TEMPORARY"),
		password: z.string().max(72).optional(),
		clickLimit: z.coerce.number().int().min(1).optional(),
		expiresAt: EpochMsSchema.optional(),
	})
	.strict();

export type CreateUrlInput = z.output<typeof CreateUrlSchema>;

export const UpdateUrlSchema = z
	.object({
		originalUrl: z.url("Must be a valid URL").max(2048).optional(),
		title: z.string().max(255).optional(),
		redirectType: z.enum(["PERMANENT", "TEMPORARY"]).optional(),
		isActive: z.boolean().optional(),
		clickLimit: z.coerce.number().int().min(1).optional(),
		expiresAt: EpochMsSchema.optional(),
	})
	.strict();

export type UpdateUrlInput = z.output<typeof UpdateUrlSchema>;

export const UrlQuerySchema = PaginationSchema.extend({
	isActive: z.coerce.boolean().optional(),
	tagId: z.string().optional(),
	search: z.string().optional(),
}).strict();

export type UrlQueryInput = z.output<typeof UrlQuerySchema>;

// ── Response Schemas ─────────────────────────────────────────────────────

export const UrlResponseSchema = BaseResponseSchema.extend({
	id: z.string(),
	shortCode: z.string(),
	customAlias: z.string().nullable(),
	originalUrl: z.string(),
	title: z.string().nullable(),
	redirectType: z.string(),
	isActive: z.boolean(),
	clickCount: z.number(),
	clickLimit: z.number().nullable(),
	expiresAt: EpochMsSchema.nullable(),
	tags: z.array(
		z.object({
			tag: z.object({
				id: z.string(),
				name: z.string(),
				color: z.string(),
			}),
		}),
	),
});

export type UrlResponse = z.output<typeof UrlResponseSchema>;

export const UrlMessageResponseSchema = z
	.object({
		message: z.string(),
	})
	.strict();

export type UrlMessageResponse = z.output<typeof UrlMessageResponseSchema>;

export const RedirectResponseSchema = z.object({
	redirectUrl: z.string(),
	redirectType: z.string(),
});

export type RedirectResponse = z.output<typeof RedirectResponseSchema>;

export const UrlStatsResponseSchema = z.object({
	urlId: z.string(),
	totalClicks: z.number(),
	clicksByDay: z.array(z.object({ date: z.string(), count: z.number() })),
	clicksByCountry: z.array(z.object({ country: z.string(), count: z.number() })),
	clicksByDevice: z.array(z.object({ device: z.string(), count: z.number() })),
	clicksByBrowser: z.array(z.object({ browser: z.string(), count: z.number() })),
});

export type UrlStatsResponse = z.output<typeof UrlStatsResponseSchema>;
