import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { AUTHORIZATION_KERNEL, type AuthorizationKernelPort } from "../../../authorization/public-api";
import { bindFileReferenceGuard, FileCategoryAccessRegistry, FileReferenceGuardRegistry } from "../../../files/public-api";
import { bindInTransactionHandler } from "../../../../platform/application/events/in-transaction-event-handler";
import { InTransactionEventRegistry } from "../../../../platform/application/events/in-transaction-event-registry";
import { BindProductImageOnFileVerdict } from "../../application/event-handlers/in-transaction/bind-product-image-on-file-verdict.in-transaction-handler";
import { ReleaseProductImagesOnFileDeleted } from "../../application/event-handlers/in-transaction/release-product-images-on-file-deleted.in-transaction-handler";
import { ProductImageFileAccessRule } from "../../application/product-image-file-access.rule";
import { ProductImageFileGuard } from "../../application/product-image-file-guard";
import { ProductImageFileScopeFactory } from "./prisma-product-image-bindings";

/**
 * Catalog owns PRODUCT_IMAGE's meaning: who may upload one (`PRODUCT:UPDATE` on
 * that product), it binds a READY image into the
 * product gallery and releases the gallery rows when the file is deleted
 * (both in the files transaction, mechanism 1), and tells files that the
 * deletion must run as `files.delete` because `ProductImage` is bypass-only.
 */
@Injectable()
export class CatalogFileRegistrations implements OnModuleInit {
	public constructor(
		@Inject(InTransactionEventRegistry) private readonly handlers: InTransactionEventRegistry<Prisma.TransactionClient>,
		@Inject(FileReferenceGuardRegistry) private readonly guards: FileReferenceGuardRegistry<Prisma.TransactionClient>,
		private readonly access: FileCategoryAccessRegistry,
		@Inject(AUTHORIZATION_KERNEL) private readonly kernel: AuthorizationKernelPort,
	) {}

	public onModuleInit(): void {
		const scopes = new ProductImageFileScopeFactory();
		this.access.register(new ProductImageFileAccessRule(this.kernel));
		this.handlers.register(bindInTransactionHandler(new BindProductImageOnFileVerdict(), scopes));
		this.handlers.register(bindInTransactionHandler(new ReleaseProductImagesOnFileDeleted(), scopes));
		this.guards.register(bindFileReferenceGuard(new ProductImageFileGuard(), scopes));
	}
}
