import type { Prisma } from "@prisma/client";

import type { ScopeFactory } from "../../../../platform/application/events/in-transaction-event-handler";
import type { ProductImageBindings, ProductImageFileScope } from "../../application/ports/product-image-bindings.port";
import { newRowId } from "@workspace/shared";

class PrismaProductImageBindings implements ProductImageBindings {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	/** The product row lock serializes concurrent uploads; the partial unique index `product_images_one_live_primary_key` backs it up. */
	public async appendToGallery(productId: string, fileId: string): Promise<boolean> {
		const locked = await this.db.$queryRaw<{ id: string }[]>`SELECT id FROM "Product" WHERE id = ${productId} AND "deletedAt" IS NULL FOR UPDATE`;
		if (locked.length === 0) {
			return false;
		}
		const liveImages = await this.db.productImage.findMany({ where: { productId, isDeleted: false }, select: { isPrimary: true, sortOrder: true } });
		const nextSortOrder = liveImages.reduce((highest: number, image: { sortOrder: number }): number => Math.max(highest, image.sortOrder + 1), 0);
		await this.db.productImage.create({
			data: { id: newRowId(), productId, fileId, sortOrder: nextSortOrder, isPrimary: !liveImages.some((image: { isPrimary: boolean }): boolean => image.isPrimary) },
		});
		return true;
	}

	public async releaseFile(fileId: string, deletedBy: string, deletedAt: number): Promise<void> {
		const at = BigInt(deletedAt);
		await this.db.productImage.updateMany({ where: { fileId, isDeleted: false }, data: { isDeleted: true, deletedAt: at, deletedBy, updatedAt: at, isPrimary: false } });
	}
}

/** Binds catalog's gallery rows to the files transaction that reacts to a file event. Never cached. */
export class ProductImageFileScopeFactory implements ScopeFactory<ProductImageFileScope, Prisma.TransactionClient> {
	public create(db: Prisma.TransactionClient): ProductImageFileScope {
		return { productImages: new PrismaProductImageBindings(db) };
	}
}
