import type { BulkDeleteResult, CreateProductInput, PaginatedServiceResult, PaginationInput, Product, ProductListQuery, UpdateProductInput } from "@workspace/shared";

export interface CatalogList<TItem> {
	readonly items: readonly TItem[];
	readonly total: number;
	readonly page: number;
	readonly totalPages: number;
	readonly nextCursor: string | null;
	readonly hasNext: boolean;
	readonly hasPrevious: boolean;
}

export interface ProductRepository {
	list(query: ProductListQuery): Promise<CatalogList<Product>>;
	findById(id: string): Promise<Product | null>;
	create(input: CreateProductInput): Promise<Product>;
	update(id: string, input: UpdateProductInput): Promise<Product>;
	delete(id: string): Promise<void>;
	createMany(inputs: readonly CreateProductInput[]): Promise<readonly Product[]>;
	deleteMany(ids: readonly string[]): Promise<number>;
	restore(id: string): Promise<Product>;
}

export function toCatalogPage<TItem>(result: CatalogList<TItem>, query: PaginationInput): PaginatedServiceResult<TItem> {
	return {
		items: [...result.items],
		limit: query.limit,
		total: result.total,
		page: result.page,
		totalPages: result.totalPages,
		nextCursor: result.nextCursor,
		hasNext: result.hasNext,
		hasPrevious: result.hasPrevious,
	};
}

export function toBulkDeleteResult(deletedCount: number): BulkDeleteResult {
	return { deletedCount };
}
