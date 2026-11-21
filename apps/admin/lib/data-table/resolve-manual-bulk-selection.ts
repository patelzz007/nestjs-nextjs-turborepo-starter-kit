import type { PaginationInput } from "@workspace/shared";
import type { DataTableBulkSelectionContext } from "@workspace/ui/components/data-table";

export interface ListPageResult<TItem> {
	readonly items: readonly TItem[];
	readonly hasNext: boolean;
}

const MAX_BULK_FETCH_PAGES = 500;

/** Fetches every page of a page-numbered list. */
export async function fetchAllListPages<TItem>(fetchPage: (page: number, limit: number) => Promise<ListPageResult<TItem>>, maxPageSize = 100): Promise<readonly TItem[]> {
	const collected: TItem[] = [];
	const limit = Math.max(1, Math.min(maxPageSize, 100));
	let page = 1;

	while (page <= MAX_BULK_FETCH_PAGES) {
		const batch = await fetchPage(page, limit);
		collected.push(...batch.items);
		if (!batch.hasNext) {
			break;
		}
		page += 1;
	}

	return collected;
}

/**
 * The rows a bulk action on a server-paged table should operate on: the ticked rows of the page, or — when the reader
 * chose "select all matching rows" — every matching row, fetched now.
 */
export function resolveManualBulkSelectionRows<TData>(
	selectedPageRows: readonly TData[],
	context: DataTableBulkSelectionContext,
	fetchAllMatching: () => Promise<readonly TData[]>,
): Promise<readonly TData[]> {
	if (context.scope !== "all-matching") {
		return Promise.resolve(selectedPageRows);
	}
	return fetchAllMatching();
}

export type { PaginationInput };
