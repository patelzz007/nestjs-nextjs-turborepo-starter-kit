// API contract leaves owned by the `catalog` context (plan §7: the backend owner of each
// endpoint). Composed into `apiContract` (`src/contracts/index.ts`) with identical keys.

import { z } from "zod";

import { defineContract } from "../../contracts/define-contract";
import { paginatedResponse, singleResponse } from "../../contracts/response";
import { DeleteSuccessDataSchema } from "../../schemas/api/api-response";
import { BulkDeleteIdsSchema, BulkDeleteResultSchema } from "../../schemas/api/bulk-mutation";
import { productRoutes, sampleCategoryRoutes } from "./routes";
import {
	BulkCreateProductResponseSchema,
	BulkCreateProductSchema,
	CreateProductSchema,
	ProductIdParamSchema,
	ProductListQuerySchema,
	ProductSchema,
	UpdateProductSchema,
} from "./schemas/product";
import {
	BulkCreateSampleCategoryResponseSchema,
	BulkCreateSampleCategorySchema,
	CreateSampleCategorySchema,
	SampleCategoryIdParamSchema,
	SampleCategoryListQuerySchema,
	SampleCategorySchema,
	UpdateSampleCategorySchema,
} from "./schemas/sample-category";

/** Contract leaves composed into `apiContract.sampleCategory`. */
export const sampleCategoryContract = {
	list: defineContract({ method: "GET", path: sampleCategoryRoutes.list, input: SampleCategoryListQuerySchema, response: paginatedResponse(SampleCategorySchema) }),
	detail: defineContract({ method: "GET", path: sampleCategoryRoutes.detail, input: SampleCategoryIdParamSchema, response: singleResponse(SampleCategorySchema) }),
	create: defineContract({ method: "POST", path: sampleCategoryRoutes.create, input: CreateSampleCategorySchema, response: singleResponse(SampleCategorySchema) }),
	bulkCreate: defineContract({
		method: "POST",
		path: sampleCategoryRoutes.bulkCreate,
		input: BulkCreateSampleCategorySchema,
		response: singleResponse(BulkCreateSampleCategoryResponseSchema),
	}),
	bulkDelete: defineContract({ method: "POST", path: sampleCategoryRoutes.bulkDelete, input: BulkDeleteIdsSchema, response: singleResponse(BulkDeleteResultSchema) }),
	update: defineContract({
		method: "PATCH",
		path: sampleCategoryRoutes.update,
		input: z.intersection(SampleCategoryIdParamSchema, UpdateSampleCategorySchema),
		response: singleResponse(SampleCategorySchema),
	}),
	delete: defineContract({
		method: "DELETE",
		path: sampleCategoryRoutes.delete,
		input: SampleCategoryIdParamSchema,
		response: singleResponse(DeleteSuccessDataSchema),
	}),
	restore: defineContract({
		method: "POST",
		path: sampleCategoryRoutes.restore,
		input: SampleCategoryIdParamSchema,
		response: singleResponse(SampleCategorySchema),
	}),
};

/** Contract leaves composed into `apiContract.product`. */
export const productContract = {
	list: defineContract({ method: "GET", path: productRoutes.list, input: ProductListQuerySchema, response: paginatedResponse(ProductSchema) }),
	detail: defineContract({ method: "GET", path: productRoutes.detail, input: ProductIdParamSchema, response: singleResponse(ProductSchema) }),
	create: defineContract({ method: "POST", path: productRoutes.create, input: CreateProductSchema, response: singleResponse(ProductSchema) }),
	bulkCreate: defineContract({
		method: "POST",
		path: productRoutes.bulkCreate,
		input: BulkCreateProductSchema,
		response: singleResponse(BulkCreateProductResponseSchema),
	}),
	bulkDelete: defineContract({ method: "POST", path: productRoutes.bulkDelete, input: BulkDeleteIdsSchema, response: singleResponse(BulkDeleteResultSchema) }),
	update: defineContract({
		method: "PATCH",
		path: productRoutes.update,
		input: z.intersection(ProductIdParamSchema, UpdateProductSchema),
		response: singleResponse(ProductSchema),
	}),
	delete: defineContract({ method: "DELETE", path: productRoutes.delete, input: ProductIdParamSchema, response: singleResponse(DeleteSuccessDataSchema) }),
	restore: defineContract({ method: "POST", path: productRoutes.restore, input: ProductIdParamSchema, response: singleResponse(ProductSchema) }),
};
