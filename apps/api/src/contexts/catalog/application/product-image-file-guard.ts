import type { FileCategory } from "@workspace/shared";

import type { FileDeletionScope, FileReferenceBlock, FileReferenceGuard } from "../../files/public-api";
import type { ProductImageFileScope } from "./ports/product-image-bindings.port";

/**
 * Catalog's reference guard for PRODUCT_IMAGE: a product image never blocks its
 * own deletion (its gallery rows go with it), but `ProductImage` is
 * bypass-only under RLS (its policy allows only `app_rls_bypass()`), so the
 * deletion must run as the allowlisted `files.delete` operation or the release
 * would silently update nothing.
 */
export class ProductImageFileGuard implements FileReferenceGuard<ProductImageFileScope> {
	public readonly categories: readonly FileCategory[] = ["PRODUCT_IMAGE"];
	public readonly deletionScope: FileDeletionScope = "system-operation";

	public blockDelete(): Promise<FileReferenceBlock | null> {
		return Promise.resolve(null);
	}
}
