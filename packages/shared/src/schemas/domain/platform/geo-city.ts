import { z } from "zod";

import { DataValueSchema } from "../../api/common";
import { PaginationSchema } from "../../api/pagination";
import { GeoCursorSchema, GeoDateTimeFieldSchema, GeoIdSchema, GeoIdsSchema, GeoIncludeSchema } from "./geo-shared";

export const CitySchema = z
	.object({
		id: GeoIdSchema,
		name: z.string(),
		stateCode: z.string(),
		countryCode: z.string(),
		latitude: z.number(),
		longitude: z.number(),
		native: z.string().nullable(),
		timezone: z.string().nullable(),
		translations: DataValueSchema.nullable(),
		wikiDataId: z.string().nullable(),
		flag: z.boolean(),
		stateId: GeoIdSchema,
		countryId: GeoIdSchema,
		createdAt: GeoDateTimeFieldSchema,
		updatedAt: GeoDateTimeFieldSchema,
	})
	.strict();

export type City = z.output<typeof CitySchema>;

export const CreateCitySchema = z
	.object({
		name: z.string().min(1).max(255),
		stateCode: z.string().max(255),
		countryCode: z.string().length(2),
		stateId: z.number().int().nonnegative(),
		countryId: z.number().int().nonnegative(),
		latitude: z.coerce.number().min(-90).max(90),
		longitude: z.coerce.number().min(-180).max(180),
		native: z.string().max(255).optional(),
		timezone: z.string().max(255).optional(),
		translations: DataValueSchema.optional(),
		wikiDataId: z.string().max(255).optional(),
		flag: z.boolean().optional().default(true),
	})
	.strict();

export type CreateCityInput = z.output<typeof CreateCitySchema>;

export const UpdateCitySchema = z
	.object({
		name: z.string().min(1).max(255).optional(),
		stateCode: z.string().max(255).optional(),
		countryCode: z.string().length(2).optional(),
		stateId: z.number().int().nonnegative().optional(),
		countryId: z.number().int().nonnegative().optional(),
		latitude: z.coerce.number().min(-90).max(90).optional(),
		longitude: z.coerce.number().min(-180).max(180).optional(),
		native: z.string().max(255).nullable().optional(),
		timezone: z.string().max(255).nullable().optional(),
		translations: DataValueSchema.nullable().optional(),
		wikiDataId: z.string().max(255).nullable().optional(),
		flag: z.boolean().optional(),
	})
	.strict()
	.refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided" });

export type UpdateCityInput = z.output<typeof UpdateCitySchema>;

export const CityListQuerySchema = PaginationSchema.extend({
	search: z.string().optional(),
	stateId: z.coerce.number().int().nonnegative().optional(),
	countryId: z.coerce.number().int().nonnegative().optional(),
	countryCode: z.string().length(2).optional(),
	stateCode: z.string().optional(),
	flag: z.coerce.boolean().optional(),
	ids: GeoIdsSchema,
	sort: z.string().optional(),
	cursor: GeoCursorSchema,
	include: GeoIncludeSchema,
}).strict();

export type CityListQuery = z.output<typeof CityListQuerySchema>;
