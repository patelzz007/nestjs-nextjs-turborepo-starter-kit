import { Controller, Delete, Get, HttpStatus, Patch, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { z } from "zod";

import {
	apiPath,
	BulkCreateProductResponseSchema,
	BulkCreateProductSchema,
	BulkDeleteIdsSchema,
	BulkDeleteResultSchema,
	CreateProductSchema,
	DeleteSuccessDataSchema,
	ProductIdParamSchema,
	ProductListQuerySchema,
	ProductSchema,
	type DeleteSuccessData,
	type ProductListQuery,
	UpdateProductSchema,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { Idempotent } from "../../../../platform/presentation/http/idempotency/idempotent.decorator";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { ZodBody, ZodListQuery, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { ProductApplicationService } from "../../application/services/product.application-service";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";

@ApiTags("Product")
@Controller(apiPath("/product"))
export class ProductController {
	public constructor(private readonly service: ProductApplicationService) {}

	@RequirePermission("LIST", "PRODUCT")
	@Get()
	@ApiOperation({ summary: "List Products" })
	@ZodPaginatedResponse(ProductSchema, { description: "Paginated list of products" })
	public list(@CurrentActor() actor: ActorContext, @ZodListQuery(ProductListQuerySchema) query: ProductListQuery): ReturnType<ProductApplicationService["list"]> {
		return this.service.list(actor, query);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("CREATE", "PRODUCT")
	@Post("bulk")
	@ApiOperation({ summary: "Bulk create products" })
	@ZodResponse(BulkCreateProductResponseSchema, { status: HttpStatus.CREATED, description: "Created products" })
	public bulkCreate(
		@CurrentActor() actor: ActorContext,
		@ZodBody(BulkCreateProductSchema) body: { items: z.output<typeof BulkCreateProductSchema>["items"] },
	): ReturnType<ProductApplicationService["createMany"]> {
		return this.service.createMany(actor, body.items);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("DELETE", "PRODUCT")
	@Post("bulk-delete")
	@ApiOperation({ summary: "Bulk soft delete products" })
	@ZodResponse(BulkDeleteResultSchema, { status: HttpStatus.CREATED, description: "Bulk delete result" })
	public bulkDelete(@CurrentActor() actor: ActorContext, @ZodBody(BulkDeleteIdsSchema) body: { ids: string[] }): ReturnType<ProductApplicationService["deleteMany"]> {
		return this.service.deleteMany(actor, body.ids);
	}

	@RequirePermission("READ", "PRODUCT")
	@Get(":id")
	@ApiOperation({ summary: "Get Product by id" })
	@ZodResponse(ProductSchema, { description: "Product detail" })
	public get(@CurrentActor() actor: ActorContext, @ZodParams(ProductIdParamSchema) params: { id: string }): ReturnType<ProductApplicationService["getById"]> {
		return this.service.getById(actor, params.id);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("CREATE", "PRODUCT")
	@Idempotent()
	@Post()
	@ApiOperation({ summary: "Create Product (send an Idempotency-Key header to make retries safe)" })
	@ZodResponse(ProductSchema, { status: HttpStatus.CREATED, description: "Created product" })
	public create(
		@CurrentActor() actor: ActorContext,
		@ZodBody(CreateProductSchema) body: z.output<typeof CreateProductSchema>,
	): ReturnType<ProductApplicationService["create"]> {
		return this.service.create(actor, body);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "PRODUCT")
	@Patch(":id")
	@ApiOperation({ summary: "Update Product" })
	@ZodResponse(ProductSchema, { description: "Updated product" })
	public update(
		@CurrentActor() actor: ActorContext,
		@ZodParams(ProductIdParamSchema) params: { id: string },
		@ZodBody(UpdateProductSchema) body: z.output<typeof UpdateProductSchema>,
	): ReturnType<ProductApplicationService["update"]> {
		return this.service.update(actor, params.id, body);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("DELETE", "PRODUCT")
	@Delete(":id")
	@ApiOperation({ summary: "Soft delete Product" })
	@ZodResponse(DeleteSuccessDataSchema, { description: "Product deleted" })
	public async delete(@CurrentActor() actor: ActorContext, @ZodParams(ProductIdParamSchema) params: { id: string }): Promise<DeleteSuccessData> {
		await this.service.delete(actor, params.id);
		return { success: true };
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "PRODUCT")
	@Post(":id/restore")
	@ApiOperation({ summary: "Restore Product" })
	@ZodResponse(ProductSchema, { status: HttpStatus.CREATED, description: "Restored product" })
	public restore(@CurrentActor() actor: ActorContext, @ZodParams(ProductIdParamSchema) params: { id: string }): ReturnType<ProductApplicationService["restore"]> {
		return this.service.restore(actor, params.id);
	}
}
