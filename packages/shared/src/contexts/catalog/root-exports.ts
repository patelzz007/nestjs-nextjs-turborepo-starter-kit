// What the root `@workspace/shared` barrel exposes of the `catalog` context (enhancement 8.2): a curated subset of
// this context's index. Its own contract object and route map stay behind the aggregated `apiContract` /
// `apiRoutes`, and its building-block schemas stay internal. Add a name here to make it part of the package's
// public surface (the export snapshot in src/contracts/__tests__/api-contract-shape.test.ts records it).

export {
	BulkCreateSampleCategorySchema,
	CreateSampleCategorySchema,
	SampleCategoryIdParamSchema,
	SampleCategoryListQuerySchema,
	SampleCategoryListResponseSchema,
	sampleCategoryListQuery,
	SampleCategorySchema,
	UpdateSampleCategorySchema,
	BulkCreateSampleCategoryResponseSchema,
} from "./schemas/sample-category";
export type {
	BulkCreateSampleCategoryInput,
	CreateSampleCategoryInput,
	SampleCategory,
	SampleCategoryListQuery,
	SampleCategoryListResponse,
	SampleCategoryListSortField,
	UpdateSampleCategoryInput,
} from "./schemas/sample-category";
export {
	BulkCreateProductSchema,
	CreateProductSchema,
	ProductIdParamSchema,
	ProductListQuerySchema,
	ProductListResponseSchema,
	productListQuery,
	ProductSchema,
	UpdateProductSchema,
	BulkCreateProductResponseSchema,
} from "./schemas/product";
export type { BulkCreateProductInput, CreateProductInput, Product, ProductListQuery, ProductListResponse, ProductListSortField, UpdateProductInput } from "./schemas/product";
export {
	CATALOG_DESCRIPTION_MAX_LENGTH,
	CATALOG_MAX_PRICE,
	CATALOG_NAME_MAX_LENGTH,
	CATALOG_SLUG_MAX_LENGTH,
	CatalogNameSchema,
	CatalogSlugSchema,
	OptimisticVersionSchema,
	PRODUCT_BRAND_MAX_LENGTH,
	PRODUCT_IMAGE_URL_MAX_LENGTH,
	PRODUCT_SHORT_DESCRIPTION_MAX_LENGTH,
	PRODUCT_SKU_MAX_LENGTH,
} from "./schemas/catalog-fields";
