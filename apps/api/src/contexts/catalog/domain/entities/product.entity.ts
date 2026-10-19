import type { Product } from "@workspace/shared";

/**
 * A catalog product. Sku and slug uniqueness stay database constraints.
 * `version` is the concurrency token the repository compares on update.
 */
export class ProductEntity {
	private constructor(private readonly record: Product) {}

	public static rehydrate(record: Product): ProductEntity {
		return new ProductEntity(record);
	}

	public get id(): string {
		return this.record.id;
	}

	public get concurrencyToken(): number {
		return this.record.version;
	}

	public equals(other: ProductEntity): boolean {
		return this.id === other.id && this.concurrencyToken === other.concurrencyToken;
	}

	public toRecord(): Product {
		return this.record;
	}
}
