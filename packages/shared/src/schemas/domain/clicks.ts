import { z } from "zod";

import { DateStringSchema } from "../api/common";
import { DeviceTypeSchema } from "./enums";
import { PaginationSchema } from "../api/pagination";

export const ClickQuerySchema = PaginationSchema.extend({
	from: z.iso.datetime({ offset: true }).optional(),
	to: z.iso.datetime({ offset: true }).optional(),
	deviceType: DeviceTypeSchema.optional(),
	country: z.string().optional(),
	browser: z.string().optional(),
}).strict();

export type ClickQueryInput = z.output<typeof ClickQuerySchema>;

export const AnalyticsQuerySchema = z
	.object({
		from: z.iso.datetime({ offset: true }).optional(),
		to: z.iso.datetime({ offset: true }).optional(),
	})
	.strict();

export type AnalyticsQueryInput = z.output<typeof AnalyticsQuerySchema>;

// ── Response Schemas ─────────────────────────────────────────────────────

export const ClickRecordResponseSchema = z.object({
	id: z.string(),
	ipAddress: z.string().nullable(),
	country: z.string().nullable(),
	city: z.string().nullable(),
	deviceType: z.string(),
	os: z.string().nullable(),
	browser: z.string().nullable(),
	referrer: z.string().nullable(),
	utmSource: z.string().nullable(),
	utmMedium: z.string().nullable(),
	utmCampaign: z.string().nullable(),
	clickedAt: DateStringSchema,
});

export type ClickRecordResponse = z.output<typeof ClickRecordResponseSchema>;

export const UrlAnalyticsResponseSchema = z.object({
	urlId: z.string(),
	period: z.object({ from: DateStringSchema, to: DateStringSchema }),
	totalClicks: z.number(),
	byDevice: z.array(z.object({ device: z.string(), count: z.number() })),
	byCountry: z.array(z.object({ country: z.string(), count: z.number() })),
	byBrowser: z.array(z.object({ browser: z.string(), count: z.number() })),
	byOs: z.array(z.object({ os: z.string(), count: z.number() })),
	byReferrer: z.array(z.object({ referrer: z.string().nullable(), count: z.number() })),
	byUtmSource: z.array(z.object({ source: z.string().nullable(), count: z.number() })),
	byDay: z.array(z.object({ day: DateStringSchema, count: z.number() })),
});

export type UrlAnalyticsResponse = z.output<typeof UrlAnalyticsResponseSchema>;

export const AccountAnalyticsResponseSchema = z.object({
	period: z.object({ from: DateStringSchema, to: DateStringSchema }),
	totalClicks: z.number(),
	topUrls: z.array(
		z.object({
			id: z.string(),
			shortCode: z.string(),
			customAlias: z.string().nullable(),
			title: z.string().nullable(),
			clickCount: z.number(),
			clicksInPeriod: z.number(),
		}),
	),
	byDay: z.array(z.object({ day: DateStringSchema, count: z.number() })),
	byDevice: z.array(z.object({ device: z.string(), count: z.number() })),
	byCountry: z.array(z.object({ country: z.string(), count: z.number() })),
});

export type AccountAnalyticsResponse = z.output<typeof AccountAnalyticsResponseSchema>;

export const AdminOverviewResponseSchema = z.object({
	period: z.object({ from: DateStringSchema, to: DateStringSchema }),
	totalClicks: z.number(),
	activeUrls: z.number(),
	totalUsers: z.number(),
	topUrls: z.array(
		z.object({
			id: z.string(),
			shortCode: z.string(),
			customAlias: z.string().nullable(),
			title: z.string().nullable(),
			clickCount: z.number(),
			clicksInPeriod: z.number(),
			userId: z.string(),
			user: z.object({ email: z.string(), fullName: z.string() }).nullable(),
		}),
	),
	byDay: z.array(z.object({ day: DateStringSchema, count: z.number() })),
});

export type AdminOverviewResponse = z.output<typeof AdminOverviewResponseSchema>;

export const AdminUrlItemSchema = z.object({
	id: z.string(),
	shortCode: z.string(),
	customAlias: z.string().nullable(),
	originalUrl: z.string(),
	title: z.string().nullable(),
	clickCount: z.number(),
	isActive: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string(),
	isDeleted: z.boolean(),
	deletedAt: z.string().nullable(),
	user: z.object({ id: z.string(), email: z.string(), fullName: z.string() }).nullable(),
});

export type AdminUrlItem = z.output<typeof AdminUrlItemSchema>;

export const AdminUserItemSchema = z.object({
	id: z.string(),
	email: z.string(),
	fullName: z.string(),
	plan: z.string(),
	totalUrls: z.number(),
	totalClicks: z.number(),
	createdAt: z.string(),
	updatedAt: z.string(),
	isDeleted: z.boolean(),
	deletedAt: z.string().nullable(),
});

export type AdminUserItem = z.output<typeof AdminUserItemSchema>;
