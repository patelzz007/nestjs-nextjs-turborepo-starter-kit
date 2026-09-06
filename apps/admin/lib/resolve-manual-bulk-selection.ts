import type { DataTableBulkSelectionContext } from "@workspace/ui/lib/data-table-checkbox";

const DEFAULT_MAX_PAGE_SIZE = 100;

/** Fetches every page of a server-paginated list (respects API page-size caps). */
export async function fetchAllPaginatedListPages<TItem>(
	totalCount: number,
	fetchPage: (page: number, limit: number) => Promise<readonly TItem[]>,
	maxPageSize: number = DEFAULT_MAX_PAGE_SIZE,
): Promise<readonly TItem[]> {
	const collected: TItem[] = [];
	const limit = Math.max(1, Math.min(maxPageSize, DEFAULT_MAX_PAGE_SIZE));
	let page = 1;

	while (collected.length < totalCount) {
		const batch = await fetchPage(page, limit);
		collected.push(...batch);
		if (batch.length === 0 || batch.length < limit) {
			break;
		}
		page += 1;
	}

	return collected;
}

/** Resolves the rows a manual-mode bulk action should operate on. */
export async function resolveManualBulkSelectionRows<TData>(
	selectedPageRows: readonly TData[],
	context: DataTableBulkSelectionContext,
	fetchAllMatching: () => Promise<readonly TData[]>,
): Promise<readonly TData[]> {
	if (!context.selectAllPages) {
		return selectedPageRows;
	}
	return fetchAllMatching();
}
