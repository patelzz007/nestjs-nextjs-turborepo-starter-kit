// ============================================
// domain/access/store-scope.ts — which stores a membership or a grant reaches (ADR 067)
// ============================================
// OOP: an immutable VALUE OBJECT. Encapsulation — callers never inspect the
// raw set; they ask `covers()` / `includes()`, so "all stores", "these stores"
// and "no stores" are decided in exactly one place.

/** A set of stores: every store of the tenant (now and later), or an explicit list. */
export class StoreScope {
	private constructor(
		private readonly everyStore: boolean,
		private readonly locationIds: ReadonlySet<string>,
	) {}

	/** Every store of the tenant — evaluated at request time, so stores added later are covered. */
	public static all(): StoreScope {
		return new StoreScope(true, new Set<string>());
	}

	/** Exactly these stores (none: an empty scope that covers only tenant-level records). */
	public static of(locationIds: Iterable<string>): StoreScope {
		return new StoreScope(false, new Set<string>(locationIds));
	}

	/**
	 * Whether a record at `locationId` is inside the scope. A record with no store (a tenant-level
	 * record such as the tenant's analytics) is covered by every scope.
	 */
	public covers(locationId: string | undefined): boolean {
		return locationId === undefined || this.everyStore || this.locationIds.has(locationId);
	}

	/** Whether every store `other` reaches is also reached by this scope (grant-time delegation check). */
	public includes(other: StoreScope): boolean {
		if (this.everyStore) {
			return true;
		}
		return !other.everyStore && [...other.locationIds].every((locationId) => this.locationIds.has(locationId));
	}
}
