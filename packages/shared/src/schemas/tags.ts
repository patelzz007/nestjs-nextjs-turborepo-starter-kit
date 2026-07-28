import { z } from "zod";
import { BaseResponseSchema } from "./common";

export const CreateTagSchema = z
	.object({
		name: z.string().min(1).max(50),
		color: z
			.string()
			.regex(/^#[0-9a-fA-F]{6}$/, "Color must be a valid hex color (e.g. #6366f1)")
			.optional()
			.default("#6366f1"),
	})
	.strict();

export type CreateTagInput = z.output<typeof CreateTagSchema>;

export const UpdateTagSchema = z
	.object({
		name: z.string().min(1).max(50).optional(),
		color: z
			.string()
			.regex(/^#[0-9a-fA-F]{6}$/, "Color must be a valid hex color (e.g. #6366f1)")
			.optional(),
	})
	.strict();

export type UpdateTagInput = z.output<typeof UpdateTagSchema>;

// ── Response Schemas ─────────────────────────────────────────────────────

export const TagResponseSchema = BaseResponseSchema.extend({
	id: z.string(),
	name: z.string(),
	color: z.string(),
	_count: z.object({ urls: z.number() }),
});

export type TagResponse = z.output<typeof TagResponseSchema>;

export const TagWithUrlsResponseSchema = TagResponseSchema.extend({
	urls: z.array(
		z.object({
			url: z.object({
				id: z.string(),
				shortCode: z.string(),
				customAlias: z.string().nullable(),
				originalUrl: z.string(),
				title: z.string().nullable(),
				isActive: z.boolean(),
				clickCount: z.number(),
				createdAt: z.string(),
			}),
		}),
	),
});

export type TagWithUrlsResponse = z.output<typeof TagWithUrlsResponseSchema>;

export const TagMessageResponseSchema = z
	.object({
		message: z.string(),
	})
	.strict();

export type TagMessageResponse = z.output<typeof TagMessageResponseSchema>;

export const TagAssignResponseSchema = z.object({
	urlId: z.string(),
	tagId: z.string(),
	tag: z.object({ id: z.string(), name: z.string(), color: z.string() }),
	url: z.object({ id: z.string(), shortCode: z.string(), title: z.string().nullable() }),
});

export type TagAssignResponse = z.output<typeof TagAssignResponseSchema>;
