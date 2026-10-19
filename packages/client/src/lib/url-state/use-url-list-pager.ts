// The previous / next / first-page moves of a paginated list whose page lives in the URL — the props
// a `ListPager` takes, derived from the list's URL state and the response's pagination `meta`.
"use client";

import type { ApiResponseMeta } from "@workspace/shared";
import { useCallback } from "react";

import { readPaginatedHasNext, readPaginatedNextCursor, readPaginatedTotalPages } from "../api/envelope";
import { LIST_FIRST_PAGE, listPagePatch, type ListUrlPagePatch, type ListUrlPagingState } from "./list-url-state";

export interface UrlListPager {
	readonly page: number;
	/** Pages in the list (`meta.totalPages`; the current page while there is no answer yet). */
	readonly totalPages: number;
	readonly hasPrevious: boolean;
	readonly hasNext: boolean;
	/** Whether a pager is worth showing: there is a page before or after this one. */
	readonly isPaged: boolean;
	readonly onPrevious: () => void;
	readonly onNext: () => void;
	readonly onFirstPage: () => void;
}

/**
 * Page moves for a URL-state list. "Next" in the default order follows the response's keyset cursor;
 * every other move pages by offset (`listPagePatch`). Each move pushes a history entry, so Back undoes it.
 */
export function useUrlListPager(state: ListUrlPagingState, update: (patch: ListUrlPagePatch) => void, meta: ApiResponseMeta | undefined): UrlListPager {
	const nextCursor = readPaginatedNextCursor(meta);
	const hasPrevious = state.page > LIST_FIRST_PAGE;
	const hasNext = readPaginatedHasNext(meta);
	const onNext = useCallback((): void => {
		update(listPagePatch(state, state.page + 1, nextCursor));
	}, [nextCursor, state, update]);
	const onPrevious = useCallback((): void => {
		update(listPagePatch(state, state.page - 1, null));
	}, [state, update]);
	const onFirstPage = useCallback((): void => {
		update(listPagePatch(state, LIST_FIRST_PAGE, null));
	}, [state, update]);
	return { page: state.page, totalPages: readPaginatedTotalPages(meta, state.page), hasPrevious, hasNext, isPaged: hasPrevious || hasNext, onPrevious, onNext, onFirstPage };
}
