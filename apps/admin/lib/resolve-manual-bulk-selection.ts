import type { PaginationInput } from "@workspace/shared";

export interface ListPageResult<TItem> {
	readonly items: readonly TItem[];
	readonly hasNext: boolean;
}

const MAX_BULK_FETCH_PAGES = 500;

/** Fetches every page of a page-numbered list. */
export async function fetchAllListPages<TItem>(
	fetchPage: (page: number, limit: number) => Promise<ListPageResult<TItem>>,
	maxPageSize: number = 100,
): Promise<readonly TItem[]> {
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

export interface CursorListPageResult<TItem> {
	readonly items: readonly TItem[];
	readonly nextCursor: string | null;
	readonly hasNext: boolean;
}

/** Fetches every page of a cursor-paginated list. */
export async function fetchAllCursorListPages<TItem>(
	fetchPage: (cursor: string | null, limit: number) => Promise<CursorListPageResult<TItem>>,
	maxPageSize: number = 100,
): Promise<readonly TItem[]> {
	const collected: TItem[] = [];
	const limit = Math.max(1, Math.min(maxPageSize, 100));
	let cursor: string | null = null;
	const seenCursors = new Set<string>();

	for (let page = 0; page < MAX_BULK_FETCH_PAGES; page += 1) {
		const batch = await fetchPage(cursor, limit);
		collected.push(...batch.items);
		if (!batch.hasNext || batch.nextCursor === null) {
			break;
		}
		if (seenCursors.has(batch.nextCursor)) {
			break;
		}
		seenCursors.add(batch.nextCursor);
		cursor = batch.nextCursor;
	}

	return collected;
}

/** Resolves the rows a manual-mode bulk action should operate on. */
export async function resolveManualBulkSelectionRows<TData>(
	selectedPageRows: readonly TData[],
	context: import("@workspace/ui/lib/data-table-checkbox").DataTableBulkSelectionContext,
	fetchAllMatching: () => Promise<readonly TData[]>,
): Promise<readonly TData[]> {
	if (!context.selectAllPages) {
		return selectedPageRows;
	}
	return fetchAllMatching();
}

export type { PaginationInput };
