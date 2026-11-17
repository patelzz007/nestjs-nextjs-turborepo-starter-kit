import { defineCache, PLATFORM_SCOPE, type AppCache, type CacheDefinition } from "../../../../platform/application/ports/app-cache.port";
import type { CatalogVersionSignal, FlagCatalogLoader, FlagCatalogSource } from "../../application/ports/flag-catalog.port";
import { CatalogIndex } from "../../domain/catalog/catalog-index";
import { FlagCatalogSchema, type FlagCatalog } from "../../domain/catalog/flag-catalog";

/** The catalogue's one cache entry. */
const CATALOG_ENTRY_ID = "current";
/**
 * A safety net only: every change drops every instance's copy after it commits (ADR 072), so a kill switch applies
 * at once. Without Redis (one instance) the same holds in-process.
 */
const CATALOG_TTL_MS = 30_000;
/** Never served stale: a thrown kill switch must not wait for a refresh. */
const NO_STALE_MS = 0;
/** One catalogue per deployment. */
const ONE_ENTRY = 1;

/**
 * The catalogue every decision reads (ADR 087): kept in each process (it holds user and device ids, so it never
 * goes to Redis), loaded once by one caller at a time, dropped everywhere after a change, and indexed once per
 * loaded value.
 */
export class CachedFlagCatalogSource implements FlagCatalogSource {
	public readonly definition: CacheDefinition<FlagCatalog, "platform">;
	private indexed: { readonly catalog: FlagCatalog; readonly index: CatalogIndex } | null = null;

	public constructor(
		private readonly cache: AppCache,
		private readonly loader: FlagCatalogLoader,
		private readonly signal: CatalogVersionSignal,
	) {
		this.definition = defineCache({
			name: "feature-flags.catalog",
			version: 1,
			schema: FlagCatalogSchema,
			scope: "platform",
			tier: "local",
			ttlMs: CATALOG_TTL_MS,
			staleMs: NO_STALE_MS,
			containsPersonalData: true,
			localMaxEntries: ONE_ENTRY,
			sharedMaxKeys: ONE_ENTRY,
		});
		this.cache.register(this.definition);
	}

	public async current(): Promise<CatalogIndex> {
		const catalog = await this.cache.getOrLoad(this.definition, PLATFORM_SCOPE, CATALOG_ENTRY_ID, () => this.loader.load());
		if (this.indexed?.catalog !== catalog) {
			this.indexed = { catalog, index: new CatalogIndex(catalog) };
		}
		return this.indexed.index;
	}

	public async changed(version: number): Promise<void> {
		await this.cache.invalidate(this.definition, PLATFORM_SCOPE, CATALOG_ENTRY_ID);
		await this.signal.publish(version);
	}
}
