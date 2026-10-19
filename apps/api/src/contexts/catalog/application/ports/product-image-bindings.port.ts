/** Catalog's product gallery rows (`ProductImage`), bound to one transaction. */
export interface ProductImageBindings {
	/**
	 * Appends a READY file to the product's gallery, locking the product so
	 * concurrent uploads serialize (exactly one becomes primary, sort orders never
	 * collide). False when the product no longer exists.
	 */
	appendToGallery(productId: string, fileId: string): Promise<boolean>;

	/** Soft-deletes every live gallery row of a deleted file (and drops its primary flag). */
	releaseFile(fileId: string, deletedBy: string, deletedAt: number): Promise<void>;
}

/** What catalog's file reactions can touch inside the files transaction. */
export interface ProductImageFileScope {
	readonly productImages: ProductImageBindings;
}
