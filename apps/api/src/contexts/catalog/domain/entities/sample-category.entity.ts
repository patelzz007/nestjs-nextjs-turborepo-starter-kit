import type { SampleCategory } from "@workspace/shared";

/**
 * A sample category. Slug uniqueness stays a database constraint.
 * `version` is the concurrency token. Deleting a category also soft-deletes its products, in the same transaction.
 */
export class SampleCategoryEntity {
	private constructor(private readonly record: SampleCategory) {}

	public static rehydrate(record: SampleCategory): SampleCategoryEntity {
		return new SampleCategoryEntity(record);
	}

	public get id(): string {
		return this.record.id;
	}

	public get concurrencyToken(): number {
		return this.record.version;
	}

	public equals(other: SampleCategoryEntity): boolean {
		return this.id === other.id && this.concurrencyToken === other.concurrencyToken;
	}

	public toRecord(): SampleCategory {
		return this.record;
	}
}
