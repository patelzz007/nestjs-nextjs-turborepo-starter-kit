import { Controller, Delete, Get, HttpStatus, Patch, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { z } from "zod";

import {
	apiPath,
	BulkCreateProductResponseSchema,
	BulkCreateProductSchema,
	BulkDeleteIdsSchema,
	BulkDeleteResultSchema,
	DeleteSuccessDataSchema,
	CreateProductSchema,
	ProductIdParamSchema,
	ProductListQuerySchema,
	ProductSchema,
	type DeleteSuccessData,
	type ProductListQuery,
	UpdateProductSchema,
} from "@workspace/shared";

import { ZodBody, ZodListQuery, ZodParams } from "../../common/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../common/decorators/zod-response.decorators";
import { Idempotent } from "../../platform/idempotency/idempotent.decorator";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";

import { ProductService } from "./product.service";

@ApiTags("Product")
@Controller(apiPath("/product"))
export class ProductController {
	public constructor(private readonly service: ProductService) {}

	@RequirePermission("LIST", "PRODUCT")
	@Get()
	@ApiOperation({ summary: "List Products" })
	@ZodPaginatedResponse(ProductSchema, { description: "Paginated list of products" })
	public list(@ZodListQuery(ProductListQuerySchema) query: ProductListQuery): ReturnType<ProductService["list"]> {
		return this.service.list(query);
	}

	@RequirePermission("CREATE", "PRODUCT")
	@Post("bulk")
	@ApiOperation({ summary: "Bulk create products" })
	@ZodResponse(BulkCreateProductResponseSchema, { status: HttpStatus.CREATED, description: "Created products" })
	public bulkCreate(@ZodBody(BulkCreateProductSchema) body: { items: z.output<typeof BulkCreateProductSchema>["items"] }): ReturnType<ProductService["createMany"]> {
		return this.service.createMany(body.items);
	}

	@RequirePermission("DELETE", "PRODUCT")
	@Post("bulk-delete")
	@ApiOperation({ summary: "Bulk soft delete products" })
	@ZodResponse(BulkDeleteResultSchema, { status: HttpStatus.CREATED, description: "Bulk delete result" })
	public bulkDelete(@ZodBody(BulkDeleteIdsSchema) body: { ids: string[] }): ReturnType<ProductService["deleteMany"]> {
		return this.service.deleteMany(body.ids);
	}

	@RequirePermission("READ", "PRODUCT")
	@Get(":id")
	@ApiOperation({ summary: "Get Product by id" })
	@ZodResponse(ProductSchema, { description: "Product detail" })
	public get(@ZodParams(ProductIdParamSchema) params: { id: string }): ReturnType<ProductService["getById"]> {
		return this.service.getById(params.id);
	}

	@RequirePermission("CREATE", "PRODUCT")
	@Idempotent()
	@Post()
	@ApiOperation({ summary: "Create Product (send an Idempotency-Key header to make retries safe)" })
	@ZodResponse(ProductSchema, { status: HttpStatus.CREATED, description: "Created product" })
	public create(@ZodBody(CreateProductSchema) body: z.output<typeof CreateProductSchema>): ReturnType<ProductService["create"]> {
		return this.service.create(body);
	}

	@RequirePermission("UPDATE", "PRODUCT")
	@Patch(":id")
	@ApiOperation({ summary: "Update Product" })
	@ZodResponse(ProductSchema, { description: "Updated product" })
	public update(
		@ZodParams(ProductIdParamSchema) params: { id: string },
		@ZodBody(UpdateProductSchema) body: z.output<typeof UpdateProductSchema>,
	): ReturnType<ProductService["update"]> {
		return this.service.update(params.id, body);
	}

	@RequirePermission("DELETE", "PRODUCT")
	@Delete(":id")
	@ApiOperation({ summary: "Soft delete Product" })
	@ZodResponse(DeleteSuccessDataSchema, { description: "Product deleted" })
	public async delete(@ZodParams(ProductIdParamSchema) params: { id: string }): Promise<DeleteSuccessData> {
		await this.service.delete(params.id);
		return { success: true };
	}

	@RequirePermission("UPDATE", "PRODUCT")
	@Post(":id/restore")
	@ApiOperation({ summary: "Restore Product" })
	@ZodResponse(ProductSchema, { status: HttpStatus.CREATED, description: "Restored product" })
	public restore(@ZodParams(ProductIdParamSchema) params: { id: string }): ReturnType<ProductService["restore"]> {
		return this.service.restore(params.id);
	}
}
