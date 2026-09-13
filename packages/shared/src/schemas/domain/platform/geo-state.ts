import { z } from "zod";

import { DataValueSchema } from "../../api/common";
import { PaginationSchema } from "../../api/pagination";
import { GeoCursorSchema, GeoDateTimeFieldSchema, GeoIdSchema, GeoIdsSchema, GeoIncludeSchema } from "./geo-shared";

export const StateSchema = z
	.object({
		id: GeoIdSchema,
		name: z.string(),
		countryCode: z.string(),
		fipsCode: z.string().nullable(),
		iso2: z.string().nullable(),
		iso3166_2: z.string().nullable(),
		type: z.string().nullable(),
		level: z.number().int().nullable(),
		parentId: GeoIdSchema.nullable(),
		native: z.string().nullable(),
		latitude: z.number().nullable(),
		longitude: z.number().nullable(),
		timezone: z.string().nullable(),
		translations: DataValueSchema.nullable(),
		wikiDataId: z.string().nullable(),
		flag: z.boolean(),
		countryId: GeoIdSchema,
		createdAt: GeoDateTimeFieldSchema,
		updatedAt: GeoDateTimeFieldSchema,
	})
	.strict();

export type State = z.output<typeof StateSchema>;

export const CreateStateSchema = z
	.object({
		name: z.string().min(1).max(255),
		countryCode: z.string().length(2),
		countryId: z.number().int().nonnegative(),
		fipsCode: z.string().max(255).optional(),
		iso2: z.string().max(255).optional(),
		iso3166_2: z.string().max(255).optional(),
		type: z.string().max(191).optional(),
		level: z.number().int().optional(),
		parentId: z.number().int().nonnegative().nullable().optional(),
		native: z.string().max(255).optional(),
		latitude: z.coerce.number().min(-90).max(90).optional(),
		longitude: z.coerce.number().min(-180).max(180).optional(),
		timezone: z.string().max(255).optional(),
		translations: DataValueSchema.optional(),
		wikiDataId: z.string().max(255).optional(),
		flag: z.boolean().optional().default(true),
	})
	.strict();

export type CreateStateInput = z.output<typeof CreateStateSchema>;

export const UpdateStateSchema = z
	.object({
		name: z.string().min(1).max(255).optional(),
		countryCode: z.string().length(2).optional(),
		countryId: z.number().int().nonnegative().optional(),
		fipsCode: z.string().max(255).nullable().optional(),
		iso2: z.string().max(255).nullable().optional(),
		iso3166_2: z.string().max(255).nullable().optional(),
		type: z.string().max(191).nullable().optional(),
		level: z.number().int().nullable().optional(),
		parentId: z.number().int().nonnegative().nullable().optional(),
		native: z.string().max(255).nullable().optional(),
		latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
		longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
		timezone: z.string().max(255).nullable().optional(),
		translations: DataValueSchema.nullable().optional(),
		wikiDataId: z.string().max(255).nullable().optional(),
		flag: z.boolean().optional(),
	})
	.strict()
	.refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided" });

export type UpdateStateInput = z.output<typeof UpdateStateSchema>;

export const StateListQuerySchema = PaginationSchema.extend({
	search: z.string().optional(),
	countryId: z.coerce.number().int().nonnegative().optional(),
	countryCode: z.string().length(2).optional(),
	flag: z.coerce.boolean().optional(),
	ids: GeoIdsSchema,
	sort: z.string().optional(),
	cursor: GeoCursorSchema,
	include: GeoIncludeSchema,
}).strict();

export type StateListQuery = z.output<typeof StateListQuerySchema>;
